// Guards the ES dictionary: no duplicate keys, and every key's {param}
// placeholders match the ones its English source key declares. Runs in
// the smoke step so translation drift can't ship.
import { readFileSync } from 'node:fs';
import { ES } from '../../app/i18n-es.js';

const src = readFileSync(new URL('../../app/i18n-es.js', import.meta.url), 'utf8');

// --- duplicate keys (JS keeps the last silently) ---
const keyRe = /^\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*:/gm;
const counts = new Map();
let m;
while ((m = keyRe.exec(src))) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
const dups = [...counts].filter(([, c]) => c > 1).map(([k]) => k);

// --- placeholder parity: dict value must use only the key's params ---
const params = (s) => new Set((String(s).match(/\{[a-zA-Z]+\}/g) || []));
const mismatches = [];
for (const [key, val] of Object.entries(ES)) {
  const kp = params(key);
  const vp = params(val);
  for (const p of vp) if (!kp.has(p)) mismatches.push(`${JSON.stringify(key)} → value has ${p} not in key`);
}

// --- coverage: every t()/tr() literal key must exist in the ES dict ---
// (a missing key silently falls back to English in ES mode).
const appSrc = readFileSync(new URL('../../app/app.js', import.meta.url), 'utf8');
const callRe = /\b(?:t|tr)\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
const callKeys = new Set();
let c;
while ((c = callRe.exec(appSrc))) {
  const k = (c[1] ?? c[2]).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (k) callKeys.add(k);
}
// Dynamic keys translated via t(x) on constant arrays/objects.
const dynamicBlocks = [
  /const RANKS = \[([\s\S]*?)\];/, /const ACHIEVEMENTS = \[([\s\S]*?)\];/,
  /const STAN_SCENES = \[([\s\S]*?)\];/, /const MASCOT_LINES = \[([\s\S]*?)\];/,
  /const REACHABILITY_OPTIONS = \[([\s\S]*?)\];/, /const COVERAGE_KIND_OPTIONS = \[([\s\S]*?)\];/,
  /const STATUS_LABEL = \{([\s\S]*?)\};/, /const LEDGER_TYPE_LABELS = \{([\s\S]*?)\};/,
  /const WEEKDAY_NAMES = \[([\s\S]*?)\];/, /const MONTH_NAMES = \[([\s\S]*?)\];/,
  /const SKIN_OPTIONS = \[([\s\S]*?)\];/,
];
for (const rx of dynamicBlocks) {
  const block = appSrc.match(rx)?.[1] ?? '';
  const lit = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  let mm;
  while ((mm = lit.exec(block))) {
    const v = (mm[1] ?? mm[2]).replace(/\\'/g, "'");
    if (v && /[A-Za-z]{3,}/.test(v) && !/^[a-z0-9-]+$/.test(v)) callKeys.add(v);
  }
}
const untranslated = [...callKeys].filter((k) => !(k in ES)).sort();

const problems = [];
if (dups.length) problems.push(`duplicate keys: ${dups.join(', ')}`);
if (mismatches.length) problems.push(...mismatches);
if (untranslated.length) {
  problems.push(`${untranslated.length} call-site key(s) missing from ES dict:`);
  for (const k of untranslated) problems.push(`  · ${JSON.stringify(k)}`);
}

if (problems.length) {
  console.error(`dict-check: ✗ ${problems.length} problem(s)`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`dict-check: ✓ ${Object.keys(ES).length} ES entries, no dups, placeholders consistent`);
