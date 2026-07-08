// Render smoke harness — loads the real app/app.js inside jsdom with
// Firebase stubbed, seeds a realistic app state, and drives EVERY screen
// and modal in BOTH languages. Fails loudly on:
//   - any thrown exception,
//   - leaked template artifacts in visible text: "undefined", "[object",
//     "NaN", un-interpolated {param} placeholders,
//   - an empty render where content was expected.
//
// Run:  npm run smoke     (no emulator, no network, ~2s)
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const APP = new URL('../../app/app.js', import.meta.url);
const ES_DICT = new URL('../../app/i18n-es.js', import.meta.url);
const INDEX = new URL('../../app/index.html', import.meta.url);
const PLAIN_DICT = new URL('../../app/i18n-plain.js', import.meta.url);

// ---------------------------------------------------------------------
// 1. Build the instrumented module source
// ---------------------------------------------------------------------
let src = readFileSync(APP, 'utf8');
const esSrc = readFileSync(ES_DICT, 'utf8').replace(/^export const ES =/m, 'const TRANSLATIONS_ES =');
const plainSrc = readFileSync(PLAIN_DICT, 'utf8').replace(/^export const PLAIN =/m, 'const PLAIN =');

// Strip the gstatic + local dict/config imports; replace with stubs. Anchor
// on the LAST local import so all of them are removed.
const importAnchor = "import { firebaseConfig } from './firebase-config.js';";
const importBlockEnd = src.indexOf(importAnchor);
if (importBlockEnd === -1) throw new Error('harness: dict import anchor not found');
const afterImports = src.indexOf('\n', importBlockEnd) + 1;
src = src.slice(afterImports);

const stubs = `
// ---- smoke-harness Firebase stubs ----
const __calls = [];
globalThis.__fbCalls = __calls;
const initializeApp = (cfg) => ({ cfg });
const getAuth = () => ({ __auth: true });
const GoogleAuthProvider = class { static credentialFromResult() { return null; } };
let __authCb = null;
const onAuthStateChanged = (a, cb) => { __authCb = cb; return () => {}; };
globalThis.__fireAuth = (user) => __authCb && __authCb(user);
const signInWithPopup = async () => ({ user: null });
const signOut = async () => { __authCb && __authCb(null); };
const getFirestore = () => ({ __db: true });
const collection = (...a) => ({ __col: a });
const doc = (...a) => ({ __doc: a });
const query = (...a) => ({ __q: a });
const where = (...a) => ({ __w: a });
const orderBy = (...a) => ({ __o: a });
const limit = (n) => ({ __l: n });
const startAfter = (c) => ({ __sa: c });
const onSnapshot = (q, cb) => { return () => {}; };
const getDocs = async () => ({ empty: true, docs: [] });
const getFunctions = () => ({ __fns: true });
const httpsCallableFromURL = (f, url) => async (payload) => {
  __calls.push({ url, payload });
  return { data: {} };
};
${esSrc}
${plainSrc}
const firebaseConfig = { projectId: 'demo', appId: '1:0:web:0', apiKey: 'demo', authDomain: 'demo.firebaseapp.com', messagingSenderId: '0', storageBucket: 'demo.appspot.com' };
// ---- end stubs ----
`;

const bridge = `
;globalThis.__TO = {
  state, render, renderUserInfo, t, tr, lang, voice, skin, audio, esc,
  computeStats, computeRank, RANKS, ONBOARD_SCENES, SVG,
  showRankCinematic, maybeShowRankCinematic,
  showAvatarPicker, showBountyDetail,
  showSendScrollModal, showGrantBonusModal, showMemberAdminModal,
  showEditBountyModal, showDeleteAccountModal, showDisbandCrewModal,
  showManageCrewModal, showWelcomeModal, renderOnboardScene,
  startCrewClaim, confirmCancelBounty, closeAllModals, topUpGrantAction,
  launchCoinShower, showToast, showAccountsEditor,
};
`;

const moduleSource = stubs + src + bridge;

// ---------------------------------------------------------------------
// 2. jsdom environment (real index.html, script tag removed)
// ---------------------------------------------------------------------
const html = readFileSync(INDEX, 'utf8').replace(/<script[^>]*src="app\.js"[^>]*><\/script>/, '');
const dom = new JSDOM(html, { url: 'https://timeoff.test/', pretendToBeVisual: true });
const { window } = dom;

for (const k of ['document', 'localStorage', 'navigator', 'location', 'history',
  'requestAnimationFrame', 'cancelAnimationFrame', 'HTMLElement', 'Node', 'CustomEvent']) {
  if (window[k] === undefined) continue;
  try {
    Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true });
  } catch {
    /* leave Node's own global in place */
  }
}
globalThis.window = window;
window.matchMedia = window.matchMedia || ((q) => ({
  matches: false, media: q,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
}));
globalThis.matchMedia = window.matchMedia;
window.AudioContext = class { createOscillator() { return { connect(){}, start(){}, stop(){}, frequency: { value: 0 }, type: '' }; } createGain() { return { connect(){}, gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){}, value: 0 } }; } get currentTime() { return 0; } get destination() { return {}; } };
globalThis.AudioContext = window.AudioContext;
window.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
globalThis.requestAnimationFrame = window.requestAnimationFrame;
// clipboard for copy flows (not driven, but avoid crashes)
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });

// ---------------------------------------------------------------------
// 3. Import the instrumented module
// ---------------------------------------------------------------------
const b64 = Buffer.from(moduleSource, 'utf8').toString('base64');
await import(`data:text/javascript;base64,${b64}`);
const T = globalThis.__TO;
if (!T) throw new Error('harness: bridge not exported');

// ---------------------------------------------------------------------
// 4. Fixtures
// ---------------------------------------------------------------------
const now = Date.now();
const ts = (msOffset) => {
  const d = new Date(now + msOffset);
  return { toDate: () => d, toMillis: () => d.getTime() };
};
const U = { uid: 'me', displayName: 'Raul Sosa', email: 'raul@example.com', photoURL: null };
const OTHER = { uid: 'ana', displayName: 'Ana García', photoURL: null };

function seedState({ empty = false } = {}) {
  const s = T.state;
  s.authReady = true;
  s.user = { ...U };
  s.userDoc = { avatarId: 'm1', digestEnabled: true };
  s.view = 'team';
  s.teamId = 'crew1';
  s.teamTab = 'bounties';
  s.bountyFilter = 'all';
  s.bountyFilterText = '';
  s.myRole = 'manager';
  // Book of business — drives the account × day matrix in the post form.
  s.myAccounts = empty ? [] : [{ id: 'acme', name: 'Acme Corp' }, { id: 'globex', name: 'Globex' }];
  s.myTeams = [{ id: 'crew1', name: 'Equipo Andes', memberUids: ['me', 'ana', 'luis'], ownerUid: 'me', photoURL: null }];
  s.bellOpen = false;
  s.walletDoc = empty ? null : { earnedBalance: 137, stipendBalance: 11 };
  s.ledger = empty ? [] : [
    { id: 'l1', type: 'coverageRelease', amountSigned: 5, balanceBucket: 'earned', relatedRequestId: 'b1', createdAt: ts(-3600e3) },
    { id: 'l2', type: 'grant', amountSigned: 125, balanceBucket: 'earned', relatedRequestId: null, createdAt: ts(-86400e3 * 30) },
    { id: 'l3', type: 'stipendMint', amountSigned: 11, balanceBucket: 'stipend', relatedRequestId: null, createdAt: ts(-86400e3 * 2) },
    { id: 'l4', type: 'feeBurn', amountSigned: -1, balanceBucket: 'earned', relatedRequestId: 'b2', createdAt: ts(-7200e3) },
    { id: 'l5', type: 'escrowIn', amountSigned: -25, balanceBucket: 'earned', relatedRequestId: 'b3', createdAt: ts(-3 * 86400e3) },
    { id: 'l6', type: 'managerAdvance', amountSigned: 20, balanceBucket: 'earned', relatedRequestId: null, createdAt: ts(-4 * 86400e3) },
    { id: 'l7', type: 'stipendExpire', amountSigned: -3, balanceBucket: 'stipend', relatedRequestId: null, createdAt: ts(-5 * 86400e3) },
    { id: 'l8', type: 'escrowOut', amountSigned: 10, balanceBucket: 'earned', relatedRequestId: 'b4', createdAt: ts(-6 * 86400e3) },
  ];
  s.prevLedgerIds = new Set(s.ledger.map((e) => e.id));
  const mkMeeting = (i) => ({
    googleEventId: `ev${i}`, summary: `Sync con cliente ${i}`, startMs: now + i * 3600e3, endMs: now + (i + 1) * 3600e3,
    hangoutLink: 'https://meet.google.com/x', htmlLink: 'https://calendar.google.com/x',
    conferenceLinks: ['https://zoom.us/j/1'], attendees: [{ email: 'a@x.com' }], location: 'Sala 4',
  });
  s.bounties = empty ? [] : [
    { id: 'b1', status: 'open', requesterUid: 'ana', requesterDisplayName: OTHER.displayName, requesterPhotoURL: null,
      windowStart: ts(86400e3), windowEnd: ts(5 * 86400e3), timezone: 'Europe/Madrid',
      totalCoinsOffered: 25, coinsEscrowed: 0, coinsReleased: 0, coverageMode: 'single',
      selectedDayKeys: ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19'], dayCoverers: {}, coverers: [],
      reachability: ['unreachable', 'email-only-emergencies'], coverageKinds: ['inbox', 'meetings', 'escalations'],
      coverageScope: 'Acme + 2 SMBs', sla: 'Responder P1 < 2h', emergencyDef: 'Solo producción caída',
      meetings: [mkMeeting(1), mkMeeting(2)], createdAt: ts(-3600e3), updatedAt: ts(-3600e3),
      aiBriefing: { content: '## Orientación\n**Cuentas**: Acme.\n- Punto uno\n- Punto dos\n[Doc](https://example.com)', generatedAtMs: now - 3600e3 } },
    { id: 'b2', status: 'open', requesterUid: 'luis', requesterDisplayName: 'Luis Pérez', requesterPhotoURL: null,
      windowStart: ts(7 * 86400e3), windowEnd: ts(11 * 86400e3), timezone: 'America/Mexico_City',
      totalCoinsOffered: 30, coinsEscrowed: 10, coinsReleased: 0, coverageMode: 'crew',
      selectedDayKeys: ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25'],
      dayCoverers: { '2026-06-22': { uid: 'me', displayName: U.displayName, photoURL: null }, '2026-06-23': { uid: 'ana', displayName: OTHER.displayName, photoURL: null } },
      coverers: [{ uid: 'me', displayName: U.displayName, photoURL: null }, { uid: 'ana', displayName: OTHER.displayName, photoURL: null }],
      reachability: ['phone-emergencies'], coverageKinds: ['on-call'], coverageScope: null, sla: 'Best effort',
      emergencyDef: null, meetings: [], createdAt: ts(-7200e3), updatedAt: ts(-1800e3) },
    { id: 'b3', status: 'accepted', requesterUid: 'me', requesterDisplayName: U.displayName, requesterPhotoURL: null,
      covererUid: 'ana', covererDisplayName: OTHER.displayName, covererPhotoURL: null,
      windowStart: ts(2 * 86400e3), windowEnd: ts(4 * 86400e3), timezone: 'UTC',
      totalCoinsOffered: 15, coinsEscrowed: 15, coinsReleased: 0, coverageMode: 'single',
      selectedDayKeys: ['2026-06-16', '2026-06-17', '2026-06-18'], dayCoverers: {}, coverers: [{ uid: 'ana', displayName: OTHER.displayName, photoURL: null }],
      reachability: ['daily-check-in'], coverageKinds: ['chat', 'one-on-ones'], coverageScope: 'Mis 1:1', sla: '24h',
      emergencyDef: 'P0 only', meetings: [mkMeeting(3)], createdAt: ts(-86400e3), updatedAt: ts(-600e3) },
    { id: 'b4', status: 'active', requesterUid: 'ana', requesterDisplayName: OTHER.displayName, requesterPhotoURL: null,
      covererUid: 'me', covererDisplayName: U.displayName, covererPhotoURL: null,
      windowStart: ts(-2 * 86400e3), windowEnd: ts(2 * 86400e3), timezone: 'UTC',
      totalCoinsOffered: 20, coinsEscrowed: 20, coinsReleased: 10, coverageMode: 'single',
      selectedDayKeys: ['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15'], dayCoverers: {}, coverers: [],
      reachability: ['unreachable'], coverageKinds: ['inbox'], coverageScope: null, sla: 'x', emergencyDef: null,
      meetings: [], createdAt: ts(-3 * 86400e3), updatedAt: ts(-3600e3) },
    { id: 'b5', status: 'completed', requesterUid: 'me', requesterDisplayName: U.displayName, requesterPhotoURL: null,
      covererUid: 'ana', covererDisplayName: OTHER.displayName, covererPhotoURL: null,
      windowStart: ts(-10 * 86400e3), windowEnd: ts(-6 * 86400e3), timezone: 'UTC',
      totalCoinsOffered: 25, coinsEscrowed: 25, coinsReleased: 25, coverageMode: 'single',
      selectedDayKeys: ['2026-06-01'], dayCoverers: {}, coverers: [],
      reachability: ['unreachable'], coverageKinds: [], coverageScope: null, sla: 'x', emergencyDef: null,
      meetings: [], createdAt: ts(-11 * 86400e3), updatedAt: ts(-6 * 86400e3) },
    { id: 'b6', status: 'cancelled', requesterUid: 'luis', requesterDisplayName: 'Luis Pérez', requesterPhotoURL: null,
      windowStart: ts(3 * 86400e3), windowEnd: ts(4 * 86400e3), timezone: 'UTC',
      totalCoinsOffered: 10, coinsEscrowed: 0, coinsReleased: 0, coverageMode: 'single',
      selectedDayKeys: ['2026-06-20'], dayCoverers: {}, coverers: [],
      reachability: ['email-only-emergencies'], coverageKinds: [], coverageScope: null, sla: 'x', emergencyDef: null,
      meetings: [], createdAt: ts(-86400e3), updatedAt: ts(-3600e3) },
    // Account-split bounty: 2 accounts × 3 days, one cell each already claimed.
    { id: 'b7', status: 'open', requesterUid: 'luis', requesterDisplayName: 'Luis Pérez', requesterPhotoURL: null,
      windowStart: ts(6 * 86400e3), windowEnd: ts(8 * 86400e3), timezone: 'UTC',
      totalCoinsOffered: 30, coinsEscrowed: 10, coinsReleased: 0, coverageMode: 'crew',
      accounts: [{ id: 'acme', name: 'Acme Corp' }, { id: 'globex', name: 'Globex' }],
      cells: [
        { accountId: 'acme', dayKey: '2026-06-26' }, { accountId: 'acme', dayKey: '2026-06-27' }, { accountId: 'acme', dayKey: '2026-06-28' },
        { accountId: 'globex', dayKey: '2026-06-26' }, { accountId: 'globex', dayKey: '2026-06-27' }, { accountId: 'globex', dayKey: '2026-06-28' },
      ],
      cellCoverers: {
        'acme__2026-06-26': { uid: 'me', displayName: U.displayName, photoURL: null },
        'globex__2026-06-26': { uid: 'ana', displayName: OTHER.displayName, photoURL: null },
      },
      selectedDayKeys: ['2026-06-26', '2026-06-27', '2026-06-28'], dayCoverers: {},
      coverers: [{ uid: 'me', displayName: U.displayName, photoURL: null }, { uid: 'ana', displayName: OTHER.displayName, photoURL: null }],
      reachability: ['phone-emergencies'], coverageKinds: ['inbox'], coverageScope: null, sla: 'x', emergencyDef: null,
      meetings: [], createdAt: ts(-3600e3), updatedAt: ts(-600e3) },
  ];
  s.scrolls = empty ? [] : [
    { id: 's1', fromUid: 'ana', fromDisplayName: OTHER.displayName, fromPhotoURL: null,
      toUid: 'me', toDisplayName: U.displayName, toPhotoURL: null,
      message: '¡Gracias por cubrir la escalación P1!', reactions: { me: '🪙', luis: '🍻' }, createdAt: ts(-3600e3) },
    { id: 's2', fromUid: 'me', fromDisplayName: U.displayName, fromPhotoURL: null,
      toUid: 'ana', toDisplayName: OTHER.displayName, toPhotoURL: null,
      message: 'Impecable la semana pasada.', reactions: {}, createdAt: ts(-2 * 86400e3) },
  ];
  s.crewMembers = empty ? [] : [
    { uid: 'me', displayName: U.displayName, photoURL: null, avatarId: 'm1', role: 'manager', lifetimeEarned: 137, earnedLast90d: 40, voyages: 6 },
    { uid: 'ana', displayName: OTHER.displayName, photoURL: null, avatarId: null, role: 'member', lifetimeEarned: 260, earnedLast90d: 90, voyages: 12 },
    { uid: 'luis', displayName: 'Luis Pérez', photoURL: null, avatarId: 'f2', role: 'member', lifetimeEarned: 8, earnedLast90d: 8, voyages: 1 },
  ];
  s.crewMembersLoading = false;
  s.leaderboard = empty ? null : {
    windowDays: 90, generatedAtMs: now - 60e3,
    entries: [
      { uid: 'ana', displayName: OTHER.displayName, photoURL: null, earnedInWindow: 90, voyages: 12 },
      { uid: 'me', displayName: U.displayName, photoURL: null, earnedInWindow: 40, voyages: 6 },
      { uid: 'luis', displayName: 'Luis Pérez', photoURL: null, earnedInWindow: 8, voyages: 1 },
      { uid: 'x1', displayName: 'Marta Ruiz', photoURL: null, earnedInWindow: 5, voyages: 1 },
      { uid: 'x2', displayName: 'Chen Wei', photoURL: null, earnedInWindow: 3, voyages: 1 },
    ],
  };
  s.leaderboardLoading = false;
  s.auditLog = empty ? [] : [
    { id: 'a1', action: 'cancelBounty', actorUid: 'me', actorName: U.displayName, target: 'b6', targetName: null, details: { reason: 'duplicado' }, createdAtMs: now - 3600e3 },
    { id: 'a2', action: 'updateMemberRole', actorUid: 'me', actorName: U.displayName, target: 'ana', targetName: OTHER.displayName, details: { from: 'member', to: 'manager' }, createdAtMs: now - 7200e3 },
    { id: 'a3', action: 'grantBonusDoubloons', actorUid: 'me', actorName: U.displayName, target: 'luis', targetName: 'Luis Pérez', details: { amount: 20, reason: 'gran cobertura' }, createdAtMs: now - 86400e3 },
    { id: 'a4', action: 'forceCompleteBounty', actorUid: 'me', actorName: U.displayName, target: 'b5', targetName: null, details: { coinsReleased: 15, daysReleased: 3 }, createdAtMs: now - 2 * 86400e3 },
    { id: 'a5', action: 'createInviteToken', actorUid: 'me', actorName: U.displayName, target: null, targetName: null, details: null, createdAtMs: now - 3 * 86400e3 },
    { id: 'a6', action: 'removeMember', actorUid: 'me', actorName: U.displayName, target: 'x9', targetName: 'Ex Member', details: null, createdAtMs: now - 4 * 86400e3 },
    { id: 'a7', action: 'memberLeftViaAccountDeletion', actorUid: 'x8', actorName: 'Gone User', target: 'x8', targetName: 'Gone User', details: null, createdAtMs: now - 5 * 86400e3 },
  ];
  s.auditLogLoading = false;
  s.crewSettings = { hasGeminiKey: true, geminiKeyLast4: 'ab12', geminiKeySetAtMs: now - 86400e3 };
  s.crewSettingsLoading = false;
  s.formState = {
    ...s.formState,
    startDate: '2026-06-15', endDate: '2026-06-19', timezone: 'Europe/Madrid',
    reachability: ['unreachable'], coverageKinds: ['inbox', 'meetings'],
    coverageScope: 'Acme', sla: 'P1 < 2h', emergencyDef: '',
    selectedDayKeys: ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19'],
    coverageMode: 'single', meetings: [],
    accountIds: [], selectedCells: [], cellsTouched: false,
  };
  s.calendarEvents = [];
  s.claim = s.claim || {};
  s.claim.bountyId = 'b2';
  s.claim.selectedDayKeys = ['2026-06-24'];
  s.density = 'comfortable';
  s.notifLastSeen = 0;
}

// ---------------------------------------------------------------------
// 5. Assertions
// ---------------------------------------------------------------------
const failures = [];
let checks = 0;

function scan(label, rootEl) {
  checks++;
  const text = rootEl.textContent || '';
  const html = rootEl.innerHTML || '';
  const problems = [];
  if (/\bundefined\b/.test(text)) problems.push('leaked "undefined"');
  if (text.includes('[object')) problems.push('leaked [object …]');
  if (/\bNaN\b/.test(text)) problems.push('leaked NaN');
  const placeholder = text.match(/\{[a-zA-Z]+\}/);
  if (placeholder) problems.push(`un-interpolated placeholder ${placeholder[0]}`);
  if (html.includes('${')) problems.push('broken template literal (raw ${ in HTML)');
  if (/&lt;(strong|code|a|em)\b/.test(html)) problems.push('double-escaped HTML tag visible as text');
  for (const p of problems) {
    const ctx = text.replace(/\s+/g, ' ').slice(0, 160);
    failures.push({ label, problem: p, ctx });
  }
}

function run(label, fn) {
  checks++;
  try {
    fn();
  } catch (err) {
    failures.push({ label, problem: `THREW: ${err.message}`, ctx: (err.stack || '').split('\n')[1]?.trim() ?? '' });
  }
}

const app = () => window.document.getElementById('app');
const modalRoot = () => window.document.getElementById('modal-root');

function renderAndScan(label, mustContain) {
  run(label, () => T.render());
  scan(label, app());
  const text = app().textContent || '';
  if (text.trim().length < 10) {
    failures.push({ label, problem: 'render produced (near-)empty output', ctx: '' });
  }
  if (mustContain && !text.includes(mustContain)) {
    failures.push({ label, problem: `canary missing: expected to find "${mustContain}"`, ctx: text.replace(/\s+/g, ' ').slice(0, 160) });
  }
}

function openModalAndScan(label, opener) {
  run(label, opener);
  const m = modalRoot();
  if (!m.querySelector('.modal')) {
    failures.push({ label, problem: 'modal did not open', ctx: '' });
  } else {
    scan(label, m);
  }
  run(`${label} (close)`, () => T.closeAllModals());
}

// ---------------------------------------------------------------------
// 6. Drive matrix
// ---------------------------------------------------------------------
// Language canaries prove translations actually flow end-to-end (a false
// pass from rendering stale/english content in ES mode gets caught here).
// Unplugged is plain-voice only + a restructured shell (sidebar nav). Voice is
// fixed, so the pirate/plain iterations render identically — both canary sets
// point at the current plain labels.
const C_EN = { login: 'Sign in with Google', home: 'Your Teams', bounties: 'Post a request', chest: 'Wallet', wof: 'Leaderboard', members: 'Team', post: 'Post a request', settings: 'Team settings', help: 'credit' };
const C_ES = { login: 'Iniciar sesión con Google', home: 'Tus equipos', bounties: 'Publicar una solicitud', chest: 'Cartera', wof: 'Clasificación', members: 'Equipo', post: 'Publicar una solicitud', settings: 'Ajustes del equipo', help: 'crédito' };
const CANARY = {
  pirate: { en: C_EN, es: C_ES },
  plain: { en: C_EN, es: C_ES },
};

for (const vlang of ['pirate:en', 'pirate:es', 'plain:en', 'plain:es']) {
  const [vc, l] = vlang.split(':');
  T.voice.set(vc);
  T.lang.set(l);
  const L = `[${vc}/${l}]`;
  const C = CANARY[vc][l];

  // Logged-out login screen
  T.state.authReady = true;
  T.state.user = null;
  T.state.view = 'login';
  renderAndScan(`${L} login`, C.login);

  // Seeded, full state
  seedState();
  T.state.view = 'home';
  renderAndScan(`${L} home`, C.home);

  T.state.view = 'team';
  for (const tab of ['bounties', 'chest', 'wof', 'members', 'post', 'settings']) {
    T.state.teamTab = tab;
    renderAndScan(`${L} team/${tab}`, C[tab]);
  }

  // Board variants
  T.state.teamTab = 'bounties';
  for (const f of ['open', 'taken', 'done', 'mine']) {
    T.state.bountyFilter = f;
    renderAndScan(`${L} board filter=${f}`);
  }
  T.state.bountyFilter = 'all';
  T.state.density = 'compact';
  renderAndScan(`${L} board compact`);
  T.state.density = 'comfortable';
  T.state.bountyFilterText = 'ana';
  renderAndScan(`${L} board search`);
  T.state.bountyFilterText = '';

  // Header + bell
  run(`${L} header`, () => T.renderUserInfo());
  scan(`${L} header`, window.document.getElementById('user-info'));
  T.state.bellOpen = true;
  run(`${L} bell open`, () => T.renderUserInfo());
  scan(`${L} bell open`, window.document.getElementById('user-info'));
  T.state.bellOpen = false;

  // Help page
  T.state.view = 'help';
  renderAndScan(`${L} help`, C.help);
  T.state.view = 'team';
  T.state.teamTab = 'bounties';
  T.render();

  // Modals
  openModalAndScan(`${L} profile sheet`, () => T.showAvatarPicker());
  openModalAndScan(`${L} bounty detail open(single)`, () => T.showBountyDetail('b1'));
  openModalAndScan(`${L} bounty detail crew`, () => T.showBountyDetail('b2'));
  openModalAndScan(`${L} bounty detail mine-accepted`, () => T.showBountyDetail('b3'));
  openModalAndScan(`${L} bounty detail covering-active`, () => T.showBountyDetail('b4'));
  openModalAndScan(`${L} bounty detail completed`, () => T.showBountyDetail('b5'));
  openModalAndScan(`${L} bounty detail cancelled`, () => T.showBountyDetail('b6'));
  openModalAndScan(`${L} send scroll`, () => T.showSendScrollModal('ana', OTHER.displayName, 'b5'));
  openModalAndScan(`${L} grant bonus`, () => T.showGrantBonusModal('luis', 'Luis Pérez'));
  openModalAndScan(`${L} member admin`, () => T.showMemberAdminModal(T.state.crewMembers[1]));
  openModalAndScan(`${L} edit bounty`, () => T.showEditBountyModal('b1'));
  openModalAndScan(`${L} delete account`, () => T.showDeleteAccountModal());
  openModalAndScan(`${L} disband crew`, () => T.showDisbandCrewModal(T.state.myTeams[0]));
  openModalAndScan(`${L} manage crew`, () => T.showManageCrewModal(T.state.myTeams[0]));
  openModalAndScan(`${L} cancel confirm`, () => T.confirmCancelBounty('b3'));
  openModalAndScan(`${L} top-up confirm`, () => T.topUpGrantAction());
  openModalAndScan(`${L} stan scene`, () => T.showWelcomeModal());
  run(`${L} crew claim`, () => T.startCrewClaim('b2'));
  scan(`${L} crew claim`, modalRoot());
  run(`${L} crew claim close`, () => { modalRoot().innerHTML = ''; });

  // Account-split UI (the account × day matrix post form is rendered by
  // team/post above, since myAccounts is seeded).
  openModalAndScan(`${L} bounty detail cells`, () => T.showBountyDetail('b7'));
  run(`${L} crew claim cells`, () => T.startCrewClaim('b7'));
  scan(`${L} crew claim cells`, modalRoot());
  run(`${L} crew claim cells close`, () => { modalRoot().innerHTML = ''; });
  run(`${L} accounts editor`, () => T.showAccountsEditor());
  scan(`${L} accounts editor`, modalRoot());
  run(`${L} accounts editor close`, () => { modalRoot().innerHTML = ''; });

  // Cinematic (every rank, incl. Commodore golden variant)
  for (const rank of T.RANKS) {
    run(`${L} cinematic ${rank.name}`, () => {
      T.showRankCinematic(rank, { silent: true });
      const cine = window.document.querySelector('.cine');
      if (!cine) throw new Error('cinematic did not mount');
      scan(`${L} cinematic ${rank.name}`, cine);
      cine.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      window.document.querySelectorAll('.cine').forEach((el) => el.remove());
    });
  }

  // Toast + coin shower (no anchors present)
  run(`${L} toast`, () => T.showToast('prueba', 'success'));
  run(`${L} coin shower`, () => T.launchCoinShower('+5'));

  // Empty states
  seedState({ empty: true });
  T.state.view = 'team';
  for (const tab of ['bounties', 'chest', 'wof', 'members']) {
    T.state.teamTab = tab;
    renderAndScan(`${L} empty ${tab}`);
  }
  T.state.myTeams = [];
  T.state.view = 'home';
  renderAndScan(`${L} empty home`);
}

// ---------------------------------------------------------------------
// 7. Report
// ---------------------------------------------------------------------
console.log(`smoke: ${checks} checks across pirate+plain × en+es`);
if (failures.length === 0) {
  console.log('smoke: ✓ all screens render clean in both voices and languages');
  process.exit(0);
}
console.error(`smoke: ✗ ${failures.length} failure(s)`);
for (const f of failures) {
  console.error(`  [${f.label}] ${f.problem}${f.ctx ? `\n      ${f.ctx}` : ''}`);
}
process.exit(1);
