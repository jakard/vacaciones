// Dev-only: render real screens (home teams-list, empty state, login, board)
// to standalone HTML for browser screenshots. Reuses the smoke harness setup.
import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const APP = new URL('../../app/app.js', import.meta.url);
const ES_DICT = new URL('../../app/i18n-es.js', import.meta.url);
const INDEX = new URL('../../app/index.html', import.meta.url);
const PLAIN_DICT = new URL('../../app/i18n-plain.js', import.meta.url);

let src = readFileSync(APP, 'utf8');
const esSrc = readFileSync(ES_DICT, 'utf8').replace(/^export const ES =/m, 'const TRANSLATIONS_ES =');
const plainSrc = readFileSync(PLAIN_DICT, 'utf8').replace(/^export const PLAIN =/m, 'const PLAIN =');
const importAnchor = "import { firebaseConfig } from './firebase-config.js';";
src = src.slice(src.indexOf('\n', src.indexOf(importAnchor)) + 1);

const stubs = `
const initializeApp=()=>({}),getAuth=()=>({}),GoogleAuthProvider=class{static credentialFromResult(){return null}};
let __cb=null;const onAuthStateChanged=(a,cb)=>{__cb=cb;return()=>{}};
const signInWithPopup=async()=>({user:null}),signOut=async()=>{};
const getFirestore=()=>({}),collection=(...a)=>({a}),doc=(...a)=>({a}),query=(...a)=>({a});
const where=(...a)=>({a}),orderBy=(...a)=>({a}),limit=(n)=>({n}),startAfter=(c)=>({c});
const onSnapshot=()=>()=>{},getDocs=async()=>({empty:true,docs:[]}),getFunctions=()=>({});
const httpsCallableFromURL=()=>async()=>({data:{}});
${esSrc}
${plainSrc}
const firebaseConfig={projectId:'demo',appId:'1:0:web:0',apiKey:'demo',authDomain:'d.firebaseapp.com',messagingSenderId:'0',storageBucket:'d.appspot.com'};
`;
const bridge = `;globalThis.__TO={state,render};`;

const html = readFileSync(INDEX, 'utf8').replace(/<script[^>]*src="app\.js"[^>]*><\/script>/, '');
const dom = new JSDOM(html, { url: 'https://timeoff.test/', pretendToBeVisual: true });
const { window } = dom;
for (const k of ['document','localStorage','navigator','location','history','requestAnimationFrame','cancelAnimationFrame','HTMLElement','Node','CustomEvent']) {
  if (window[k] === undefined) continue;
  try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); } catch {}
}
globalThis.window = window;
window.matchMedia = window.matchMedia || ((q) => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }));
globalThis.matchMedia = window.matchMedia;
window.AudioContext = class { createOscillator(){return{connect(){},start(){},stop(){},frequency:{value:0},type:''}} createGain(){return{connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},value:0}}} get currentTime(){return 0} get destination(){return{}} };
globalThis.AudioContext = window.AudioContext;
globalThis.requestAnimationFrame = window.requestAnimationFrame || ((cb)=>setTimeout(cb,0));
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async()=>{} }, configurable: true });

const b64 = Buffer.from(stubs + src + bridge, 'utf8').toString('base64');
await import(`data:text/javascript;base64,${b64}`);
const T = globalThis.__TO;
const s = T.state;

const now = Date.now();
const ts = (o) => { const d = new Date(now + o); return { toDate: () => d, toMillis: () => d.getTime() }; };
const U = { uid: 'me', displayName: 'Raul Sosa', email: 'raul@example.com', photoURL: null };

function base() {
  s.authReady = true; s.user = { ...U }; s.userDoc = { digestEnabled: true };
  s.lang = 'en'; s.bellOpen = false; s.ledger = []; s.bounties = []; s.bountiesLoaded = true; s.scrolls = [];
  s.crewMembers = []; s.leaderboard = null; s.myAccounts = [];
}
function seedHome({ empty = false } = {}) {
  base(); s.view = 'home';
  s.myTeams = empty ? [] : [
    { id: 'andes', name: 'Equipo Andes', memberUids: ['me','ana','luis'], ownerUid: 'me', photoURL: null },
    { id: 'nube', name: 'Cloud West', memberUids: ['me','ana'], ownerUid: 'ana', photoURL: null },
  ];
}
function seedBoard() {
  base(); s.view = 'team'; s.teamId = 'andes'; s.teamTab = 'bounties';
  s.bountyFilter = 'all'; s.bountyFilterText = ''; s.myRole = 'manager';
  s.myTeams = [{ id: 'andes', name: 'Equipo Andes', memberUids: ['me','ana','luis'], ownerUid: 'me', photoURL: null }];
  s.currentTeam = s.myTeams[0];
  s.walletDoc = { earnedBalance: 137, stipendBalance: 11 };
  s.bounties = [
    { id:'b1', status:'open', requesterUid:'ana', requesterDisplayName:'Ana García', requesterPhotoURL:null,
      windowStart:ts(864e5), windowEnd:ts(5*864e5), timezone:'Europe/Madrid', totalCoinsOffered:25, coinsEscrowed:0, coinsReleased:0,
      coverageMode:'single', selectedDayKeys:['2026-07-13','2026-07-14','2026-07-15','2026-07-16','2026-07-17'], dayCoverers:{}, coverers:[],
      reachability:['unreachable'], coverageKinds:['inbox','meetings'], coverageScope:'Acme + 2 SMBs', sla:'P1 < 2h', emergencyDef:'Prod down', meetings:[], createdAt:ts(-36e5), updatedAt:ts(-36e5) },
    { id:'b2', status:'accepted', requesterUid:'me', requesterDisplayName:'Raul Sosa', requesterPhotoURL:null,
      covererUid:'ana', covererDisplayName:'Ana García', covererPhotoURL:null,
      windowStart:ts(2*864e5), windowEnd:ts(4*864e5), timezone:'UTC', totalCoinsOffered:15, coinsEscrowed:15, coinsReleased:0,
      coverageMode:'single', selectedDayKeys:['2026-07-20','2026-07-21','2026-07-22'], dayCoverers:{}, coverers:[{uid:'ana',displayName:'Ana García',photoURL:null}],
      reachability:['daily-check-in'], coverageKinds:['chat'], coverageScope:'My 1:1s', sla:'24h', emergencyDef:'P0', meetings:[], createdAt:ts(-864e5), updatedAt:ts(-6e5) },
    { id:'b3', status:'completed', requesterUid:'me', requesterDisplayName:'Raul Sosa', requesterPhotoURL:null,
      covererUid:'luis', covererDisplayName:'Luis Pérez', covererPhotoURL:null,
      windowStart:ts(-10*864e5), windowEnd:ts(-6*864e5), timezone:'UTC', totalCoinsOffered:25, coinsEscrowed:25, coinsReleased:25,
      coverageMode:'single', selectedDayKeys:['2026-06-20'], dayCoverers:{}, coverers:[], reachability:['unreachable'], coverageKinds:[], coverageScope:null, sla:'x', emergencyDef:null, meetings:[], createdAt:ts(-11*864e5), updatedAt:ts(-6*864e5) },
  ];
  s.prevLedgerIds = new Set();
}

function page(title) {
  const body = document.body.innerHTML.replace(/<header([^>]*)\shidden/, '<header$1');
  return `<!doctype html><html lang="en" data-skin="unplugged"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css"></head><body>${body}</body></html>`;
}

const OUT = new URL('../../app/', import.meta.url);
seedHome(); T.render(); writeFileSync(new URL('_prev-home.html', OUT), page('Home — teams'));
seedHome({ empty: true }); T.render(); writeFileSync(new URL('_prev-empty.html', OUT), page('Home — empty'));
seedBoard(); T.render(); writeFileSync(new URL('_prev-board.html', OUT), page('Team board'));
// Error state (false-empty fix): board failed to load.
seedBoard(); s.bounties = []; s.bountiesLoaded = false; s.bountiesError = 'You appear to be offline. Trying to reconnect…';
T.render(); writeFileSync(new URL('_prev-board-error.html', OUT), page('Team board — error'));
// Loading state: subscription not yet resolved.
seedBoard(); s.bounties = []; s.bountiesLoaded = false; s.bountiesError = null;
T.render(); writeFileSync(new URL('_prev-board-loading.html', OUT), page('Team board — loading'));
base(); s.view = 'login'; T.render(); writeFileSync(new URL('_prev-login.html', OUT), page('Login'));
console.log('wrote _prev-home/empty/board/board-error/board-loading/login.html');
