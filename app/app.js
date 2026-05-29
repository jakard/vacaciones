import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import {
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {
  getFunctions,
  httpsCallableFromURL,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js';

/* ============================================================
   Config
   ============================================================ */

const firebaseConfig = {
  projectId: 'vacaciones-dev-b3158',
  appId: '1:1000746698778:web:0f498b2ad533327a9b69a3',
  storageBucket: 'vacaciones-dev-b3158.firebasestorage.app',
  apiKey: 'AIzaSyDdJsNemH83qjri-EOUURBPD4sQA2qkayg',
  authDomain: 'vacaciones-dev-b3158.firebaseapp.com',
  messagingSenderId: '1000746698778',
};

const ECONOMY = {
  ONBOARDING_GRANT: 20,
  MONTHLY_STIPEND: 10,
  COVERAGE_PRICE_PER_DAY: 5,
  WEEKEND_MULTIPLIER: 2,
  TRANSACTION_FEE: 1,
};

const REACHABILITY_OPTIONS = [
  { value: 'unreachable', short: 'Unreachable', label: 'Unreachable — true shore leave', icon: '🌴' },
  { value: 'email-only-emergencies', short: 'Email', label: 'Email only, emergencies', icon: '📧' },
  { value: 'phone-emergencies', short: 'Phone', label: 'Phone for P1 emergencies', icon: '📞' },
  { value: 'daily-check-in', short: 'Daily check-in', label: 'Daily check-in', icon: '📅' },
];

const COVERAGE_KIND_OPTIONS = [
  { value: 'inbox', label: 'Inbox / email', icon: '📬' },
  { value: 'meetings', label: 'Standing meetings', icon: '📅' },
  { value: 'escalations', label: 'Open escalations', icon: '🔥' },
  { value: 'one-on-ones', label: 'Customer 1:1s', icon: '🤝' },
  { value: 'chat', label: 'Slack / Chat', icon: '💬' },
  { value: 'on-call', label: 'On-call rotation', icon: '📟' },
];

const LEDGER_TYPE_LABELS = {
  grant: 'Welcome chest',
  stipendMint: 'Crown’s stipend',
  stipendExpire: 'Stipend expired',
  escrowIn: 'Bounty posted (escrow)',
  escrowOut: 'Bounty refunded',
  coverageRelease: 'Covered a crewmate',
  feeBurn: 'Harbour fee',
  managerAdvance: 'Captain’s advance',
};

const STATUS_LABEL = {
  open: 'OPEN',
  accepted: 'TAKEN',
  active: 'ACTIVE',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  draft: 'DRAFT',
};
const STATUS_PRIORITY = { open: 0, accepted: 1, active: 2, completed: 3, draft: 4, cancelled: 5 };

const STAN_SCENES = [
  { speech: "Ahoy! I'm Stan, harbormaster of Mêlée Bay. New deckhand, are ye? Let me show ye the ropes." },
  { speech: "Doubloons are how we trade coverage. 5 buy ye one day of shore leave. Weekend? Twice as dear — the Crown insists." },
  { speech: "Every month the Crown drops 10 stipend coins in yer purse. Spend 'em or watch 'em vanish at month's end. Don't be a hoarder." },
  { speech: "Cover a crewmate's bounty and earn their doubloons as the days pass. Patience, sailor — payouts release one day at a time." },
  { speech: "Top earners over 90 days get the captain's hat on the Wall of Fame. Now hoist a crew and post yer first bounty!" },
];

const MASCOT_LINES = [
  '"Ahoy, weary TAM!"',
  '"Coins, or coverage?"',
  '"Need a week ashore?"',
  '"Even pirates take leave."',
  '"Doubloons jingle softly."',
];

// Voyage rank ladder, by lifetime earned doubloons
const RANKS = [
  { min: 0,    name: 'Cabin Boy',     icon: '🧒' },
  { min: 10,   name: 'Deckhand',      icon: '⚓' },
  { min: 25,   name: 'Mate',          icon: '🪢' },
  { min: 50,   name: 'Bosun',         icon: '🎺' },
  { min: 100,  name: 'Quartermaster', icon: '📜' },
  { min: 200,  name: 'First Mate',    icon: '🪙' },
  { min: 400,  name: 'Captain',       icon: '👑' },
  { min: 800,  name: 'Commodore',     icon: '⚔️' },
];

// Achievement definitions (tested against derived stats)
const ACHIEVEMENTS = [
  { id: 'set-sail',         name: 'Set Sail',         icon: '🌅', test: (s) => s.voyages >= 1 },
  { id: 'old-salt',         name: 'Old Salt',         icon: '⚓', test: (s) => s.voyages >= 10 },
  { id: 'captain-hat',      name: "Captain's Hat",    icon: '🎩', test: (s) => s.lifetimeEarned >= 100 },
  { id: 'treasure-hunter',  name: 'Treasure Hunter',  icon: '💎', test: (s) => s.lifetimeEarned >= 500 },
  { id: 'weekend-warrior',  name: 'Weekend Warrior',  icon: '🌊', test: (s) => s.weekendCovers >= 1 },
  { id: 'generous',         name: 'Generous Sea Dog', icon: '📜', test: (s) => s.bountiesPosted >= 5 },
  { id: 'free-spirit',      name: 'Live Free',        icon: '🔥', test: (s) => s.stipendExpired >= 1 },
  { id: 'loyal-crew',       name: 'Loyal Crew',       icon: '🏴', test: (s) => s.crewCount >= 2 },
];

/* ============================================================
   Firebase
   ============================================================ */

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const functions = getFunctions(fbApp, 'us-central1');

const callableURL = (name) => `${location.origin}/api/${name}`;
const callInitUser = httpsCallableFromURL(functions, callableURL('initUser'));
const callCreateTeam = httpsCallableFromURL(functions, callableURL('createTeam'));
const callJoinTeam = httpsCallableFromURL(functions, callableURL('joinTeam'));
const callCreateCoverageRequest = httpsCallableFromURL(functions, callableURL('createCoverageRequest'));
const callAcceptCoverageRequest = httpsCallableFromURL(functions, callableURL('acceptCoverageRequest'));
const callGetLeaderboard = httpsCallableFromURL(functions, callableURL('getLeaderboard'));
const callSendScroll = httpsCallableFromURL(functions, callableURL('sendScroll'));

/* ============================================================
   Sound module (Web Audio chiptune SFX)
   ============================================================ */

const audio = {
  ctx: null,
  enabled: localStorage.getItem('vacaciones.sound') === 'on',
  init() {
    if (this.ctx || !this.enabled) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { this.ctx = null; }
  },
  tone(freq, duration, type = 'square', gain = 0.05, freq2) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freq2 != null) osc.frequency.exponentialRampToValueAtTime(freq2, t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  },
  click() { this.tone(220, 0.06, 'square', 0.04, 110); },
  coin() { this.tone(880, 0.05, 'square', 0.07); setTimeout(() => this.tone(1320, 0.10, 'square', 0.06), 45); },
  toast() { this.tone(660, 0.06, 'triangle', 0.04, 990); },
  rank() { this.tone(440, 0.1, 'triangle', 0.06); setTimeout(() => this.tone(660, 0.12, 'triangle', 0.06), 90); setTimeout(() => this.tone(880, 0.20, 'triangle', 0.06), 200); },
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('vacaciones.sound', this.enabled ? 'on' : 'off');
    if (this.enabled) { this.init(); this.tone(440, 0.1, 'triangle', 0.05); }
  },
};

/* ============================================================
   State
   ============================================================ */

const state = {
  authReady: false,
  user: null,
  view: 'login',
  teamId: null,
  teamTab: 'bounties',
  bountyFilter: 'all',
  myTeams: [],
  walletDoc: null,
  ledger: [],
  prevLedgerIds: new Set(),
  bounties: [],
  scrolls: [],
  leaderboard: null,
  leaderboardLoading: false,
  onboardingScene: 0,
  bellOpen: false,
  notifLastSeen: Number(localStorage.getItem('vacaciones.notifLastSeen') || '0'),
  achievedIds: new Set(JSON.parse(localStorage.getItem('vacaciones.achievedIds') || '[]')),
  formState: {
    startDate: '',
    endDate: '',
    timezone: '',
    reachability: ['email-only-emergencies'],
    coverageKinds: [],
    coverageScope: '',
    sla: 'P1 within 2h, P2 next business day',
    emergencyDef: '',
  },
  busy: { signIn: false, createTeam: false, joinTeam: false, postRequest: false, acceptId: null },
};

let unsubTeams = null;
let unsubWallet = null;
let unsubLedger = null;
let unsubRequests = null;
let unsubScrolls = null;

/* ============================================================
   Utilities
   ============================================================ */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function parseLocalDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}
function computeCoverageCost(start, end) {
  if (!start || !end || end < start) return { totalCoins: 0, weekdays: 0, weekendDays: 0, days: 0 };
  const cursor = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  let totalCoins = 0, weekdays = 0, weekendDays = 0, days = 0;
  while (cursor.getTime() <= last.getTime()) {
    const dow = cursor.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    totalCoins += ECONOMY.COVERAGE_PRICE_PER_DAY * (weekend ? ECONOMY.WEEKEND_MULTIPLIER : 1);
    if (weekend) weekendDays++; else weekdays++;
    days++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { totalCoins, weekdays, weekendDays, days };
}
function formatDate(d) {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function timeAgo(d) {
  if (!d) return '';
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}
function firstName(name) {
  if (!name) return 'sailor';
  return name.split(' ')[0] ?? name;
}
function shortName(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
}
function pickMascotLine() { return MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)]; }
function arr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return [val];
  return [];
}

/* ============================================================
   Derived stats — rank, achievements, notifications
   ============================================================ */

function computeStats() {
  const ledger = state.ledger || [];
  const lifetimeEarned = ledger
    .filter((e) => e.type === 'coverageRelease')
    .reduce((s, e) => s + (e.amountSigned || 0), 0);
  const voyages = ledger.filter((e) => e.type === 'coverageRelease').length;
  const weekendCovers = ledger.filter((e) => e.type === 'coverageRelease' && e.amountSigned >= ECONOMY.COVERAGE_PRICE_PER_DAY * ECONOMY.WEEKEND_MULTIPLIER).length;
  const bountiesPosted = ledger.filter((e) => e.type === 'escrowIn').length;
  const stipendExpired = ledger.filter((e) => e.type === 'stipendExpire').length;
  const crewCount = state.myTeams.length;
  return { lifetimeEarned, voyages, weekendCovers, bountiesPosted, stipendExpired, crewCount };
}

function computeRank(stats) {
  let cur = RANKS[0];
  for (const r of RANKS) {
    if (stats.lifetimeEarned >= r.min) cur = r;
    else break;
  }
  const next = RANKS.find((r) => r.min > stats.lifetimeEarned);
  return {
    ...cur,
    nextMin: next?.min ?? null,
    nextName: next?.name ?? null,
    progress: next ? Math.min(1, (stats.lifetimeEarned - cur.min) / (next.min - cur.min)) : 1,
    toNext: next ? next.min - stats.lifetimeEarned : 0,
  };
}

function computeAchievements(stats) {
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: a.test(stats) }));
}

function persistAchievements(unlocked) {
  // Detect newly unlocked, fire toast + sound, persist
  const newOnes = unlocked.filter((a) => a.unlocked && !state.achievedIds.has(a.id));
  for (const a of newOnes) {
    state.achievedIds.add(a.id);
    showToast(`${a.icon}  Achievement unlocked: ${a.name}`, 'success', 5000);
    audio.rank();
  }
  if (newOnes.length > 0) {
    localStorage.setItem('vacaciones.achievedIds', JSON.stringify(Array.from(state.achievedIds)));
  }
}

function computeNotifications() {
  // Derive from ledger + bounties. Each notif has { kind, icon, text, meta, time }
  const notifs = [];
  for (const entry of state.ledger.slice(0, 15)) {
    const t = entry.createdAt?.toDate?.();
    if (!t) continue;
    if (entry.type === 'coverageRelease') {
      notifs.push({ kind: 'coin', icon: '🪙', text: `Earned ${entry.amountSigned} doubloons by covering.`, time: t });
    } else if (entry.type === 'grant') {
      notifs.push({ kind: 'grant', icon: '🎁', text: `Welcome chest opened (+${entry.amountSigned} doubloons).`, time: t });
    } else if (entry.type === 'stipendMint') {
      notifs.push({ kind: 'stipend', icon: '👑', text: `Crown's stipend: +${entry.amountSigned} doubloons (expire monthly).`, time: t });
    } else if (entry.type === 'feeBurn') {
      notifs.push({ kind: 'fee', icon: '🔥', text: `Harbour fee: ${entry.amountSigned} doubloons.`, time: t });
    }
  }
  // Recent open bounties from other crewmates
  for (const b of state.bounties.filter((b) => b.status === 'open' && b.requesterUid !== state.user?.uid).slice(0, 10)) {
    const t = b.createdAt?.toDate?.();
    if (!t) continue;
    notifs.push({
      kind: 'bounty',
      icon: '📜',
      text: `${shortName(b.requesterDisplayName || 'A crewmate')} posted a ${b.totalCoinsOffered}-doubloon bounty.`,
      meta: 'Open · take voyage',
      time: t,
    });
  }
  // Status changes on your own bounties
  for (const b of state.bounties.filter((b) => b.requesterUid === state.user?.uid && b.covererUid)) {
    const t = b.updatedAt?.toDate?.();
    if (!t) continue;
    notifs.push({
      kind: 'taken',
      icon: '⚓',
      text: `${shortName(b.covererDisplayName || 'A crewmate')} took your ${b.totalCoinsOffered}-doubloon bounty.`,
      time: t,
    });
  }
  notifs.sort((a, b) => b.time.getTime() - a.time.getTime());
  return notifs.slice(0, 20);
}

/* ============================================================
   SVG sprites
   ============================================================ */

const SVG = {
  doubloon: `<svg viewBox="0 0 16 16" aria-hidden="true">
    <rect x="3" y="1" width="10" height="1" fill="#5A3A1F"/>
    <rect x="2" y="2" width="12" height="1" fill="#5A3A1F"/>
    <rect x="1" y="3" width="14" height="10" fill="#5A3A1F"/>
    <rect x="2" y="13" width="12" height="1" fill="#5A3A1F"/>
    <rect x="3" y="14" width="10" height="1" fill="#5A3A1F"/>
    <rect x="3" y="3" width="10" height="10" fill="#FFCB47"/>
    <rect x="4" y="4" width="8" height="8" fill="#E0A93B"/>
    <rect x="6" y="5" width="1" height="6" fill="#8C6418"/>
    <rect x="9" y="5" width="1" height="6" fill="#8C6418"/>
    <rect x="6" y="7" width="4" height="1" fill="#8C6418"/>
    <rect x="6" y="9" width="4" height="1" fill="#8C6418"/>
    <rect x="4" y="4" width="2" height="1" fill="#FFD86B"/>
  </svg>`,
  flag: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="6" y="3" width="2" height="26" fill="#5A3A1F"/>
    <rect x="8" y="5" width="18" height="12" fill="#C8362D"/>
    <rect x="8" y="5" width="18" height="2" fill="#E25347"/>
    <rect x="11" y="9" width="4" height="4" fill="#F7E7C2"/>
    <rect x="11" y="13" width="2" height="2" fill="#1A0E08"/>
    <rect x="14" y="13" width="2" height="2" fill="#1A0E08"/>
    <rect x="12" y="11" width="3" height="1" fill="#1A0E08"/>
    <rect x="17" y="11" width="6" height="2" fill="#1A0E08"/>
  </svg>`,
  turtle: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="8" y="11" width="16" height="9" fill="#5A3A1F"/>
    <rect x="7" y="12" width="18" height="7" fill="#8C6418"/>
    <rect x="8" y="13" width="16" height="5" fill="#A57B36"/>
    <rect x="10" y="14" width="2" height="2" fill="#5A3A1F"/>
    <rect x="14" y="14" width="2" height="2" fill="#5A3A1F"/>
    <rect x="18" y="14" width="2" height="2" fill="#5A3A1F"/>
    <rect x="20" y="14" width="2" height="2" fill="#5A3A1F"/>
    <rect x="4" y="14" width="4" height="4" fill="#2A6A1E"/>
    <rect x="3" y="15" width="1" height="2" fill="#2A6A1E"/>
    <rect x="5" y="15" width="1" height="1" fill="#F7E7C2"/>
    <rect x="6" y="15" width="1" height="1" fill="#1A0E08"/>
    <rect x="4" y="12" width="6" height="2" fill="#1A0E08"/>
    <rect x="3" y="13" width="8" height="1" fill="#1A0E08"/>
    <rect x="6" y="11" width="2" height="1" fill="#1A0E08"/>
    <rect x="5" y="13" width="1" height="1" fill="#E0A93B"/>
    <rect x="9" y="20" width="2" height="3" fill="#2A6A1E"/>
    <rect x="21" y="20" width="2" height="3" fill="#2A6A1E"/>
    <rect x="24" y="14" width="2" height="2" fill="#2A6A1E"/>
  </svg>`,
  stan: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" fill="#0F1A2E"/>
    <rect x="4" y="3" width="16" height="2" fill="#1A0E08"/>
    <rect x="3" y="4" width="18" height="3" fill="#1A0E08"/>
    <rect x="9" y="2" width="6" height="1" fill="#1A0E08"/>
    <rect x="11" y="6" width="2" height="1" fill="#FFCB47"/>
    <rect x="6" y="7" width="12" height="9" fill="#E8C49D"/>
    <rect x="5" y="8" width="1" height="6" fill="#D3A87B"/>
    <rect x="18" y="8" width="1" height="6" fill="#D3A87B"/>
    <rect x="8" y="10" width="2" height="2" fill="#1A0E08"/>
    <rect x="14" y="10" width="2" height="2" fill="#1A0E08"/>
    <rect x="9" y="10" width="1" height="1" fill="#F7E7C2"/>
    <rect x="15" y="10" width="1" height="1" fill="#F7E7C2"/>
    <rect x="11" y="11" width="2" height="2" fill="#D3A87B"/>
    <rect x="10" y="13" width="4" height="1" fill="#D9D9D9"/>
    <rect x="11" y="14" width="2" height="1" fill="#1A0E08"/>
    <rect x="6" y="14" width="12" height="2" fill="#F7E7C2"/>
    <rect x="7" y="16" width="10" height="2" fill="#F7E7C2"/>
    <rect x="8" y="18" width="8" height="2" fill="#F7E7C2"/>
    <rect x="9" y="20" width="6" height="2" fill="#F7E7C2"/>
    <rect x="4" y="20" width="16" height="4" fill="#2A1810"/>
    <rect x="5" y="21" width="14" height="2" fill="#3D2418"/>
    <rect x="11" y="20" width="2" height="4" fill="#E0A93B"/>
  </svg>`,
};

/* ============================================================
   Routing
   ============================================================ */

function parseHash() {
  const h = location.hash || '#/';
  if (h.startsWith('#/team/')) {
    const rest = h.slice('#/team/'.length);
    const [tid, sub] = rest.split('/');
    let tab = 'bounties';
    if (sub === 'chest') tab = 'chest';
    else if (sub === 'post') tab = 'post';
    else if (sub === 'wof') tab = 'wof';
    return { view: 'team', teamId: decodeURIComponent(tid), tab };
  }
  if (h.startsWith('#/join/')) return { view: 'home', joinId: decodeURIComponent(h.slice('#/join/'.length)) };
  return { view: 'home', teamId: null };
}

function navigate(view, teamId, tab) {
  if (view === 'team' && teamId) {
    const suffix = tab && tab !== 'bounties' ? `/${tab}` : '';
    location.hash = `#/team/${encodeURIComponent(teamId)}${suffix}`;
  } else {
    location.hash = '#/';
  }
}

window.addEventListener('hashchange', applyRoute);

function applyRoute() {
  if (!state.authReady) return;
  if (!state.user) {
    state.view = 'login';
    state.teamId = null;
    teardownTeamSubs();
    render();
    return;
  }
  const r = parseHash();
  if (r.joinId) {
    location.hash = '#/';
    joinTeam(r.joinId);
    return;
  }
  if (r.view === 'team' && r.teamId !== state.teamId) {
    state.teamId = r.teamId;
    teardownTeamSubs();
    subscribeTeam(r.teamId);
  } else if (r.view === 'home') {
    state.teamId = null;
    teardownTeamSubs();
  }
  state.view = r.view;
  state.teamTab = r.tab ?? 'bounties';
  state.bellOpen = false;

  // Lazy load leaderboard when wof tab opens
  if (state.view === 'team' && state.teamTab === 'wof') refreshLeaderboard();

  render();
}

/* ============================================================
   Auth lifecycle
   ============================================================ */

onAuthStateChanged(auth, async (user) => {
  state.authReady = true;
  state.user = user;
  setHeaderVisible(!!user);
  if (user) {
    try {
      const result = await callInitUser();
      const seenStan = localStorage.getItem('vacaciones.seenStan') === 'true';
      if (result.data.initialized || !seenStan) {
        showWelcomeModal();
        localStorage.setItem('vacaciones.seenStan', 'true');
      }
    } catch (err) {
      console.error('initUser failed', err);
      showToast(`Could not register your sailor card: ${err.message}`, 'error', 5000);
    }
    subscribeMyTeams();
    applyRoute();
  } else {
    teardownAllSubs();
    state.view = 'login';
    state.teamId = null;
    state.prevLedgerIds = new Set();
    render();
  }
});

async function signIn() {
  if (state.busy.signIn) return;
  state.busy.signIn = true;
  render();
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) { showToast(err.message, 'error', 5000); }
  finally { state.busy.signIn = false; render(); }
}

async function handleSignOut() {
  try { await signOut(auth); }
  catch (err) { showToast(err.message, 'error', 5000); }
}

/* ============================================================
   Subscriptions
   ============================================================ */

function subscribeMyTeams() {
  unsubTeams?.();
  if (!state.user) return;
  const q = query(collection(db, 'teams'), where('memberUids', 'array-contains', state.user.uid));
  unsubTeams = onSnapshot(q,
    (snap) => { state.myTeams = snap.docs.map((d) => ({ id: d.id, ...d.data() })); render(); },
    (err) => {
      console.error('myTeams query failed', err);
      showToast(`Could not load your crews: ${err.message}`, 'error', 5000);
    },
  );
}

function subscribeTeam(teamId) {
  if (!state.user || !teamId) return;
  state.walletDoc = null;
  state.ledger = [];
  state.bounties = [];
  state.prevLedgerIds = new Set();
  state.leaderboard = null;

  unsubWallet = onSnapshot(
    doc(db, `teams/${teamId}/wallets/${state.user.uid}`),
    (snap) => { state.walletDoc = snap.exists() ? snap.data() : null; render(); },
    (err) => console.error('wallet query failed', err),
  );

  unsubLedger = onSnapshot(
    query(
      collection(db, `teams/${teamId}/ledgerEntries`),
      where('uid', '==', state.user.uid),
      orderBy('createdAt', 'desc'),
      limit(40),
    ),
    (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (state.prevLedgerIds.size > 0) {
        const fresh = next.filter((e) => !state.prevLedgerIds.has(e.id));
        for (const entry of fresh) {
          if (entry.amountSigned > 0 && entry.type !== 'grant') {
            launchCoinShower(`+${entry.amountSigned}`);
            audio.coin();
          }
        }
      }
      state.prevLedgerIds = new Set(next.map((e) => e.id));
      state.ledger = next;
      // Check achievements + persist
      const stats = computeStats();
      persistAchievements(computeAchievements(stats));
      render();
    },
    (err) => console.error('ledger query failed', err),
  );

  unsubRequests = onSnapshot(
    query(
      collection(db, `teams/${teamId}/coverageRequests`),
      orderBy('windowStart', 'asc'),
      limit(100),
    ),
    (snap) => {
      state.bounties = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.status !== 'cancelled');
      render();
    },
    (err) => console.error('bounties query failed', err),
  );

  unsubScrolls = onSnapshot(
    query(
      collection(db, `teams/${teamId}/scrolls`),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
    (snap) => {
      state.scrolls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => console.error('scrolls query failed', err),
  );
}

function teardownTeamSubs() {
  unsubWallet?.(); unsubWallet = null;
  unsubLedger?.(); unsubLedger = null;
  unsubRequests?.(); unsubRequests = null;
  unsubScrolls?.(); unsubScrolls = null;
}
function teardownAllSubs() {
  unsubTeams?.(); unsubTeams = null;
  teardownTeamSubs();
}

/* ============================================================
   Actions
   ============================================================ */

async function createTeam(name) {
  if (state.busy.createTeam || !name) return;
  state.busy.createTeam = true; render();
  try {
    const result = await callCreateTeam({ name });
    showToast(`Crew "${name}" formed. 20 doubloons in your chest.`, 'success');
    audio.coin();
    const input = document.getElementById('new-team-name');
    if (input) input.value = '';
    navigate('team', result.data.teamId);
  } catch (err) { showToast(err.message, 'error', 5000); }
  finally { state.busy.createTeam = false; render(); }
}

async function joinTeam(teamId) {
  if (state.busy.joinTeam || !teamId) return;
  state.busy.joinTeam = true; render();
  try {
    const result = await callJoinTeam({ teamId });
    if (result.data.alreadyMember) showToast('You’re already aboard that crew.', 'info');
    else { showToast('Signed aboard! 20 doubloons in your chest.', 'success'); audio.coin(); }
    const input = document.getElementById('join-team-id');
    if (input) input.value = '';
    navigate('team', result.data.teamId);
  } catch (err) { showToast(err.message, 'error', 5000); }
  finally { state.busy.joinTeam = false; render(); }
}

async function postBounty() {
  if (state.busy.postRequest) return;
  const f = state.formState;
  const start = parseLocalDate(f.startDate);
  const end = parseLocalDate(f.endDate);
  if (!start || !end || end < start) { showToast('Pick a valid date window.', 'error'); return; }
  if (f.reachability.length === 0) { showToast('Pick at least one reachability option.', 'error'); return; }
  state.busy.postRequest = true; render();
  try {
    const result = await callCreateCoverageRequest({
      teamId: state.teamId,
      windowStartIso: start.toISOString(),
      windowEndIso: end.toISOString(),
      timezone: f.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      reachability: f.reachability,
      coverageKinds: f.coverageKinds,
      coverageScope: f.coverageScope || null,
      sla: f.sla,
      emergencyDef: f.emergencyDef || null,
    });
    showToast(`Bounty posted for ${result.data.coinsOffered} doubloons. Anchors aweigh!`, 'success');
    state.formState = {
      startDate: '', endDate: '', timezone: state.formState.timezone,
      reachability: ['email-only-emergencies'], coverageKinds: [], coverageScope: '',
      sla: state.formState.sla, emergencyDef: '',
    };
    navigate('team', state.teamId, 'bounties');
  } catch (err) { showToast(err.message, 'error', 6000); }
  finally { state.busy.postRequest = false; render(); }
}

async function acceptRequest(requestId) {
  if (state.busy.acceptId) return;
  state.busy.acceptId = requestId; render();
  try {
    const result = await callAcceptCoverageRequest({ teamId: state.teamId, requestId });
    showToast(`Voyage accepted. ${result.data.coinsEscrowed} doubloons locked in escrow.`, 'success');
    audio.coin();
  } catch (err) { showToast(err.message, 'error', 6000); }
  finally { state.busy.acceptId = null; render(); }
}

async function copyInviteLink(teamId) {
  const link = `${location.origin}/#/join/${encodeURIComponent(teamId)}`;
  try {
    await navigator.clipboard.writeText(link);
    showToast('Invite link copied. Hand it to a crewmate.', 'success');
  } catch { showToast(`Invite link: ${link}`, 'info', 8000); }
}

async function sendScrollAction(teamId, toUid, message, bountyId) {
  try {
    await callSendScroll({ teamId, toUid, message, bountyId: bountyId ?? null });
    showToast('🪶 Thank-you scroll sent. The tavern echoes.', 'success');
    audio.rank();
  } catch (err) {
    showToast(`Could not send the scroll: ${err.message}`, 'error', 5000);
  }
}

function showSendScrollModal(toUid, toName, bountyId) {
  if (!toUid || toUid === state.user?.uid) {
    showToast('You cannot send a scroll to yourself.', 'error');
    return;
  }
  const inputId = 'scroll-msg-' + Math.random().toString(36).slice(2, 8);
  const body = `
    <div class="scroll-compose">
      <div class="scroll-target">
        <span>To:</span><strong>${esc(toName || 'Crewmate')}</strong>
      </div>
      <textarea id="${inputId}" maxlength="240" placeholder="A short note of thanks…"></textarea>
      <div class="scroll-char-count" id="${inputId}-count">240 left</div>
    </div>
  `;
  showModal({
    title: 'SEND A THANK-YOU SCROLL',
    body,
    primaryLabel: 'Send scroll',
    secondaryLabel: 'Cancel',
    onPrimary: () => {
      const el = document.getElementById(inputId);
      const message = el?.value?.trim() ?? '';
      if (!message) {
        showToast('Write something — even a few words.', 'error');
        return false;
      }
      sendScrollAction(state.teamId, toUid, message, bountyId);
    },
  });
  // Wire up live char counter + autofocus after the modal is in the DOM
  setTimeout(() => {
    const el = document.getElementById(inputId);
    const count = document.getElementById(inputId + '-count');
    if (!el || !count) return;
    el.addEventListener('input', () => { count.textContent = `${240 - el.value.length} left`; });
    el.focus();
  }, 10);
}

async function refreshLeaderboard() {
  if (!state.teamId || state.leaderboardLoading) return;
  state.leaderboardLoading = true; render();
  try {
    const result = await callGetLeaderboard({ teamId: state.teamId });
    state.leaderboard = result.data;
  } catch (err) {
    console.error('leaderboard fetch failed', err);
    showToast(`Could not load the Wall of Fame: ${err.message}`, 'error', 5000);
  } finally { state.leaderboardLoading = false; render(); }
}

/* ============================================================
   Coin shower + toasts + modal
   ============================================================ */

function launchCoinShower(label) {
  const root = document.getElementById('coin-shower'); if (!root) return;
  const anchor = document.querySelector('.coin-pill') ?? document.querySelector('.bucket.total') ?? document.body;
  const r = anchor.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'pop';
  pop.textContent = label;
  pop.style.position = 'fixed';
  pop.style.left = `${r.left + r.width / 2 - 12}px`;
  pop.style.top = `${r.top + 8}px`;
  root.appendChild(pop);
  setTimeout(() => pop.remove(), 950);
}

function showToast(message, kind = 'info', ttl = 3500) {
  const toastEl = document.getElementById('toast');
  const icon = kind === 'success' ? '✓' : kind === 'error' ? '!' : '⚓';
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${esc(message)}</span>`;
  toastEl.appendChild(el);
  audio.toast();
  let timer;
  const dismiss = () => { clearTimeout(timer); el.style.opacity = '0'; el.style.transition = 'opacity 0.2s'; setTimeout(() => el.remove(), 220); };
  el.addEventListener('click', dismiss);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });
  timer = setTimeout(dismiss, ttl);
}

function showModal({ title, body, primaryLabel = 'AYE', secondaryLabel, onPrimary, onSecondary, wide }) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-scrim';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}">
      <div class="modal-title">${esc(title)}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        ${secondaryLabel ? `<button class="btn btn-secondary" data-modal="secondary">${esc(secondaryLabel)}</button>` : ''}
        <button class="btn" data-modal="primary">${esc(primaryLabel)}</button>
      </div>
    </div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close();
    const action = e.target.closest('[data-modal]')?.dataset.modal;
    if (action === 'primary') {
      const result = onPrimary?.();
      if (result !== false) close();
    }
    if (action === 'secondary') {
      const result = onSecondary?.();
      if (result !== false) close();
    }
  });
  root.appendChild(wrap);
  return { close };
}

function showWelcomeModal() {
  state.onboardingScene = 0;
  renderStanScene();
}

function renderStanScene() {
  const idx = state.onboardingScene;
  const scene = STAN_SCENES[idx];
  const isLast = idx === STAN_SCENES.length - 1;
  const body = `
    <div class="stan-scene">
      <div class="stan-portrait">${SVG.stan}</div>
      <div class="stan-speech"><p>${esc(scene.speech)}</p></div>
    </div>
    <div class="stan-progress">
      ${STAN_SCENES.map((_, i) => `<span class="stan-dot ${i === idx ? 'active' : ''}"></span>`).join('')}
    </div>
  `;
  showModal({
    title: 'STAN, HARBORMASTER',
    body,
    primaryLabel: isLast ? 'Set sail' : 'Aye, next',
    secondaryLabel: idx === 0 ? 'Skip' : 'Back',
    onPrimary: () => {
      audio.click();
      if (!isLast) {
        state.onboardingScene = idx + 1;
        setTimeout(renderStanScene, 0);
      }
    },
    onSecondary: () => {
      audio.click();
      if (idx > 0) {
        state.onboardingScene = idx - 1;
        setTimeout(renderStanScene, 0);
      }
    },
  });
}

function showBountyDetail(bountyId) {
  const b = state.bounties.find((x) => x.id === bountyId);
  if (!b) return;
  const status = b.status || 'open';
  const days = Math.max(1, Math.round(((b.windowEnd?.toDate?.() ?? new Date()) - (b.windowStart?.toDate?.() ?? new Date())) / 86400000) + 1);
  const reaches = arr(b.reachability).map((r) => REACHABILITY_OPTIONS.find((o) => o.value === r)).filter(Boolean);
  const kinds = arr(b.coverageKinds).map((k) => COVERAGE_KIND_OPTIONS.find((o) => o.value === k)).filter(Boolean);
  const mine = b.requesterUid === state.user?.uid;
  const cost = computeCoverageCost(b.windowStart?.toDate?.(), b.windowEnd?.toDate?.());
  const body = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <span class="status-badge status-${status}">${STATUS_LABEL[status] || status}</span>
      <span style="font-family: 'Silkscreen', monospace; font-size: 22px; color: var(--brass-deep); display: inline-flex; align-items: center; gap: 4px;">
        ${SVG.doubloon}${b.totalCoinsOffered ?? 0}
        <span style="font-family: 'VT323', monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-faded); margin-left: 4px;">doubloons</span>
      </span>
    </div>

    <div class="bd-section">
      <h4>Requester</h4>
      <div style="display: flex; align-items: center; gap: 8px;">
        ${b.requesterPhotoURL ? `<img class="avatar-mini" src="${esc(b.requesterPhotoURL)}" alt="" referrerpolicy="no-referrer" style="width: 32px; height: 32px;" />` : ''}
        <span class="bd-value">${esc(b.requesterDisplayName || 'A crewmate')}${mine ? ' (you)' : ''}</span>
      </div>
    </div>

    ${b.covererUid ? `
      <div class="bd-section">
        <h4>Covered by</h4>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${b.covererPhotoURL ? `<img class="avatar-mini" src="${esc(b.covererPhotoURL)}" alt="" referrerpolicy="no-referrer" style="width: 32px; height: 32px;" />` : ''}
          <span class="bd-value">${esc(b.covererDisplayName || 'A crewmate')}${b.covererUid === state.user?.uid ? ' (you)' : ''}</span>
        </div>
      </div>
    ` : ''}

    <div class="bd-grid">
      <span class="bd-label">Window</span>
      <span class="bd-value">${esc(formatDate(b.windowStart?.toDate()))} → ${esc(formatDate(b.windowEnd?.toDate()))} (${days} day${days === 1 ? '' : 's'})</span>
      <span class="bd-label">Timezone</span>
      <span class="bd-value">${esc(b.timezone || '')}</span>
      <span class="bd-label">Cost breakdown</span>
      <span class="bd-value">${cost.weekdays} weekday × ${ECONOMY.COVERAGE_PRICE_PER_DAY} + ${cost.weekendDays} weekend × ${ECONOMY.COVERAGE_PRICE_PER_DAY * ECONOMY.WEEKEND_MULTIPLIER}</span>
      ${b.sla ? `<span class="bd-label">SLA</span><span class="bd-value">${esc(b.sla)}</span>` : ''}
    </div>

    ${b.coverageScope ? `
      <div class="bd-section">
        <h4>Coverage scope</h4>
        <p class="bd-value" style="margin: 0;">${esc(b.coverageScope)}</p>
      </div>
    ` : ''}

    ${reaches.length > 0 ? `
      <div class="bd-section">
        <h4>Reachability</h4>
        <div class="chips">${reaches.map((r) => `<span class="chip chip-cream">${r.icon} ${esc(r.label)}</span>`).join('')}</div>
      </div>` : ''}

    ${kinds.length > 0 ? `
      <div class="bd-section">
        <h4>What you'd be covering</h4>
        <div class="chips">${kinds.map((k) => `<span class="chip chip-cyan">${k.icon} ${esc(k.label)}</span>`).join('')}</div>
      </div>` : ''}

    ${b.emergencyDef ? `
      <div class="bd-section">
        <h4>What counts as a real emergency</h4>
        <p class="bd-value" style="margin: 0;">${esc(b.emergencyDef)}</p>
      </div>` : ''}
  `;
  if (status === 'open' && !mine) {
    showModal({
      title: 'BOUNTY DETAIL',
      body,
      wide: true,
      primaryLabel: 'Take voyage',
      secondaryLabel: 'Back',
      onPrimary: () => acceptRequest(bountyId),
    });
  } else if (status === 'completed' && mine && b.covererUid) {
    // Requester whose bounty was completed — invite them to send a scroll
    showModal({
      title: 'BOUNTY DETAIL',
      body,
      wide: true,
      primaryLabel: '🪶 Send Thank-You Scroll',
      secondaryLabel: 'Close',
      onPrimary: () => showSendScrollModal(b.covererUid, b.covererDisplayName, b.id),
    });
  } else {
    showModal({
      title: 'BOUNTY DETAIL',
      body,
      wide: true,
      primaryLabel: 'Close',
    });
  }
}

/* ============================================================
   Header
   ============================================================ */

function setHeaderVisible(visible) { document.getElementById('header').hidden = !visible; }

function renderUserInfo() {
  const target = document.getElementById('user-info');
  if (!state.user) { target.innerHTML = ''; return; }
  const u = state.user;
  const team = state.teamId ? state.myTeams.find((t) => t.id === state.teamId) : null;
  const wallet = state.walletDoc;
  const totalBalance = wallet ? (wallet.earnedBalance ?? 0) + (wallet.stipendBalance ?? 0) : null;
  const stats = state.teamId ? computeStats() : null;
  const rank = stats ? computeRank(stats) : null;
  const notifs = state.user ? computeNotifications() : [];
  const unread = notifs.filter((n) => n.time.getTime() > state.notifLastSeen).length;

  target.innerHTML = `
    ${totalBalance !== null && team ? `
      <span class="coin-pill" title="Total doubloons in this crew">
        ${SVG.doubloon}<span>${totalBalance}</span>
      </span>` : ''}
    ${rank && team ? `<span class="rank-chip" title="${esc(rank.name)} (${rank.icon})"><span class="rank-icon">${rank.icon}</span>${esc(rank.name)}</span>` : ''}
    <button class="bell" data-action="bell" title="Notifications" aria-label="Notifications">
      🔔${unread > 0 ? `<span class="bell-badge">${unread}</span>` : ''}
    </button>
    <button class="sound-toggle ${audio.enabled ? 'on' : ''}" data-action="sound" title="Sound effects">
      ${audio.enabled ? '🔊' : '🔇'}
    </button>
    ${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer" />` : ''}
    <div class="who">
      <span class="name">${esc(u.displayName ?? '')}</span>
      <span class="email">${esc(u.email ?? '')}</span>
    </div>
    <button class="btn-secondary" data-action="sign-out" style="padding: 6px 10px; font-size: 8px;">SIGN OUT</button>
    ${state.bellOpen ? renderBellDropdown(notifs) : ''}
  `;
}

function renderBellDropdown(notifs) {
  return `
    <div class="bell-dropdown">
      <div class="dropdown-title">Recent activity</div>
      ${notifs.length === 0 ? `
        <div class="bell-empty">Nothing new in the harbour.</div>
      ` : `
        <ul class="bell-list">
          ${notifs.map((n) => `
            <li>
              <span class="bell-icon">${n.icon}</span>
              <span>
                ${esc(n.text)}
                <span class="bell-meta">${esc(timeAgo(n.time))}${n.meta ? ` · ${esc(n.meta)}` : ''}</span>
              </span>
            </li>
          `).join('')}
        </ul>
      `}
    </div>
  `;
}

/* ============================================================
   Rendering — top
   ============================================================ */

function render() {
  const app = document.getElementById('app');
  renderUserInfo();
  if (!state.authReady) {
    app.innerHTML = `<div class="loading"><span class="loading-doubloon">${SVG.doubloon}</span>Loading the harbor&hellip;</div>`;
    return;
  }
  if (state.view === 'login') app.innerHTML = renderLogin();
  else if (state.view === 'home') app.innerHTML = renderHome();
  else if (state.view === 'team') app.innerHTML = renderTeam();
  else app.innerHTML = '';
}

/* ============================================================
   Login
   ============================================================ */

function renderLogin() {
  const busy = state.busy.signIn;
  return `
    <div class="login-screen">
      ${renderHarborBg()}
      <div class="login-content">
        <h1 class="login-title">VACACIONES</h1>
        <p class="login-tagline">Tales of Monkey Coverage</p>
        <div class="login-card">
          <button class="btn btn-google" data-action="sign-in" ${busy ? 'disabled' : ''}>
            ${busy ? `<span class="spinner"></span>Signing in…` : `
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>SIGN IN WITH GOOGLE`}
          </button>
        </div>
      </div>
      <div class="mascot-floater">
        <div class="mascot-bubble">${esc(pickMascotLine())}</div>
        <div class="mascot-sprite">${SVG.turtle}</div>
      </div>
    </div>
  `;
}

function renderHarborBg() {
  return `<svg class="login-bg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="320" height="130" fill="#0F1A2E"/>
    <rect x="20" y="20" width="1" height="1" fill="#F7E7C2"/><rect x="48" y="34" width="1" height="1" fill="#F7E7C2"/>
    <rect x="80" y="18" width="1" height="1" fill="#F7E7C2"/><rect x="140" y="40" width="1" height="1" fill="#F7E7C2"/>
    <rect x="180" y="22" width="1" height="1" fill="#F7E7C2"/><rect x="220" y="38" width="1" height="1" fill="#F7E7C2"/>
    <rect x="260" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="298" y="44" width="1" height="1" fill="#F7E7C2"/>
    <rect x="60" y="60" width="1" height="1" fill="#A6C2E8"/><rect x="115" y="70" width="1" height="1" fill="#A6C2E8"/>
    <rect x="200" y="80" width="1" height="1" fill="#A6C2E8"/>
    <circle cx="80" cy="55" r="20" fill="#F7E7C2"/>
    <circle cx="74" cy="50" r="3" fill="#C4A86B" opacity="0.6"/>
    <circle cx="86" cy="60" r="2" fill="#C4A86B" opacity="0.6"/>
    <rect x="56" y="40" width="2" height="2" fill="#F7E7C2" opacity="0.4"/>
    <rect x="100" y="40" width="2" height="2" fill="#F7E7C2" opacity="0.4"/>
    <rect x="58" y="70" width="2" height="2" fill="#F7E7C2" opacity="0.4"/>
    <rect x="102" y="68" width="2" height="2" fill="#F7E7C2" opacity="0.4"/>
    <rect x="0" y="130" width="320" height="70" fill="#1E2D4A"/>
    <rect x="0" y="130" width="320" height="2" fill="#5BC9D1"/>
    <rect x="20" y="138" width="6" height="1" fill="#A6C2E8" opacity="0.5"/>
    <rect x="70" y="142" width="8" height="1" fill="#A6C2E8" opacity="0.5"/>
    <rect x="140" y="148" width="10" height="1" fill="#A6C2E8" opacity="0.5"/>
    <rect x="210" y="155" width="12" height="1" fill="#A6C2E8" opacity="0.5"/>
    <rect x="280" y="162" width="10" height="1" fill="#A6C2E8" opacity="0.5"/>
    <rect x="74" y="134" width="12" height="1" fill="#F7E7C2" opacity="0.7"/>
    <rect x="76" y="140" width="8" height="1" fill="#F7E7C2" opacity="0.4"/>
    <rect x="78" y="146" width="4" height="1" fill="#F7E7C2" opacity="0.3"/>
    <rect x="220" y="115" width="60" height="15" fill="#0A1320"/>
    <rect x="230" y="105" width="40" height="10" fill="#0A1320"/>
    <rect x="240" y="100" width="20" height="5" fill="#0A1320"/>
    <rect x="180" y="110" width="40" height="20" fill="#2A1810"/>
    <rect x="178" y="112" width="44" height="16" fill="#3D2418"/>
    <rect x="175" y="120" width="50" height="8" fill="#3D2418"/>
    <rect x="186" y="116" width="2" height="2" fill="#FFCB47"/>
    <rect x="194" y="116" width="2" height="2" fill="#FFCB47"/>
    <rect x="202" y="116" width="2" height="2" fill="#FFCB47"/>
    <rect x="210" y="116" width="2" height="2" fill="#FFCB47"/>
    <rect x="195" y="70" width="1" height="40" fill="#1A0E08"/>
    <rect x="205" y="60" width="1" height="50" fill="#1A0E08"/>
    <rect x="215" y="75" width="1" height="35" fill="#1A0E08"/>
    <rect x="188" y="78" width="15" height="20" fill="#E8D7A8" opacity="0.85"/>
    <rect x="200" y="68" width="12" height="32" fill="#E8D7A8" opacity="0.85"/>
    <rect x="211" y="82" width="8" height="20" fill="#E8D7A8" opacity="0.85"/>
    <rect x="205" y="56" width="8" height="5" fill="#1A0E08"/>
    <rect x="207" y="57" width="2" height="2" fill="#F7E7C2"/>
    <rect x="210" y="57" width="2" height="2" fill="#F7E7C2"/>
    <rect x="0" y="148" width="60" height="6" fill="#5A3A1F"/>
    <rect x="0" y="154" width="60" height="2" fill="#3D2418"/>
    <rect x="14" y="120" width="2" height="34" fill="#5A3A1F"/>
    <rect x="11" y="120" width="8" height="6" fill="#1A0E08"/>
    <rect x="12" y="121" width="6" height="4" fill="#FFCB47"/>
    <rect x="13" y="122" width="4" height="2" fill="#FFD86B"/>
    <rect x="9" y="119" width="2" height="2" fill="#FFCB47" opacity="0.3"/>
    <rect x="20" y="119" width="2" height="2" fill="#FFCB47" opacity="0.3"/>
    <rect x="14" y="126" width="2" height="2" fill="#E0A93B" opacity="0.4"/>
    <rect x="34" y="120" width="2" height="34" fill="#5A3A1F"/>
    <rect x="31" y="120" width="8" height="6" fill="#1A0E08"/>
    <rect x="32" y="121" width="6" height="4" fill="#FFCB47"/>
    <rect x="33" y="122" width="4" height="2" fill="#FFD86B"/>
    <rect x="29" y="119" width="2" height="2" fill="#FFCB47" opacity="0.3"/>
    <rect x="40" y="119" width="2" height="2" fill="#FFCB47" opacity="0.3"/>
    <rect x="50" y="130" width="3" height="18" fill="#5A3A1F"/>
    <rect x="44" y="126" width="6" height="2" fill="#2A6A1E"/>
    <rect x="40" y="128" width="8" height="2" fill="#2A6A1E"/>
    <rect x="53" y="126" width="6" height="2" fill="#2A6A1E"/>
    <rect x="55" y="128" width="8" height="2" fill="#2A6A1E"/>
    <rect x="44" y="124" width="2" height="2" fill="#1F4D14"/>
    <rect x="58" y="124" width="2" height="2" fill="#1F4D14"/>
  </svg>`;
}

/* ============================================================
   Home
   ============================================================ */

function renderHome() {
  const teams = state.myTeams;
  return `
    <section class="hero">
      <h1>WELCOME ABOARD, ${esc(firstName(state.user?.displayName)).toUpperCase()}</h1>
      <p>Pick a crew to manage bounties, or raise your own colours.</p>
    </section>
    <section>
      <h2>Your Crews</h2>
      ${teams.length === 0 ? `
        <div class="empty-card">
          <div class="empty-mascot">${SVG.turtle}</div>
          <p><strong>No crew yet.</strong></p>
          <p class="muted">Form one with your colleagues, or sign on with an invite link.</p>
        </div>
      ` : `
        <ul class="team-list">
          ${teams.map((t) => `
            <li>
              <a href="#/team/${esc(t.id)}" class="team-card">
                <span class="team-flag">${SVG.flag}</span>
                <div class="team-main">
                  <strong>${esc(t.name)}</strong>
                  <small>${(t.memberUids?.length || 0)} crewmate${(t.memberUids?.length === 1 ? '' : 's')}</small>
                </div>
                <code class="team-id-chip" title="Crew ID — share to invite">${esc(t.id)}</code>
                <span class="arrow">▶</span>
              </a>
            </li>
          `).join('')}
        </ul>
      `}
    </section>
    <section class="actions">
      <div class="panel">
        <div class="panel-title">Form a crew</div>
        <p class="muted" style="font-family: 'VT323', monospace; font-size: 18px; margin: 0 0 12px;">You become the quartermaster. Crewmates each get 20 doubloons to start.</p>
        <div class="row">
          <input id="new-team-name" type="text" placeholder="Crew name" maxlength="100" ${state.busy.createTeam ? 'disabled' : ''} />
          <button class="btn" data-action="create-team" ${state.busy.createTeam ? 'disabled' : ''}>${state.busy.createTeam ? 'Forming…' : 'Hoist'}</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">Sign on with a crew</div>
        <p class="muted" style="font-family: 'VT323', monospace; font-size: 18px; margin: 0 0 12px;">Paste the crew ID (or invite link) a teammate shared.</p>
        <div class="row">
          <input id="join-team-id" type="text" placeholder="Crew ID or link" ${state.busy.joinTeam ? 'disabled' : ''} />
          <button class="btn" data-action="join-team" ${state.busy.joinTeam ? 'disabled' : ''}>${state.busy.joinTeam ? 'Boarding…' : 'Aye'}</button>
        </div>
      </div>
    </section>
  `;
}

/* ============================================================
   Team page (tabs)
   ============================================================ */

function renderTeam() {
  const team = state.myTeams.find((t) => t.id === state.teamId);
  if (!team) {
    return `
      <div class="empty-card" style="margin-top: 48px;">
        <div class="empty-mascot">${SVG.turtle}</div>
        <h2 style="color: var(--ink-pure);">Crew not found</h2>
        <p class="muted">You may have been pressed elsewhere, or the crew ID is wrong.</p>
        <p style="margin-top: 16px;"><a href="#/">◀ Back to your crews</a></p>
      </div>
    `;
  }
  const openCount = state.bounties.filter((b) => b.status === 'open').length;
  const tab = state.teamTab;
  let body = '';
  if (tab === 'chest') body = renderChestTab();
  else if (tab === 'post') body = renderPostTab();
  else if (tab === 'wof') body = renderWofTab();
  else body = renderBountyBoardTab();

  return `
    <nav class="breadcrumb">
      <a href="#/">Crews</a><span class="sep">/</span><span class="current">${esc(team.name)}</span>
    </nav>
    <header class="team-header">
      <div>
        <h1>${esc(team.name).toUpperCase()}</h1>
        <small>${team.memberUids?.length || 0} crewmate${team.memberUids?.length === 1 ? '' : 's'} · ID: <code>${esc(team.id)}</code></small>
      </div>
      <div class="invite-actions">
        <button class="btn-ghost" data-action="copy-invite" data-id="${esc(team.id)}">🔗 SHARE INVITE</button>
      </div>
    </header>
    <nav class="tabs">
      <a href="#/team/${esc(team.id)}" class="tab ${tab === 'bounties' ? 'active' : ''}">Bounty Board ${openCount > 0 ? `<span class="tab-count">${openCount}</span>` : ''}</a>
      <a href="#/team/${esc(team.id)}/chest" class="tab ${tab === 'chest' ? 'active' : ''}">Treasure Chest</a>
      <a href="#/team/${esc(team.id)}/wof" class="tab ${tab === 'wof' ? 'active' : ''}">Wall of Fame</a>
      <a href="#/team/${esc(team.id)}/post" class="tab ${tab === 'post' ? 'active' : ''}">Post Bounty</a>
    </nav>
    ${body}
  `;
}

/* Bounty Board */
function renderBountyBoardTab() {
  const filter = state.bountyFilter;
  let list = state.bounties.slice();
  if (filter === 'open') list = list.filter((b) => b.status === 'open');
  else if (filter === 'taken') list = list.filter((b) => b.status === 'accepted' || b.status === 'active');
  else if (filter === 'done') list = list.filter((b) => b.status === 'completed');
  else if (filter === 'mine') list = list.filter((b) => b.requesterUid === state.user.uid);
  list.sort((a, b) => {
    const sa = STATUS_PRIORITY[a.status] ?? 99;
    const sb = STATUS_PRIORITY[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.windowStart?.toMillis() ?? 0) - (b.windowStart?.toMillis() ?? 0);
  });
  const counts = {
    all: state.bounties.length,
    open: state.bounties.filter((b) => b.status === 'open').length,
    taken: state.bounties.filter((b) => b.status === 'accepted' || b.status === 'active').length,
    done: state.bounties.filter((b) => b.status === 'completed').length,
    mine: state.bounties.filter((b) => b.requesterUid === state.user?.uid).length,
  };
  return `
    <section>
      <div class="filter-row">
        ${renderFilter('all', `All · ${counts.all}`)}
        ${renderFilter('open', `Open · ${counts.open}`)}
        ${renderFilter('taken', `Taken · ${counts.taken}`)}
        ${renderFilter('done', `Done · ${counts.done}`)}
        ${renderFilter('mine', `Mine · ${counts.mine}`)}
      </div>
      ${list.length === 0 ? `
        <div class="empty-card">
          <div class="empty-mascot">${SVG.turtle}</div>
          <p><strong>${filter === 'all' ? 'The bounty board is empty.' : `No ${filter} bounties.`}</strong></p>
          <p class="muted">${filter === 'all' ? 'Post one yourself — your crewmates earn doubloons by covering you.' : 'Switch the filter above to see other bounties.'}</p>
          ${filter === 'all' ? `<p style="margin-top: 16px;"><a href="#/team/${esc(state.teamId)}/post">▶ Post a bounty</a></p>` : ''}
        </div>
      ` : `<ul class="bounties">${list.map(renderBountyCard).join('')}</ul>`}
    </section>
  `;
}

function renderFilter(value, label) {
  const active = state.bountyFilter === value;
  return `<button class="filter-chip ${active ? 'active' : ''}" data-action="set-filter" data-filter="${value}">${esc(label)}</button>`;
}

function renderBountyCard(b) {
  const status = b.status || 'open';
  const statusLabel = STATUS_LABEL[status] || status.toUpperCase();
  const mine = b.requesterUid === state.user?.uid;
  const youCover = b.covererUid === state.user?.uid;
  const accepting = state.busy.acceptId === b.id;
  const days = Math.max(1, Math.round(((b.windowEnd?.toDate?.() ?? new Date()) - (b.windowStart?.toDate?.() ?? new Date())) / 86400000) + 1);
  const reaches = arr(b.reachability).map((r) => REACHABILITY_OPTIONS.find((o) => o.value === r)).filter(Boolean);
  const kinds = arr(b.coverageKinds).map((k) => COVERAGE_KIND_OPTIONS.find((o) => o.value === k)).filter(Boolean);
  const reqName = b.requesterDisplayName || (mine ? 'You' : 'A crewmate');
  const reqPhoto = b.requesterPhotoURL;
  const covererName = b.covererDisplayName || (youCover ? 'You' : null);
  const covererPhoto = b.covererPhotoURL;

  let actionHtml = '';
  if (mine) actionHtml = `<span class="own-tag bounty-action">Your bounty</span>`;
  else if (status === 'open') actionHtml = `<div class="bounty-action"><button class="btn" data-action="accept" data-id="${esc(b.id)}" ${accepting ? 'disabled' : ''}>${accepting ? 'Accepting…' : 'Take voyage'}</button></div>`;
  else if (covererName) actionHtml = `<div class="taken-by">
    <span class="taken-by-label">Covered by</span>
    ${covererPhoto ? `<img class="avatar-mini" src="${esc(covererPhoto)}" alt="" referrerpolicy="no-referrer"/>` : ''}
    <span>${esc(shortName(covererName))}</span>
  </div>`;
  else actionHtml = `<div class="bounty-action"><span class="own-tag">${esc(statusLabel)}</span></div>`;

  return `
    <li class="bounty bounty-${status}" data-bounty-id="${esc(b.id)}" style="cursor: pointer;">
      <div class="bounty-status-area"><span class="status-badge status-${status}">${esc(statusLabel)}</span></div>
      <div class="bounty-requester" title="${esc(b.requesterDisplayName ?? '')}">
        ${reqPhoto ? `<img class="avatar-mini" src="${esc(reqPhoto)}" alt="" referrerpolicy="no-referrer" />` : `<span class="avatar-mini" style="background: var(--parchment-dim); display: inline-block;"></span>`}
        <span class="requester-chip"><span class="who-name">${esc(shortName(reqName))}</span></span>
      </div>
      <div class="bounty-window">
        <strong>${esc(formatDate(b.windowStart?.toDate()))} → ${esc(formatDate(b.windowEnd?.toDate()))}</strong>
        <small>${days} day${days === 1 ? '' : 's'} · ${esc(b.timezone || '')}</small>
      </div>
      <div class="bounty-doubloons">
        <strong>${SVG.doubloon}${b.totalCoinsOffered ?? 0}</strong>
        <small>doubloons</small>
      </div>
      ${b.coverageScope ? `<div class="bounty-scope"><strong>Scope:</strong>${esc(b.coverageScope)}</div>` : ''}
      ${(reaches.length > 0 || kinds.length > 0) ? `
        <div class="bounty-chips">
          <div class="chips">
            ${reaches.map((r) => `<span class="chip chip-cream" title="${esc(r.label)}">${r.icon} ${esc(r.short)}</span>`).join('')}
            ${kinds.map((k) => `<span class="chip chip-cyan" title="${esc(k.label)}">${k.icon} ${esc(k.label)}</span>`).join('')}
          </div>
        </div>` : ''}
      ${b.sla ? `<div class="bounty-sla"><strong>SLA:</strong> ${esc(b.sla)}</div>` : ''}
      ${actionHtml}
    </li>
  `;
}

/* Chest tab — wallet + rank + achievements + ledger */
function renderChestTab() {
  const w = state.walletDoc;
  const stats = computeStats();
  const rank = computeRank(stats);
  const achievements = computeAchievements(stats);
  return `
    <div class="rank-hero">
      <div class="rank-emblem">${rank.icon}</div>
      <div class="rank-info">
        <div class="rank-name">${esc(rank.name)}</div>
        <div class="rank-progress">
          ${rank.nextName
            ? `Earn <strong>${rank.toNext}</strong> more doubloons to reach <strong>${esc(rank.nextName)}</strong>.`
            : `Highest rank achieved. Your name will be sung in shanties.`}
        </div>
        <div class="rank-bar"><div class="rank-bar-fill" style="width: ${Math.round(rank.progress * 100)}%"></div></div>
      </div>
    </div>

    <div class="panel wallet-panel">
      <div class="panel-title">Your treasure chest</div>
      ${w ? `
        <div class="balances">
          <div class="bucket">
            <strong>${w.earnedBalance ?? 0}</strong>
            <small>Earned</small>
          </div>
          <div class="bucket">
            <strong>${w.stipendBalance ?? 0}</strong>
            <small>Crown’s stipend</small>
            <em>resets monthly</em>
          </div>
          <div class="bucket total">
            <strong>${(w.earnedBalance ?? 0) + (w.stipendBalance ?? 0)}</strong>
            <small>Total doubloons</small>
          </div>
        </div>
      ` : `<p class="muted" style="margin: 0 0 12px;">No doubloons yet — the chest will fill as you act.</p>`}

      <h3 style="margin-bottom: 8px;">Honors</h3>
      <div class="achievements">
        ${achievements.map((a) => `
          <div class="badge ${a.unlocked ? '' : 'locked'}" title="${esc(a.name)}">
            <div class="badge-icon">${a.icon}</div>
            <div class="badge-name">${esc(a.name)}</div>
          </div>
        `).join('')}
      </div>

      <h3 style="margin-bottom: 8px;">Captain’s log</h3>
      ${state.ledger.length === 0 ? `<p class="muted">Your ledger is empty for now.</p>` : `
        <ul class="ledger">
          ${state.ledger.slice(0, 20).map((e) => `
            <li class="${e.amountSigned > 0 ? 'credit' : e.amountSigned < 0 ? 'debit' : ''}">
              <div>
                <strong>${esc(LEDGER_TYPE_LABELS[e.type] ?? e.type)}</strong>
                <small>${esc(formatDateTime(e.createdAt?.toDate()))}</small>
              </div>
              <span class="amount">
                ${e.amountSigned > 0 ? '+' : ''}${e.amountSigned}
                <small>${esc(e.balanceBucket)}</small>
              </span>
            </li>
          `).join('')}
        </ul>
      `}
    </div>
  `;
}

/* Post tab */
function renderPostTab() {
  const tz = state.formState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  state.formState.timezone = tz;
  const f = state.formState;
  const cost = computeCoverageCost(parseLocalDate(f.startDate), parseLocalDate(f.endDate));
  return `
    <div class="create-card">
      <div class="panel-title">Post a bounty</div>
      <p class="muted" style="font-family: 'VT323', monospace; font-size: 18px; margin: 0 0 14px;">
        ${ECONOMY.WEEKEND_MULTIPLIER}× multiplier on Saturdays and Sundays. Doubloons leave your chest and sit in escrow until a crewmate covers.
      </p>
      <form id="create-form" autocomplete="off">
        <div class="form-grid">
          <label><span>Shore leave from</span><input type="date" name="startDate" value="${esc(f.startDate)}" /></label>
          <label><span>Returning by</span><input type="date" name="endDate" value="${esc(f.endDate)}" /></label>
          <label class="wide"><span>Timezone</span><input type="text" name="timezone" value="${esc(tz)}" /></label>
          <label class="wide">
            <span>What you’re covered for · pick any</span>
            <div class="check-group">
              ${COVERAGE_KIND_OPTIONS.map((k) => `
                <label class="check-pixel">
                  <input type="checkbox" name="coverageKinds" value="${esc(k.value)}" ${f.coverageKinds.includes(k.value) ? 'checked' : ''}/>
                  <span class="check-box"></span>
                  <span class="check-label">${k.icon} ${esc(k.label)}</span>
                </label>
              `).join('')}
            </div>
          </label>
          <label class="wide">
            <span>How reachable while away · pick any</span>
            <div class="check-group">
              ${REACHABILITY_OPTIONS.map((r) => `
                <label class="check-pixel">
                  <input type="checkbox" name="reachability" value="${esc(r.value)}" ${f.reachability.includes(r.value) ? 'checked' : ''}/>
                  <span class="check-box"></span>
                  <span class="check-label">${r.icon} ${esc(r.label)}</span>
                </label>
              `).join('')}
            </div>
          </label>
          <label class="wide"><span>Coverage scope · which accounts / responsibilities</span><input type="text" name="coverageScope" placeholder="e.g. Acme + 2 SMBs · my weekly 1:1s with BigCorp" value="${esc(f.coverageScope)}" /></label>
          <label class="wide"><span>SLA the coverer should hold</span><input type="text" name="sla" value="${esc(f.sla)}" /></label>
          <label class="wide"><span>What counts as a real emergency? (optional)</span><textarea name="emergencyDef" rows="2" placeholder="“Wake me only if Acme’s production is down.”">${esc(f.emergencyDef)}</textarea></label>
        </div>
        <div class="preview-row">
          <div class="preview">
            ${cost.days > 0
              ? `<div class="cost"><strong>${cost.totalCoins}</strong><span>doubloons</span></div>
                 <small>${cost.days} day${cost.days === 1 ? '' : 's'} · ${cost.weekdays} weekday · ${cost.weekendDays} weekend</small>`
              : `<small class="muted-light">Pick a window to preview the cost.</small>`}
          </div>
          <button type="submit" class="btn btn-large" ${state.busy.postRequest ? 'disabled' : ''}>${state.busy.postRequest ? 'Posting…' : 'Post bounty'}</button>
        </div>
      </form>
    </div>
  `;
}

/* Wall of Fame */
function renderWofTab() {
  if (state.leaderboardLoading && !state.leaderboard) {
    return `<div class="loading"><span class="loading-doubloon">${SVG.doubloon}</span>Reading the ship's logs&hellip;</div>`;
  }
  const lb = state.leaderboard;
  if (!lb || lb.entries.length === 0) {
    return `
      <div class="empty-card">
        <div class="empty-mascot">${SVG.turtle}</div>
        <p><strong>No covers yet.</strong></p>
        <p class="muted">The wall fills as crewmates earn doubloons by covering each other.</p>
      </div>
    `;
  }
  const top3 = lb.entries.slice(0, 3);
  const rest = lb.entries.slice(3);
  const meName = state.user?.displayName;

  const podiumOrder = top3.length === 1 ? [top3[0]]
    : top3.length === 2 ? [top3[1], top3[0]]
    : [top3[1], top3[0], top3[2]];

  const podiumClass = (entry) => {
    if (entry === top3[0]) return 'first';
    if (entry === top3[1]) return 'second';
    if (entry === top3[2]) return 'third';
    return '';
  };
  const podiumEmoji = (entry) => {
    if (entry === top3[0]) return '🏴‍☠️';
    if (entry === top3[1]) return '⚓';
    if (entry === top3[2]) return '🦜';
    return '';
  };

  return `
    <div class="wof-meta">
      <span>Top covers in the last ${lb.windowDays} days · refreshed ${esc(timeAgo(new Date(lb.generatedAtMs)))}</span>
      <button class="btn-ghost" data-action="refresh-wof" ${state.leaderboardLoading ? 'disabled' : ''}>${state.leaderboardLoading ? 'Refreshing…' : '↻ Refresh'}</button>
    </div>

    <div class="wof-podium">
      ${podiumOrder.map((p) => `
        <div class="podium-place ${podiumClass(p)}">
          <div class="podium-emoji">${podiumEmoji(p)}</div>
          <div class="podium-rank">${p === top3[0] ? '#1' : p === top3[1] ? '#2' : '#3'}</div>
          ${p.photoURL
            ? `<img class="podium-avatar" src="${esc(p.photoURL)}" alt="" referrerpolicy="no-referrer" />`
            : `<div class="podium-avatar-fallback">${esc(initials(p.displayName))}</div>`}
          <div class="podium-name">${esc(shortName(p.displayName))}${p.displayName === meName ? ' (you)' : ''}</div>
          <div class="podium-score">${SVG.doubloon}${p.earnedInWindow}</div>
          <div class="podium-voyages">${p.voyages} voyage${p.voyages === 1 ? '' : 's'}</div>
        </div>
      `).join('')}
    </div>

    ${rest.length > 0 ? `
      <ul class="wof-rest">
        ${rest.map((entry, i) => `
          <li class="wof-row ${entry.displayName === meName ? 'you' : ''}">
            <span class="wof-rank-num">#${i + 4}</span>
            ${entry.photoURL
              ? `<img class="avatar-mini" src="${esc(entry.photoURL)}" alt="" referrerpolicy="no-referrer" />`
              : `<span class="avatar-mini" style="background: var(--parchment-dim); display: inline-block;"></span>`}
            <div class="wof-name">${esc(shortName(entry.displayName))}${entry.displayName === meName ? ' (you)' : ''}<br><small>${entry.voyages} voyage${entry.voyages === 1 ? '' : 's'}</small></div>
            <span class="wof-score">${SVG.doubloon}${entry.earnedInWindow}</span>
            ${entry.uid !== state.user?.uid
              ? `<button class="tip-hat" data-action="tip-hat" data-to-uid="${esc(entry.uid)}" data-to-name="${esc(entry.displayName)}">🪶 TIP HAT</button>`
              : ''}
          </li>
        `).join('')}
      </ul>
    ` : ''}

    ${renderTavern()}
  `;
}

function renderTavern() {
  const scrolls = state.scrolls || [];
  return `
    <section class="tavern">
      <h2>The Tavern · recent scrolls</h2>
      <div class="tavern-meta">Peer recognition. Decoupled from doubloons. Hand someone a tip of the hat for a good cover.</div>
      ${scrolls.length === 0 ? `
        <div class="empty-card" style="padding: 24px;">
          <p><strong>The tavern is quiet.</strong></p>
          <p class="muted">Send the first scroll to a crewmate who covered you well.</p>
        </div>
      ` : `
        <ul class="scrolls">
          ${scrolls.map((s) => `
            <li class="scroll">
              <div class="scroll-head">
                ${s.fromPhotoURL ? `<img class="avatar-mini" src="${esc(s.fromPhotoURL)}" alt="" referrerpolicy="no-referrer" />` : ''}
                <strong>${esc(shortName(s.fromDisplayName))}</strong>
                <span class="arrow">→</span>
                ${s.toPhotoURL ? `<img class="avatar-mini" src="${esc(s.toPhotoURL)}" alt="" referrerpolicy="no-referrer" />` : ''}
                <strong>${esc(shortName(s.toDisplayName))}</strong>
                <small>${esc(timeAgo(s.createdAt?.toDate?.() ?? new Date()))}</small>
              </div>
              <p class="scroll-msg">"${esc(s.message)}"</p>
            </li>
          `).join('')}
        </ul>
      `}
    </section>
  `;
}

/* ============================================================
   Event delegation
   ============================================================ */

document.addEventListener('click', async (e) => {
  // Bell dropdown auto-close
  if (state.bellOpen && !e.target.closest('.bell-dropdown') && !e.target.closest('[data-action="bell"]')) {
    state.bellOpen = false;
    renderUserInfo();
  }
  const t = e.target.closest('[data-action]');
  if (!t) {
    // Bounty card click anywhere except action button opens detail
    const card = e.target.closest('.bounty[data-bounty-id]');
    if (card) showBountyDetail(card.dataset.bountyId);
    return;
  }
  const action = t.dataset.action;
  audio.click();
  if (action === 'sign-in') { e.preventDefault(); await signIn(); }
  else if (action === 'sign-out') { e.preventDefault(); await handleSignOut(); }
  else if (action === 'create-team') {
    e.preventDefault();
    const input = document.getElementById('new-team-name');
    await createTeam(input.value.trim());
  } else if (action === 'join-team') {
    e.preventDefault();
    const input = document.getElementById('join-team-id');
    let raw = input.value.trim();
    const m = raw.match(/#\/join\/([^?&#]+)/);
    if (m) raw = decodeURIComponent(m[1]);
    await joinTeam(raw);
  } else if (action === 'accept') {
    e.preventDefault();
    e.stopPropagation();
    await acceptRequest(t.dataset.id);
  } else if (action === 'copy-invite') {
    e.preventDefault();
    await copyInviteLink(t.dataset.id);
  } else if (action === 'set-filter') {
    e.preventDefault();
    state.bountyFilter = t.dataset.filter;
    render();
  } else if (action === 'bell') {
    e.preventDefault();
    state.bellOpen = !state.bellOpen;
    if (state.bellOpen) {
      state.notifLastSeen = Date.now();
      localStorage.setItem('vacaciones.notifLastSeen', String(state.notifLastSeen));
    }
    renderUserInfo();
  } else if (action === 'sound') {
    e.preventDefault();
    audio.toggle();
    renderUserInfo();
  } else if (action === 'refresh-wof') {
    e.preventDefault();
    refreshLeaderboard();
  } else if (action === 'tip-hat') {
    e.preventDefault();
    e.stopPropagation();
    showSendScrollModal(t.dataset.toUid, t.dataset.toName, null);
  }
});

document.addEventListener('submit', async (e) => {
  if (e.target.id === 'create-form') {
    e.preventDefault();
    syncFormStateFromDom(e.target);
    await postBounty();
  }
});

document.addEventListener('input', (e) => {
  const form = e.target.closest('#create-form');
  if (form) syncFormStateFromDom(form);
});
document.addEventListener('change', (e) => {
  const form = e.target.closest('#create-form');
  if (form) syncFormStateFromDom(form);
});

function syncFormStateFromDom(form) {
  const data = new FormData(form);
  const f = state.formState;
  f.startDate = data.get('startDate') || '';
  f.endDate = data.get('endDate') || '';
  f.timezone = (data.get('timezone') || '').trim();
  f.sla = (data.get('sla') || '').trim();
  f.emergencyDef = (data.get('emergencyDef') || '').trim();
  f.coverageScope = (data.get('coverageScope') || '').trim();
  f.reachability = data.getAll('reachability');
  f.coverageKinds = data.getAll('coverageKinds');
  const previewEl = document.querySelector('.preview');
  if (previewEl) {
    const cost = computeCoverageCost(parseLocalDate(f.startDate), parseLocalDate(f.endDate));
    previewEl.innerHTML = cost.days > 0
      ? `<div class="cost"><strong>${cost.totalCoins}</strong><span>doubloons</span></div>
         <small>${cost.days} day${cost.days === 1 ? '' : 's'} · ${cost.weekdays} weekday · ${cost.weekendDays} weekend</small>`
      : `<small class="muted-light">Pick a window to preview the cost.</small>`;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement?.id === 'new-team-name') {
    e.preventDefault();
    createTeam(document.getElementById('new-team-name').value.trim());
  }
  if (e.key === 'Enter' && document.activeElement?.id === 'join-team-id') {
    e.preventDefault();
    let raw = document.getElementById('join-team-id').value.trim();
    const m = raw.match(/#\/join\/([^?&#]+)/);
    if (m) raw = decodeURIComponent(m[1]);
    joinTeam(raw);
  }
  if (e.key === 'Escape' && state.bellOpen) { state.bellOpen = false; renderUserInfo(); }
});

render();
