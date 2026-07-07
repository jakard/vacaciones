// Guards the hosting↔functions wiring: every callable the frontend invokes via
// callableURL('name') → /api/name MUST have a matching rewrite in firebase.json,
// and every callable must be exported from functions/src/index.ts. A missing
// rewrite falls through to the index.html catch-all, so the callable client
// gets HTML and throws "Response is not a valid JSON object" (silent at build
// time, broken at runtime). Runs in the smoke gate.
import { readFileSync } from 'node:fs';

const appSrc = readFileSync(new URL('../../app/app.js', import.meta.url), 'utf8');
const firebaseJson = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'));
const indexSrc = readFileSync(new URL('../../functions/src/index.ts', import.meta.url), 'utf8');

// Names the frontend calls: callableURL('name')
const called = new Set();
const callRe = /callableURL\(\s*'([^']+)'\s*\)/g;
let m;
while ((m = callRe.exec(appSrc))) called.add(m[1]);

// Rewrites present: functionId of every /api/* rule
const rewritten = new Set(
  (firebaseJson.hosting?.rewrites ?? [])
    .map((r) => r.function?.functionId)
    .filter(Boolean),
);

// Functions exported from the index (the deploy surface)
const exported = new Set();
const expRe = /export\s*\{([^}]*)\}\s*from/g;
let e;
while ((e = expRe.exec(indexSrc))) {
  for (const name of e[1].split(',')) {
    const n = name.trim().split(/\s+as\s+/)[0].trim();
    if (n) exported.add(n);
  }
}

const problems = [];
for (const name of [...called].sort()) {
  if (!rewritten.has(name)) problems.push(`callable '${name}' has no /api/${name} rewrite in firebase.json`);
  if (!exported.has(name)) problems.push(`callable '${name}' is not exported from functions/src/index.ts`);
}

if (problems.length) {
  console.error(`rewrites-check: ✗ ${problems.length} problem(s)`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`rewrites-check: ✓ ${called.size} callables all wired (rewrite + export)`);
