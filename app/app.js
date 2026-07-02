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
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {
  getFunctions,
  httpsCallableFromURL,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js';
import { ES as TRANSLATIONS_ES } from './i18n-es.js';

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
  ONBOARDING_GRANT: 125,
  MONTHLY_STIPEND: 11,
  COVERAGE_PRICE_PER_DAY: 5,
  WEEKEND_MULTIPLIER: 2,
  TRANSACTION_FEE: 1,
  DEFAULT_ANNUAL_PTO_DAYS: 25,
};

// `sprite` keys into SVG.icons — hand-drawn 16×16 pixel art replaces OS
// emoji on structural UI (launch-gate item 10).
const REACHABILITY_OPTIONS = [
  { value: 'unreachable', short: 'Unreachable', label: 'Unreachable — true shore leave', sprite: 'unreachable' },
  { value: 'email-only-emergencies', short: 'Email', label: 'Email only, emergencies', sprite: 'email-only' },
  { value: 'phone-emergencies', short: 'Phone', label: 'Phone for P1 emergencies', sprite: 'phone' },
  { value: 'daily-check-in', short: 'Daily check-in', label: 'Daily check-in', sprite: 'daily-check-in' },
];

const COVERAGE_KIND_OPTIONS = [
  { value: 'inbox', label: 'Inbox / email', sprite: 'inbox' },
  { value: 'meetings', label: 'Standing meetings', sprite: 'meetings' },
  { value: 'escalations', label: 'Open escalations', sprite: 'escalations' },
  { value: 'one-on-ones', label: 'Customer 1:1s', sprite: 'one-on-ones' },
  { value: 'chat', label: 'Slack / Chat', sprite: 'chat' },
  { value: 'on-call', label: 'On-call rotation', sprite: 'on-call' },
];

// Inline sprite renderer for the option arrays + ranks.
function spriteIcon(id) {
  return `<span class="icon-16">${SVG.icons[id] ?? ''}</span>`;
}

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

// Sentence case — the pirate skin uppercases badges via CSS; modern skins
// show these as written. Translate with t() at render time.
const STATUS_LABEL = {
  open: 'Open',
  accepted: 'Taken',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
};
const STATUS_PRIORITY = { open: 0, accepted: 1, active: 2, completed: 3, draft: 4, cancelled: 5 };

const STAN_SCENES = [
  { speech: "Ahoy! I'm Stan, harbormaster of Mêlée Bay. New deckhand? Let me show you the ropes." },
  { speech: "Doubloons are how we trade coverage. 5 buy you one day of shore leave. Weekend? Twice as dear — the Crown insists." },
  { speech: "Your starter chest holds 125 doubloons — 25 business days of leave from day one. Spend wisely." },
  { speech: "Every month the Crown drops 11 more stipend doubloons in your purse — that's the year-after-year budget. Use them or watch them vanish at month's end." },
  { speech: "Cover a crewmate's bounty and earn their doubloons as the days pass. Patience, sailor — payouts release one day at a time." },
  { speech: "Top earners over 90 days get the captain's hat on the Wall of Fame. Now form a crew and post your first bounty!" },
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
  { min: 0,    name: 'Cabin Boy',     sprite: 'cabin-boy' },
  { min: 10,   name: 'Deckhand',      sprite: 'deckhand' },
  { min: 25,   name: 'Mate',          sprite: 'mate' },
  { min: 50,   name: 'Bosun',         sprite: 'bosun' },
  { min: 100,  name: 'Quartermaster', sprite: 'quartermaster' },
  { min: 200,  name: 'First Mate',    sprite: 'first-mate' },
  { min: 400,  name: 'Captain',       sprite: 'captain' },
  { min: 800,  name: 'Commodore',     sprite: 'commodore' },
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
const callSetProfile = httpsCallableFromURL(functions, callableURL('setProfile'));
const callCancelBounty = httpsCallableFromURL(functions, callableURL('cancelBounty'));
const callUpdateTeam = httpsCallableFromURL(functions, callableURL('updateTeam'));
const callUpdateCrewSettings = httpsCallableFromURL(functions, callableURL('updateCrewSettings'));
const callGetCrewSettings = httpsCallableFromURL(functions, callableURL('getCrewSettings'));
const callTopUpGrant = httpsCallableFromURL(functions, callableURL('topUpOnboardingGrant'));
const callGetCrewMembers = httpsCallableFromURL(functions, callableURL('getCrewMembers'));
const callReactToScroll = httpsCallableFromURL(functions, callableURL('reactToScroll'));
const callUpdateBountyDetails = httpsCallableFromURL(functions, callableURL('updateBountyDetails'));
const callGenerateBriefing = httpsCallableFromURL(functions, callableURL('generateBriefing'));
const callUpdateMemberRole = httpsCallableFromURL(functions, callableURL('updateMemberRole'));
const callRemoveMember = httpsCallableFromURL(functions, callableURL('removeMember'));
const callGrantBonusDoubloons = httpsCallableFromURL(functions, callableURL('grantBonusDoubloons'));
const callForceCompleteBounty = httpsCallableFromURL(functions, callableURL('forceCompleteBounty'));
const callGetAuditLog = httpsCallableFromURL(functions, callableURL('getAuditLog'));
const callCreateInviteToken = httpsCallableFromURL(functions, callableURL('createInviteToken'));
const callExportMyData = httpsCallableFromURL(functions, callableURL('exportMyData'));
const callDeleteMyAccount = httpsCallableFromURL(functions, callableURL('deleteMyAccount'));
const callDisbandCrew = httpsCallableFromURL(functions, callableURL('disbandCrew'));

/* ============================================================
   Sound module (Web Audio chiptune SFX)
   ============================================================ */

const SKIN_OPTIONS = [
  { id: 'pirate', label: 'Pirate (Monkey Island)', desc: 'Pixel-art parchment + Inter. Pirate vibe, regular legible font.' },
  { id: 'basic', label: 'Basic', desc: 'Clean modern. Inter font, soft shadows, rounded corners.' },
  { id: 'hc', label: 'High Contrast', desc: 'Atkinson Hyperlegible, black/white/yellow. Maximum legibility.' },
  { id: 'dark-knight', label: 'Dark Knight', desc: 'Warm dark theme with amber accents and Geist + Geist Mono fonts. Ultra legible.' },
];

/* ============================================================
   i18n — gettext-style. The key IS the polished English string;
   other languages map EN → translation in TRANSLATIONS below
   (defined at the end of this file — it's long). `t()` falls back
   to the key, so untranslated strings degrade to English, never
   to a blank. Params interpolate as {name}.
   ============================================================ */

const LANG_OPTIONS = [
  { id: 'auto', label: 'Auto (browser)' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

const lang = {
  current() {
    const stored = localStorage.getItem('vacaciones.lang');
    if (stored && stored !== 'auto') return stored;
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return nav === 'es' ? 'es' : 'en';
  },
  stored() { return localStorage.getItem('vacaciones.lang') || 'auto'; },
  set(id) {
    if (!LANG_OPTIONS.some((o) => o.id === id)) return;
    localStorage.setItem('vacaciones.lang', id);
    document.documentElement.lang = this.current();
  },
  locale() { return this.current() === 'es' ? 'es' : 'en-US'; },
};
document.documentElement.lang = lang.current();

function t(text, params) {
  const l = lang.current();
  let s = text;
  if (l !== 'en') s = TRANSLATIONS[l]?.[text] || text;
  if (params) {
    for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}

// Alias for scopes where `t` is shadowed (the global click handler binds
// `t` to the closest [data-action] element).
const tr = t;

// Dictionaries live in their own modules (one per language).
const TRANSLATIONS = { es: TRANSLATIONS_ES };

const skin = {
  current() {
    const stored = localStorage.getItem('vacaciones.skin');
    if (stored && SKIN_OPTIONS.some((s) => s.id === stored)) return stored;
    // First visit (no localStorage): follow OS preference.
    // Dark OS → Dark Knight, Light OS → Basic. Pirate is opt-in.
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark-knight';
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'basic';
      }
    } catch (_) { /* no matchMedia */ }
    return 'dark-knight';
  },
  set(id) {
    if (!SKIN_OPTIONS.some((s) => s.id === id)) return;
    localStorage.setItem('vacaciones.skin', id);
    document.documentElement.dataset.skin = id;
  },
};
document.documentElement.dataset.skin = skin.current();
// Live-update if user changes OS theme while the app is open and they haven't
// explicitly picked a skin yet.
try {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (ev) => {
    if (!localStorage.getItem('vacaciones.skin')) {
      document.documentElement.dataset.skin = ev.matches ? 'dark-knight' : 'basic';
    }
  });
} catch (_) { /* older browsers, ignore */ }

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
  // Promotion fanfare for the rank-up cinematic — 8-bit I–IV–V arpeggio
  // capped with a sparkle. ~0.9s total.
  fanfare() {
    const seq = [
      [392, 0, 0.12], [523, 90, 0.12], [659, 180, 0.12], [784, 270, 0.30],
      [659, 520, 0.10], [784, 620, 0.42],
    ];
    for (const [freq, delay, len] of seq) {
      setTimeout(() => this.tone(freq, len, 'square', 0.06), delay);
    }
    setTimeout(() => this.tone(1568, 0.18, 'triangle', 0.05), 700);
  },
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
  userDoc: null,
  myRole: null,
  crewSettings: null,
  crewSettingsLoading: false,
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
    meetings: [],
    selectedDayKeys: [],
    coverageMode: 'single',
  },
  claim: { bountyId: null, selectedDayKeys: [] },
  crewMembers: [],
  crewMembersLoading: false,
  bountyFilterText: '',
  // 'comfortable' | 'compact' — bounty board row density (gate item 7).
  density: localStorage.getItem('vacaciones.density') || 'comfortable',
  briefingLoading: false,
  auditLog: [],
  auditLogLoading: false,
  calendarEvents: [],
  calendarLoading: false,
  calendarError: null,
  calendarLastWindow: null,
  busy: { signIn: false, createTeam: false, joinTeam: false, postRequest: false, acceptId: null },
};

let unsubTeams = null;
let unsubWallet = null;
let unsubLedger = null;
let unsubRequests = null;
let unsubScrolls = null;
let unsubUserDoc = null;
let unsubMyMember = null;

/* ============================================================
   Utilities
   ============================================================ */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Lightweight, safe Markdown renderer for Gemini briefings. Supports
 * headings, bold, italic, inline code, links, ordered + unordered lists,
 * and paragraphs. All text is HTML-escaped first so this never injects
 * arbitrary HTML — it just promotes the safe subset back to markup.
 */
function renderMarkdown(src) {
  if (!src) return '';
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inList = null; // 'ul' | 'ol' | null
  let para = [];
  const flushPara = () => {
    if (para.length === 0) return;
    out.push('<p>' + inline(para.join(' ')) + '</p>');
    para = [];
  };
  const flushList = () => {
    if (!inList) return;
    out.push(`</${inList}>`);
    inList = null;
  };
  function inline(text) {
    let s = esc(text);
    // Code spans (escape inner already done).
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold then italic.
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    // Links — only http(s).
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushPara(); flushList(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      const lvl = Math.min(6, Math.max(3, h[1].length + 2)); // h1→h3 to keep our heading scale
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }
    const ul = line.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inList !== 'ul') { flushList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (inList !== 'ol') { flushList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return out.join('\n');
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

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function allDayKeysInRange(start, end) {
  if (!start || !end || end < start) return [];
  const out = [];
  const cursor = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  while (cursor.getTime() <= last.getTime()) {
    out.push(formatDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
function computeCostFromKeys(keys) {
  let totalCoins = 0, weekdays = 0, weekendDays = 0;
  for (const key of keys) {
    const d = parseDateKey(key);
    const dow = d.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    totalCoins += ECONOMY.COVERAGE_PRICE_PER_DAY * (isWeekend ? ECONOMY.WEEKEND_MULTIPLIER : 1);
    if (isWeekend) weekendDays++; else weekdays++;
  }
  return { totalCoins, days: keys.length, weekdays, weekendDays };
}
function formatDate(d) {
  if (!d) return '—';
  return d.toLocaleDateString(lang.locale(), { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return '';
  return d.toLocaleString(lang.locale(), { dateStyle: 'medium', timeStyle: 'short' });
}
function timeAgo(d) {
  if (!d) return '';
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return t('just now');
  const m = Math.floor(s / 60);
  if (m < 60) return t('{m} min ago', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('{h}h ago', { h });
  const day = Math.floor(h / 24);
  if (day < 7) return t('{d}d ago', { d: day });
  return d.toLocaleDateString(lang.locale());
}
function firstName(name) {
  if (!name) return t('sailor');
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
   Google Calendar integration
   ============================================================ */

const CAL_TOKEN_KEY = 'vacaciones.calToken';

const calendar = {
  getToken() {
    try {
      const raw = sessionStorage.getItem(CAL_TOKEN_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || obj.expiresAt < Date.now()) return null;
      return obj.token;
    } catch { return null; }
  },
  setToken(token, ttlSec = 3600) {
    sessionStorage.setItem(CAL_TOKEN_KEY, JSON.stringify({
      token, expiresAt: Date.now() + Math.max(60, ttlSec - 60) * 1000,
    }));
  },
  isConnected() { return !!this.getToken(); },
  clearToken() { sessionStorage.removeItem(CAL_TOKEN_KEY); },
  async connect() {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) throw new Error('Calendar access not granted.');
    this.setToken(credential.accessToken);
    return credential.accessToken;
  },
  async listEvents(startMs, endMs) {
    let token = this.getToken();
    if (!token) token = await this.connect();
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', new Date(startMs).toISOString());
    url.searchParams.set('timeMax', new Date(endMs).toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '50');
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      this.clearToken();
      token = await this.connect();
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!res.ok) throw new Error(`Calendar list failed (${res.status})`);
    const data = await res.json();
    return (data.items || []).filter((e) => e.status !== 'cancelled' && e.start && e.end);
  },
  async addEvent(meeting) {
    let token = this.getToken();
    if (!token) token = await this.connect();
    const isAllDay = !meeting.startMs || !meeting.endMs || meeting.startMs % 86400000 === 0;
    const body = {
      summary: `[COVER] ${meeting.summary || '(no title)'}`,
      description: [
        'Covering for a crewmate.',
        meeting.htmlLink ? `Original event: ${meeting.htmlLink}` : null,
        meeting.description ? `\n---\n${meeting.description}` : null,
      ].filter(Boolean).join('\n\n'),
      start: isAllDay ? { date: new Date(meeting.startMs).toISOString().slice(0, 10) }
                     : { dateTime: new Date(meeting.startMs).toISOString() },
      end:   isAllDay ? { date: new Date(meeting.endMs).toISOString().slice(0, 10) }
                     : { dateTime: new Date(meeting.endMs).toISOString() },
      location: meeting.location || undefined,
    };
    let res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      this.clearToken();
      token = await this.connect();
      res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    if (!res.ok) throw new Error(`Calendar add failed (${res.status})`);
    return res.json();
  },
};

function extractConferenceLinks(text) {
  if (!text) return [];
  const re = /https?:\/\/(?:teams\.microsoft\.com|teams\.live\.com|zoom\.us|meet\.google\.com|whereby\.com)\/[^\s<>"')\]]+/gi;
  const matches = text.match(re) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/[.,;)]+$/, '')))).slice(0, 10);
}

function normalizeMeeting(ev) {
  const startMs = new Date(ev.start?.dateTime || ev.start?.date).getTime();
  const endMs = new Date(ev.end?.dateTime || ev.end?.date).getTime();
  const description = (ev.description || '').slice(0, 2000);
  return {
    googleEventId: ev.id,
    summary: (ev.summary || '(no title)').slice(0, 300),
    description,
    startMs,
    endMs,
    location: (ev.location || '').slice(0, 500),
    hangoutLink: ev.hangoutLink || '',
    htmlLink: ev.htmlLink || '',
    conferenceLinks: extractConferenceLinks(description),
    attendees: (ev.attendees || []).slice(0, 50).map((a) => ({
      email: (a.email || '').slice(0, 200),
      displayName: (a.displayName || '').slice(0, 200),
    })),
  };
}

function getAddedMeetingIds(bountyId) {
  try {
    const raw = localStorage.getItem(`vacaciones.addedMeetings.${bountyId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function markMeetingAdded(bountyId, googleEventId) {
  const set = getAddedMeetingIds(bountyId);
  set.add(googleEventId);
  localStorage.setItem(`vacaciones.addedMeetings.${bountyId}`, JSON.stringify(Array.from(set)));
}

function formatMeetingDate(startMs, endMs) {
  const s = new Date(startMs);
  const e = new Date(endMs);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${s.toLocaleDateString(lang.locale(), { month: 'short', day: 'numeric' })} · ${s.toLocaleTimeString(lang.locale(), { hour: 'numeric', minute: '2-digit' })}–${e.toLocaleTimeString(lang.locale(), { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `${s.toLocaleString(lang.locale(), { dateStyle: 'short', timeStyle: 'short' })} → ${e.toLocaleString(lang.locale(), { dateStyle: 'short', timeStyle: 'short' })}`;
}

// Renders an avatar for any uid. For the current user, prefer their chosen
// avatarId (read live from /users/{uid}); for others, fall back to the
// denormalized photoURL stored on the relevant doc; finally fall back to
// initials in a parchment-dim tile.
function renderAvatar({ uid, photoURL, name, size = 32, klass = 'avatar-img' }) {
  const isMe = uid && uid === state.user?.uid;
  const myAvatar = state.userDoc?.avatarId;
  if (isMe && myAvatar && SVG.avatars[myAvatar]) {
    return `<span class="${klass}" style="width:${size}px;height:${size}px;display:inline-block;">${SVG.avatars[myAvatar]}</span>`;
  }
  if (photoURL) {
    return `<img class="${klass}" src="${esc(photoURL)}" alt="${esc(name ?? '')}" referrerpolicy="no-referrer" style="width:${size}px;height:${size}px;" />`;
  }
  return `<span class="${klass} avatar-fallback" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;background:var(--parchment-dim);color:var(--ink-pure);font-family:'Inter',system-ui,sans-serif;font-weight:700;font-size:10px;">${esc(initials(name))}</span>`;
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
    showToast(`${a.icon}  ${t('Achievement unlocked: {name}', { name: t(a.name) })}`, 'success', 5000);
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
    const when = entry.createdAt?.toDate?.();
    if (!when) continue;
    if (entry.type === 'coverageRelease') {
      notifs.push({ kind: 'coin', icon: '🪙', text: t('Earned {n} doubloons by covering.', { n: entry.amountSigned }), time: when });
    } else if (entry.type === 'grant') {
      notifs.push({ kind: 'grant', icon: '🎁', text: t('Welcome chest opened (+{n} doubloons).', { n: entry.amountSigned }), time: when });
    } else if (entry.type === 'stipendMint') {
      notifs.push({ kind: 'stipend', icon: '👑', text: t("Crown's stipend: +{n} doubloons (expires monthly).", { n: entry.amountSigned }), time: when });
    } else if (entry.type === 'feeBurn') {
      notifs.push({ kind: 'fee', icon: '🔥', text: t('Harbour fee: {n} doubloons.', { n: entry.amountSigned }), time: when });
    }
  }
  // Recent open bounties from other crewmates
  for (const b of state.bounties.filter((b) => b.status === 'open' && b.requesterUid !== state.user?.uid).slice(0, 10)) {
    const when = b.createdAt?.toDate?.();
    if (!when) continue;
    notifs.push({
      kind: 'bounty',
      icon: '📜',
      text: t('{name} posted a {n}-doubloon bounty.', { name: shortName(b.requesterDisplayName || t('A crewmate')), n: b.totalCoinsOffered }),
      meta: t('Open'),
      time: when,
    });
  }
  // Status changes on your own bounties
  for (const b of state.bounties.filter((b) => b.requesterUid === state.user?.uid && b.covererUid)) {
    const when = b.updatedAt?.toDate?.();
    if (!when) continue;
    notifs.push({
      kind: 'taken',
      icon: '⚓',
      text: t('{name} took your {n}-doubloon bounty.', { name: shortName(b.covererDisplayName || t('A crewmate')), n: b.totalCoinsOffered }),
      time: when,
    });
  }
  notifs.sort((a, b) => b.time.getTime() - a.time.getTime());
  return notifs.slice(0, 20);
}

/* ============================================================
   SVG sprites
   ============================================================ */

const SVG = {
  // ----------------------------------------------------------------
  // Hand-drawn 16×16 pixel sprites (launch-gate item 10). Same four-tone
  // discipline as the doubloon: gold #FFCB47 / brass #E0A93B / deep
  // #8C6418 / wood #5A3A1F / ink #1A0E08, with red/cyan/green accents.
  // OS emoji stay only on celebratory copy, never structural UI.
  // ----------------------------------------------------------------
  icons: {
    // — Ranks —
    'cabin-boy': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="2" width="8" height="1" fill="#8C6418"/><rect x="3" y="3" width="1" height="2" fill="#8C6418"/><rect x="12" y="3" width="1" height="2" fill="#8C6418"/><rect x="4" y="5" width="8" height="8" fill="#5A3A1F"/><rect x="5" y="5" width="6" height="1" fill="#8C6418"/><rect x="5" y="6" width="2" height="1" fill="#5BC9D1"/><rect x="4" y="8" width="8" height="1" fill="#8C6418"/><rect x="5" y="13" width="6" height="1" fill="#1A0E08"/></svg>`,
    'deckhand': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="7" y="1" width="2" height="1" fill="#E0A93B"/><rect x="6" y="2" width="1" height="2" fill="#E0A93B"/><rect x="9" y="2" width="1" height="2" fill="#E0A93B"/><rect x="7" y="4" width="2" height="1" fill="#E0A93B"/><rect x="7" y="5" width="2" height="7" fill="#E0A93B"/><rect x="4" y="6" width="8" height="1" fill="#8C6418"/><rect x="3" y="10" width="1" height="2" fill="#E0A93B"/><rect x="12" y="10" width="1" height="2" fill="#E0A93B"/><rect x="4" y="12" width="3" height="1" fill="#E0A93B"/><rect x="9" y="12" width="3" height="1" fill="#E0A93B"/><rect x="6" y="13" width="4" height="1" fill="#8C6418"/></svg>`,
    'mate': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="4" height="1" fill="#E0A93B"/><rect x="3" y="4" width="1" height="4" fill="#E0A93B"/><rect x="8" y="4" width="1" height="4" fill="#E0A93B"/><rect x="4" y="8" width="4" height="1" fill="#E0A93B"/><rect x="8" y="7" width="4" height="1" fill="#FFCB47"/><rect x="7" y="8" width="1" height="4" fill="#FFCB47"/><rect x="12" y="8" width="1" height="4" fill="#FFCB47"/><rect x="8" y="12" width="4" height="1" fill="#FFCB47"/><rect x="8" y="8" width="1" height="1" fill="#E0A93B"/></svg>`,
    'bosun': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="8" width="2" height="2" fill="#8C6418"/><rect x="4" y="7" width="6" height="1" fill="#FFD86B"/><rect x="4" y="8" width="6" height="2" fill="#E0A93B"/><rect x="10" y="6" width="2" height="6" fill="#E0A93B"/><rect x="12" y="5" width="2" height="8" fill="#FFCB47"/><rect x="14" y="4" width="1" height="10" fill="#FFD86B"/></svg>`,
    'quartermaster': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="1" height="2" fill="#8C6418"/><rect x="3" y="2" width="10" height="2" fill="#5A3A1F"/><rect x="13" y="2" width="1" height="2" fill="#8C6418"/><rect x="4" y="4" width="8" height="8" fill="#F7E7C2"/><rect x="5" y="6" width="6" height="1" fill="#C4A86B"/><rect x="5" y="8" width="6" height="1" fill="#C4A86B"/><rect x="5" y="10" width="4" height="1" fill="#C4A86B"/><rect x="2" y="12" width="1" height="2" fill="#8C6418"/><rect x="3" y="12" width="10" height="2" fill="#5A3A1F"/><rect x="13" y="12" width="1" height="2" fill="#8C6418"/></svg>`,
    'first-mate': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="5" width="8" height="2" fill="#FFD86B"/><rect x="5" y="5" width="3" height="1" fill="#F7E7C2"/><rect x="4" y="7" width="8" height="1" fill="#E0A93B"/><rect x="4" y="8" width="8" height="2" fill="#FFCB47"/><rect x="4" y="10" width="8" height="1" fill="#8C6418"/><rect x="4" y="11" width="8" height="2" fill="#E0A93B"/><rect x="4" y="13" width="8" height="1" fill="#8C6418"/></svg>`,
    'captain': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="6" y="5" width="4" height="3" fill="#1A0E08"/><rect x="2" y="6" width="2" height="2" fill="#1A0E08"/><rect x="12" y="6" width="2" height="2" fill="#1A0E08"/><rect x="2" y="8" width="12" height="2" fill="#1A0E08"/><rect x="3" y="9" width="10" height="1" fill="#E0A93B"/><rect x="7" y="6" width="2" height="1" fill="#FFCB47"/></svg>`,
    'commodore': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="2" height="2" fill="#F7E7C2"/><rect x="4" y="4" width="2" height="2" fill="#F7E7C2"/><rect x="6" y="6" width="2" height="2" fill="#F7E7C2"/><rect x="8" y="8" width="2" height="2" fill="#F7E7C2"/><rect x="12" y="2" width="2" height="2" fill="#F7E7C2"/><rect x="10" y="4" width="2" height="2" fill="#F7E7C2"/><rect x="8" y="6" width="2" height="2" fill="#F7E7C2"/><rect x="6" y="8" width="2" height="2" fill="#F7E7C2"/><rect x="4" y="10" width="3" height="1" fill="#FFCB47"/><rect x="5" y="9" width="1" height="3" fill="#FFCB47"/><rect x="9" y="10" width="3" height="1" fill="#FFCB47"/><rect x="10" y="9" width="1" height="3" fill="#FFCB47"/><rect x="3" y="11" width="2" height="2" fill="#5A3A1F"/><rect x="11" y="11" width="2" height="2" fill="#5A3A1F"/></svg>`,
    // — Coverage kinds —
    'inbox': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4" width="12" height="8" fill="#F7E7C2"/><rect x="2" y="4" width="12" height="1" fill="#5A3A1F"/><rect x="2" y="11" width="12" height="1" fill="#5A3A1F"/><rect x="2" y="4" width="1" height="8" fill="#5A3A1F"/><rect x="13" y="4" width="1" height="8" fill="#5A3A1F"/><rect x="3" y="5" width="1" height="1" fill="#8C6418"/><rect x="4" y="6" width="1" height="1" fill="#8C6418"/><rect x="5" y="7" width="1" height="1" fill="#8C6418"/><rect x="6" y="8" width="2" height="1" fill="#8C6418"/><rect x="12" y="5" width="1" height="1" fill="#8C6418"/><rect x="11" y="6" width="1" height="1" fill="#8C6418"/><rect x="10" y="7" width="1" height="1" fill="#8C6418"/><rect x="8" y="8" width="2" height="1" fill="#8C6418"/></svg>`,
    'meetings': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="2" width="1" height="2" fill="#5A3A1F"/><rect x="10" y="2" width="1" height="2" fill="#5A3A1F"/><rect x="3" y="3" width="10" height="3" fill="#C8362D"/><rect x="3" y="3" width="10" height="1" fill="#E25347"/><rect x="3" y="6" width="10" height="8" fill="#F7E7C2"/><rect x="3" y="6" width="1" height="8" fill="#5A3A1F"/><rect x="12" y="6" width="1" height="8" fill="#5A3A1F"/><rect x="3" y="13" width="10" height="1" fill="#5A3A1F"/><rect x="5" y="8" width="1" height="1" fill="#8C6418"/><rect x="7" y="8" width="1" height="1" fill="#8C6418"/><rect x="9" y="8" width="1" height="1" fill="#8C6418"/><rect x="5" y="10" width="1" height="1" fill="#8C6418"/><rect x="7" y="10" width="1" height="1" fill="#8C6418"/><rect x="9" y="10" width="1" height="1" fill="#8C6418"/></svg>`,
    'escalations': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="7" y="2" width="2" height="2" fill="#C8362D"/><rect x="6" y="4" width="4" height="2" fill="#C8362D"/><rect x="5" y="6" width="6" height="3" fill="#C8362D"/><rect x="4" y="9" width="8" height="4" fill="#C8362D"/><rect x="5" y="13" width="6" height="1" fill="#E25347"/><rect x="7" y="8" width="2" height="2" fill="#FFCB47"/><rect x="6" y="10" width="4" height="3" fill="#FFCB47"/><rect x="7" y="11" width="2" height="2" fill="#F7E7C2"/></svg>`,
    'one-on-ones': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="4" width="4" height="4" fill="#E0A93B"/><rect x="2" y="9" width="6" height="4" fill="#8C6418"/><rect x="9" y="4" width="4" height="4" fill="#5BC9D1"/><rect x="8" y="9" width="6" height="4" fill="#1E5A6B"/></svg>`,
    'chat': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="8" fill="#F7E7C2"/><rect x="2" y="3" width="12" height="1" fill="#5A3A1F"/><rect x="2" y="3" width="1" height="8" fill="#5A3A1F"/><rect x="13" y="3" width="1" height="8" fill="#5A3A1F"/><rect x="2" y="10" width="12" height="1" fill="#5A3A1F"/><rect x="4" y="11" width="2" height="1" fill="#5A3A1F"/><rect x="4" y="12" width="1" height="1" fill="#5A3A1F"/><rect x="5" y="6" width="1" height="2" fill="#1A0E08"/><rect x="8" y="6" width="1" height="2" fill="#1A0E08"/><rect x="11" y="6" width="1" height="2" fill="#1A0E08"/></svg>`,
    'on-call': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="7" y="2" width="2" height="1" fill="#8C6418"/><rect x="6" y="3" width="4" height="2" fill="#FFCB47"/><rect x="5" y="5" width="6" height="3" fill="#FFCB47"/><rect x="4" y="8" width="8" height="2" fill="#FFCB47"/><rect x="10" y="5" width="1" height="5" fill="#E0A93B"/><rect x="3" y="10" width="10" height="1" fill="#8C6418"/><rect x="7" y="11" width="2" height="2" fill="#1A0E08"/></svg>`,
    // — Reachability —
    'unreachable': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="12" width="10" height="2" fill="#E0A93B"/><rect x="4" y="11" width="8" height="1" fill="#FFD86B"/><rect x="8" y="6" width="1" height="6" fill="#8C6418"/><rect x="9" y="5" width="1" height="2" fill="#8C6418"/><rect x="7" y="3" width="2" height="1" fill="#4A8A38"/><rect x="5" y="4" width="3" height="1" fill="#4A8A38"/><rect x="4" y="5" width="2" height="1" fill="#3A6B2C"/><rect x="9" y="3" width="3" height="1" fill="#4A8A38"/><rect x="12" y="4" width="2" height="1" fill="#3A6B2C"/><rect x="10" y="5" width="2" height="1" fill="#4A8A38"/><rect x="8" y="5" width="1" height="1" fill="#5A3A1F"/></svg>`,
    'email-only': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="5" width="10" height="7" fill="#F7E7C2"/><rect x="2" y="5" width="10" height="1" fill="#5A3A1F"/><rect x="2" y="11" width="10" height="1" fill="#5A3A1F"/><rect x="2" y="5" width="1" height="7" fill="#5A3A1F"/><rect x="11" y="5" width="1" height="7" fill="#5A3A1F"/><rect x="3" y="6" width="1" height="1" fill="#8C6418"/><rect x="4" y="7" width="1" height="1" fill="#8C6418"/><rect x="5" y="8" width="2" height="1" fill="#8C6418"/><rect x="10" y="6" width="1" height="1" fill="#8C6418"/><rect x="9" y="7" width="1" height="1" fill="#8C6418"/><rect x="7" y="8" width="2" height="1" fill="#8C6418"/><rect x="11" y="2" width="4" height="4" fill="#C8362D"/><rect x="11" y="2" width="4" height="1" fill="#E25347"/><rect x="12" y="3" width="1" height="2" fill="#F7E7C2"/></svg>`,
    'phone': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="4" height="3" fill="#1A0E08"/><rect x="3" y="4" width="2" height="1" fill="#5BC9D1"/><rect x="4" y="5" width="2" height="2" fill="#1A0E08"/><rect x="6" y="7" width="2" height="2" fill="#1A0E08"/><rect x="8" y="9" width="2" height="2" fill="#1A0E08"/><rect x="10" y="10" width="4" height="3" fill="#1A0E08"/><rect x="11" y="11" width="2" height="1" fill="#5BC9D1"/></svg>`,
    'daily-check-in': `<svg class="px" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="2" width="1" height="2" fill="#5A3A1F"/><rect x="10" y="2" width="1" height="2" fill="#5A3A1F"/><rect x="3" y="3" width="10" height="3" fill="#C8362D"/><rect x="3" y="3" width="10" height="1" fill="#E25347"/><rect x="3" y="6" width="10" height="8" fill="#F7E7C2"/><rect x="3" y="6" width="1" height="8" fill="#5A3A1F"/><rect x="12" y="6" width="1" height="8" fill="#5A3A1F"/><rect x="3" y="13" width="10" height="1" fill="#5A3A1F"/><rect x="5" y="9" width="1" height="2" fill="#3A6B2C"/><rect x="6" y="10" width="1" height="2" fill="#3A6B2C"/><rect x="7" y="9" width="1" height="2" fill="#4A8A38"/><rect x="8" y="8" width="1" height="2" fill="#4A8A38"/><rect x="9" y="7" width="1" height="2" fill="#4A8A38"/></svg>`,
  },
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

// Ten 8-bit pirate avatars (5 male, 5 female). Distinguishing features:
// hat type, skin tone, hair, beard/no beard, eyepatch, earrings.
SVG.avatars = {
  // M1: Tricorne captain with full brown beard
  m1: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#2A1810"/><rect x="12" y="26" width="8" height="6" fill="#3D2418"/><rect x="15" y="25" width="2" height="7" fill="#E0A93B"/><rect x="9" y="10" width="14" height="14" fill="#E8C49D"/><rect x="8" y="11" width="1" height="12" fill="#D3A87B"/><rect x="23" y="11" width="1" height="12" fill="#D3A87B"/><rect x="6" y="5" width="20" height="2" fill="#1A0E08"/><rect x="5" y="7" width="22" height="3" fill="#1A0E08"/><rect x="11" y="4" width="10" height="1" fill="#1A0E08"/><rect x="15" y="9" width="2" height="1" fill="#E0A93B"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="20" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="15" y="17" width="2" height="2" fill="#D3A87B"/><rect x="11" y="19" width="10" height="2" fill="#5A3A1F"/><rect x="12" y="21" width="8" height="2" fill="#5A3A1F"/><rect x="13" y="23" width="6" height="1" fill="#5A3A1F"/><rect x="13" y="18" width="6" height="1" fill="#5A3A1F"/></svg>`,
  // M2: Red bandana + eyepatch + goatee
  m2: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#3D2418"/><rect x="9" y="10" width="14" height="14" fill="#C49460"/><rect x="8" y="11" width="1" height="12" fill="#9C6E45"/><rect x="23" y="11" width="1" height="12" fill="#9C6E45"/><rect x="8" y="7" width="16" height="4" fill="#C8362D"/><rect x="8" y="7" width="16" height="1" fill="#E25347"/><rect x="20" y="11" width="3" height="3" fill="#C8362D"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="10" y="13" width="4" height="4" fill="#1A0E08"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="8" y="14" width="2" height="1" fill="#1A0E08"/><rect x="15" y="17" width="2" height="2" fill="#9C6E45"/><rect x="14" y="20" width="4" height="2" fill="#1A0E08"/><rect x="15" y="22" width="2" height="2" fill="#1A0E08"/><rect x="13" y="19" width="6" height="1" fill="#1A0E08"/></svg>`,
  // M3: Captain's hat with feather, grey beard
  m3: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#1A0E08"/><rect x="12" y="26" width="8" height="6" fill="#5A3A1F"/><rect x="15" y="25" width="2" height="7" fill="#E0A93B"/><rect x="9" y="10" width="14" height="14" fill="#8B5A2B"/><rect x="8" y="11" width="1" height="12" fill="#6B3F1E"/><rect x="23" y="11" width="1" height="12" fill="#6B3F1E"/><rect x="5" y="6" width="22" height="4" fill="#1A0E08"/><rect x="9" y="4" width="14" height="2" fill="#1A0E08"/><rect x="7" y="3" width="2" height="3" fill="#C8362D"/><rect x="6" y="2" width="2" height="2" fill="#C8362D"/><rect x="15" y="8" width="2" height="2" fill="#F7E7C2"/><rect x="14" y="9" width="4" height="1" fill="#F7E7C2"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="20" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="15" y="17" width="2" height="2" fill="#6B3F1E"/><rect x="11" y="19" width="10" height="2" fill="#D9D9D9"/><rect x="12" y="21" width="8" height="2" fill="#D9D9D9"/><rect x="13" y="23" width="6" height="1" fill="#D9D9D9"/><rect x="13" y="18" width="6" height="1" fill="#D9D9D9"/></svg>`,
  // M4: Bald with scar + hoop earring
  m4: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#2A1810"/><rect x="12" y="26" width="8" height="6" fill="#3D2418"/><rect x="9" y="8" width="14" height="16" fill="#E8C49D"/><rect x="8" y="9" width="1" height="14" fill="#D3A87B"/><rect x="23" y="9" width="1" height="14" fill="#D3A87B"/><rect x="10" y="7" width="12" height="1" fill="#D3A87B"/><rect x="11" y="6" width="10" height="1" fill="#D3A87B"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="20" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="14" y="10" width="4" height="1" fill="#9C5A45"/><rect x="13" y="11" width="1" height="1" fill="#9C5A45"/><rect x="15" y="17" width="2" height="2" fill="#D3A87B"/><rect x="13" y="21" width="6" height="1" fill="#5A3A1F"/><rect x="11" y="22" width="10" height="2" fill="#5A3A1F"/><rect x="22" y="16" width="2" height="2" fill="#E0A93B"/><rect x="23" y="17" width="1" height="2" fill="#1A0E08"/></svg>`,
  // M5: Skull tricorne, blond mustache (no beard)
  m5: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#3D2418"/><rect x="12" y="26" width="8" height="6" fill="#5A3A1F"/><rect x="9" y="10" width="14" height="14" fill="#E8C49D"/><rect x="8" y="11" width="1" height="12" fill="#D3A87B"/><rect x="23" y="11" width="1" height="12" fill="#D3A87B"/><rect x="6" y="5" width="20" height="2" fill="#1A0E08"/><rect x="5" y="7" width="22" height="3" fill="#1A0E08"/><rect x="11" y="4" width="10" height="1" fill="#1A0E08"/><rect x="14" y="7" width="4" height="3" fill="#F7E7C2"/><rect x="15" y="8" width="1" height="1" fill="#1A0E08"/><rect x="16" y="8" width="1" height="1" fill="#1A0E08"/><rect x="15" y="10" width="2" height="1" fill="#1A0E08"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="11" y="13" width="2" height="1" fill="#FFD86B"/><rect x="19" y="13" width="2" height="1" fill="#FFD86B"/><rect x="12" y="14" width="1" height="1" fill="#5BC9D1"/><rect x="20" y="14" width="1" height="1" fill="#5BC9D1"/><rect x="15" y="17" width="2" height="2" fill="#D3A87B"/><rect x="13" y="19" width="6" height="1" fill="#FFD86B"/><rect x="14" y="20" width="4" height="1" fill="#FFD86B"/><rect x="14" y="22" width="4" height="1" fill="#1A0E08"/></svg>`,
  // F1: Red bandana with long black braid + hoop earrings
  f1: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#5A3A1F"/><rect x="9" y="10" width="14" height="14" fill="#E8C49D"/><rect x="8" y="11" width="1" height="12" fill="#D3A87B"/><rect x="23" y="11" width="1" height="12" fill="#D3A87B"/><rect x="8" y="9" width="16" height="2" fill="#1A0E08"/><rect x="8" y="7" width="16" height="3" fill="#C8362D"/><rect x="8" y="7" width="16" height="1" fill="#E25347"/><rect x="20" y="10" width="3" height="3" fill="#C8362D"/><rect x="14" y="22" width="4" height="8" fill="#1A0E08"/><rect x="15" y="22" width="2" height="10" fill="#1A0E08"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="20" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="11" y="13" width="2" height="1" fill="#1A0E08"/><rect x="19" y="13" width="2" height="1" fill="#1A0E08"/><rect x="15" y="17" width="2" height="2" fill="#D3A87B"/><rect x="13" y="20" width="6" height="2" fill="#C8362D"/><rect x="14" y="21" width="4" height="1" fill="#FFD86B"/><rect x="7" y="16" width="2" height="2" fill="#E0A93B"/><rect x="23" y="16" width="2" height="2" fill="#E0A93B"/></svg>`,
  // F2: Black tricorne + brown braid behind shoulder
  f2: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#3D2418"/><rect x="12" y="26" width="8" height="6" fill="#8B5A2B"/><rect x="9" y="10" width="14" height="14" fill="#C49460"/><rect x="8" y="11" width="1" height="12" fill="#9C6E45"/><rect x="23" y="11" width="1" height="12" fill="#9C6E45"/><rect x="6" y="5" width="20" height="2" fill="#1A0E08"/><rect x="5" y="7" width="22" height="3" fill="#1A0E08"/><rect x="11" y="4" width="10" height="1" fill="#1A0E08"/><rect x="15" y="9" width="2" height="1" fill="#E0A93B"/><rect x="22" y="12" width="3" height="6" fill="#8C6418"/><rect x="22" y="18" width="2" height="4" fill="#8C6418"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="20" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="14" y="13" width="3" height="1" fill="#1A0E08"/><rect x="19" y="13" width="2" height="1" fill="#1A0E08"/><rect x="15" y="17" width="2" height="2" fill="#9C6E45"/><rect x="13" y="20" width="6" height="2" fill="#C8362D"/><rect x="14" y="21" width="4" height="1" fill="#FFD86B"/></svg>`,
  // F3: Captain's hat with red feather, red curly hair, hoops
  f3: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#1A0E08"/><rect x="12" y="26" width="8" height="6" fill="#5A3A1F"/><rect x="9" y="10" width="14" height="14" fill="#8B5A2B"/><rect x="8" y="11" width="1" height="12" fill="#6B3F1E"/><rect x="23" y="11" width="1" height="12" fill="#6B3F1E"/><rect x="5" y="6" width="22" height="4" fill="#1A0E08"/><rect x="9" y="4" width="14" height="2" fill="#1A0E08"/><rect x="7" y="3" width="2" height="3" fill="#C8362D"/><rect x="6" y="2" width="2" height="2" fill="#C8362D"/><rect x="15" y="8" width="2" height="2" fill="#FFD86B"/><rect x="14" y="9" width="4" height="1" fill="#FFD86B"/><rect x="8" y="10" width="2" height="6" fill="#C8362D"/><rect x="22" y="10" width="2" height="6" fill="#C8362D"/><rect x="7" y="11" width="1" height="4" fill="#C8362D"/><rect x="24" y="11" width="1" height="4" fill="#C8362D"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="20" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="15" y="17" width="2" height="2" fill="#6B3F1E"/><rect x="13" y="20" width="6" height="2" fill="#C8362D"/><rect x="14" y="21" width="4" height="1" fill="#FFD86B"/><rect x="7" y="16" width="2" height="2" fill="#E0A93B"/><rect x="23" y="16" width="2" height="2" fill="#E0A93B"/></svg>`,
  // F4: Eyepatch + long blonde wavy hair + neck scarf
  f4: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#2A1810"/><rect x="10" y="23" width="12" height="3" fill="#5BC9D1"/><rect x="9" y="10" width="14" height="14" fill="#F2D2A8"/><rect x="8" y="11" width="1" height="12" fill="#D9B585"/><rect x="23" y="11" width="1" height="12" fill="#D9B585"/><rect x="8" y="6" width="16" height="6" fill="#FFD86B"/><rect x="7" y="9" width="2" height="10" fill="#FFD86B"/><rect x="23" y="9" width="2" height="10" fill="#FFD86B"/><rect x="6" y="12" width="2" height="6" fill="#FFD86B"/><rect x="24" y="12" width="2" height="6" fill="#FFD86B"/><rect x="9" y="5" width="14" height="2" fill="#FFD86B"/><rect x="8" y="8" width="2" height="2" fill="#E0A93B"/><rect x="22" y="8" width="2" height="2" fill="#E0A93B"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="10" y="13" width="4" height="4" fill="#1A0E08"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="9" y="14" width="1" height="2" fill="#1A0E08"/><rect x="15" y="17" width="2" height="2" fill="#D9B585"/><rect x="13" y="20" width="6" height="2" fill="#C8362D"/><rect x="14" y="21" width="4" height="1" fill="#FFD86B"/></svg>`,
  // F5: Bandana with bow, dark skin, big smile, hoop earrings
  f5: `<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1E2D4A"/><rect x="11" y="25" width="10" height="7" fill="#5A3A1F"/><rect x="9" y="10" width="14" height="14" fill="#6B3F1E"/><rect x="8" y="11" width="1" height="12" fill="#4D2A14"/><rect x="23" y="11" width="1" height="12" fill="#4D2A14"/><rect x="8" y="7" width="16" height="3" fill="#5BC9D1"/><rect x="8" y="7" width="16" height="1" fill="#8FE0E5"/><rect x="20" y="10" width="3" height="3" fill="#5BC9D1"/><rect x="22" y="6" width="3" height="2" fill="#5BC9D1"/><rect x="24" y="5" width="2" height="3" fill="#5BC9D1"/><rect x="11" y="14" width="2" height="2" fill="#1A0E08"/><rect x="19" y="14" width="2" height="2" fill="#1A0E08"/><rect x="12" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="20" y="14" width="1" height="1" fill="#F7E7C2"/><rect x="15" y="17" width="2" height="2" fill="#4D2A14"/><rect x="13" y="20" width="6" height="2" fill="#F7E7C2"/><rect x="13" y="21" width="6" height="1" fill="#C8362D"/><rect x="7" y="16" width="2" height="2" fill="#E0A93B"/><rect x="23" y="16" width="2" height="2" fill="#E0A93B"/></svg>`,
};

const AVATAR_LIST = ['m1', 'm2', 'm3', 'm4', 'm5', 'f1', 'f2', 'f3', 'f4', 'f5'];

/* ============================================================
   Routing
   ============================================================ */

function parseHash() {
  const h = location.hash || '#/';
  if (h === '#/help') return { view: 'help' };
  if (h.startsWith('#/team/')) {
    const rest = h.slice('#/team/'.length);
    const [tid, sub] = rest.split('/');
    let tab = 'bounties';
    if (sub === 'chest') tab = 'chest';
    else if (sub === 'post') tab = 'post';
    else if (sub === 'wof') tab = 'wof';
    else if (sub === 'settings') tab = 'settings';
    else if (sub === 'members') tab = 'members';
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
  // Lazy load crew settings when settings tab opens (manager only)
  if (state.view === 'team' && state.teamTab === 'settings') refreshCrewSettings();
  // Lazy load crew members when members tab opens
  if (state.view === 'team' && state.teamTab === 'members') refreshCrewMembers();
  // Lazy load audit log on settings open (manager only)
  if (state.view === 'team' && state.teamTab === 'settings' && state.myRole === 'manager') refreshAuditLog();

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
      showToast(t('Could not register your sailor card: {msg}', { msg: err.message }), 'error', 5000);
    }
    subscribeMyTeams();
    subscribeUserDoc();
    applyRoute();
  } else {
    teardownAllSubs();
    state.view = 'login';
    state.teamId = null;
    state.userDoc = null;
    state.myRole = null;
    state.prevLedgerIds = new Set();
    render();
  }
});

function subscribeUserDoc() {
  unsubUserDoc?.();
  if (!state.user) return;
  unsubUserDoc = onSnapshot(
    doc(db, `users/${state.user.uid}`),
    (snap) => { state.userDoc = snap.exists() ? snap.data() : null; render(); },
    (err) => console.error('userDoc query failed', err),
  );
}

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
  closeAllModals();
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
      showToast(t('Could not load your crews: {msg}', { msg: err.message }), 'error', 5000);
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
  state.myRole = null;

  unsubMyMember = onSnapshot(
    doc(db, `teams/${teamId}/members/${state.user.uid}`),
    (snap) => { state.myRole = snap.exists() ? (snap.data()?.role ?? 'member') : null; render(); },
    (err) => console.error('myMember query failed', err),
  );

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
      maybeShowRankCinematic(stats);
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
  unsubMyMember?.(); unsubMyMember = null;
  state.myRole = null;
}
function teardownAllSubs() {
  unsubTeams?.(); unsubTeams = null;
  unsubUserDoc?.(); unsubUserDoc = null;
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
    showToast(t('Crew "{name}" formed. 125 doubloons in your chest.', { name }), 'success');
    audio.coin();
    const input = document.getElementById('new-team-name');
    if (input) input.value = '';
    navigate('team', result.data.teamId);
  } catch (err) { showToast(err.message, 'error', 5000); }
  finally { state.busy.createTeam = false; render(); }
}

async function joinTeam(tokenOrLegacyId) {
  if (state.busy.joinTeam || !tokenOrLegacyId) return;
  state.busy.joinTeam = true; render();
  try {
    // The server resolves invite tokens (tk_…); legacy raw crew IDs get a
    // clear "ask a manager for a fresh link" rejection.
    const result = await callJoinTeam({ token: tokenOrLegacyId });
    if (result.data.alreadyMember) showToast(t('You’re already aboard that crew.'), 'info');
    else { showToast(t('Signed aboard! 125 doubloons in your chest.'), 'success'); audio.coin(); }
    const input = document.getElementById('join-team-id');
    if (input) input.value = '';
    navigate('team', result.data.teamId);
  } catch (err) { showToast(err.message, 'error', 6000); }
  finally { state.busy.joinTeam = false; render(); }
}

async function postBounty() {
  if (state.busy.postRequest) return;
  const f = state.formState;
  const start = parseLocalDate(f.startDate);
  const end = parseLocalDate(f.endDate);
  if (!start || !end || end < start) { showToast(t('Pick a valid date window.'), 'error'); return; }
  if (f.reachability.length === 0) { showToast(t('Pick at least one reachability option.'), 'error'); return; }
  state.busy.postRequest = true; render();
  try {
    const selectedDayKeys = f.selectedDayKeys.length > 0 ? f.selectedDayKeys : allDayKeysInRange(start, end);
    if (selectedDayKeys.length === 0) {
      showToast(t('Pick at least one day to be covered.'), 'error');
      state.busy.postRequest = false; render();
      return;
    }
    const result = await callCreateCoverageRequest({
      teamId: state.teamId,
      windowStartIso: start.toISOString(),
      windowEndIso: end.toISOString(),
      timezone: f.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      selectedDayKeys,
      coverageMode: f.coverageMode || 'single',
      reachability: f.reachability,
      coverageKinds: f.coverageKinds,
      coverageScope: f.coverageScope || null,
      sla: f.sla,
      emergencyDef: f.emergencyDef || null,
      meetings: f.meetings,
    });
    showToast(t('Bounty posted for {n} doubloons.', { n: result.data.coinsOffered }), 'success');
    state.formState = {
      startDate: '', endDate: '', timezone: state.formState.timezone,
      reachability: ['email-only-emergencies'], coverageKinds: [], coverageScope: '',
      sla: state.formState.sla, emergencyDef: '', meetings: [], selectedDayKeys: [],
      coverageMode: 'single',
    };
    state.calendarEvents = [];
    state.calendarLastWindow = null;
    navigate('team', state.teamId, 'bounties');
  } catch (err) { showToast(err.message, 'error', 6000); }
  finally { state.busy.postRequest = false; render(); }
}

async function acceptRequest(requestId, dayKeysToClaim) {
  if (state.busy.acceptId) return;
  state.busy.acceptId = requestId; render();
  try {
    const payload = { teamId: state.teamId, requestId };
    if (dayKeysToClaim && dayKeysToClaim.length > 0) {
      payload.dayKeysToClaim = dayKeysToClaim;
    }
    const result = await callAcceptCoverageRequest(payload);
    const days = result.data.claimedDayKeys?.length ?? 0;
    const allClaimed = !!result.data.allClaimed;
    const msg = allClaimed
      ? `Voyage accepted in full. ${result.data.coinsEscrowed} doubloons in escrow.`
      : `Took ${days} day${days === 1 ? '' : 's'}. ${result.data.coinsEscrowed} doubloons in escrow.`;
    showToast(msg, 'success');
    audio.coin();
  } catch (err) { showToast(err.message, 'error', 6000); }
  finally { state.busy.acceptId = null; render(); }
}

function startCrewClaim(bountyId) {
  state.claim.bountyId = bountyId;
  state.claim.selectedDayKeys = [];
  showCrewClaimModal();
}

function showCrewClaimModal() {
  const b = state.bounties.find((x) => x.id === state.claim.bountyId);
  if (!b) return;
  const allKeys = arr(b.selectedDayKeys);
  const coverers = b.dayCoverers || {};
  const renderInner = () => {
    const selectedSet = new Set(state.claim.selectedDayKeys);
    const cost = computeCostFromKeys(state.claim.selectedDayKeys);
    return `
      <p style="margin: 0 0 8px;">${esc(t('Pick the days you can cover. Unclaimed days are tappable.'))}</p>
      <ul class="day-list">
        ${allKeys.map((key) => {
          const d = parseDateKey(key);
          const dow = d.getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const dayCoverer = coverers[key];
          const claimedByMe = dayCoverer?.uid === state.user?.uid;
          const claimedByOther = !!dayCoverer && !claimedByMe;
          const selected = selectedSet.has(key);
          const klass = claimedByOther
            ? 'day-card claimed'
            : claimedByMe
              ? 'day-card mine'
              : selected
                ? `day-card selected ${isWeekend ? 'weekend' : ''}`
                : `day-card off ${isWeekend ? 'weekend' : ''}`;
          const inner = claimedByOther
            ? `<small>${esc(t('Taken'))}</small>${dayCoverer?.displayName ? `<small style="font-size: 10px;">${esc(shortName(dayCoverer.displayName))}</small>` : ''}`
            : claimedByMe
              ? `<small>${esc(t('Yours'))}</small>`
              : `<span class="day-cost">${isWeekend ? 10 : 5} <small>${SVG.doubloon}</small></span>`;
          return `
            <li class="${klass}" ${(claimedByOther || claimedByMe) ? '' : `data-action="claim-toggle-day" data-day-key="${esc(key)}"`}>
              <strong>${esc(t(WEEKDAY_NAMES[dow]))}</strong>
              <span class="day-date">${d.getUTCDate()} ${esc(t(MONTH_NAMES[d.getUTCMonth()]))}</span>
              ${inner}
            </li>
          `;
        }).join('')}
      </ul>
      <p style="margin: 12px 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;">
        <strong>${esc(t('{n} days', { n: state.claim.selectedDayKeys.length }))}</strong> ·
        <strong style="color: var(--brass-deep);">${esc(t('{n} doubloons', { n: cost.totalCoins }))}</strong>
      </p>
    `;
  };
  // Custom inline modal (so we can re-render the contents on toggles without closing it)
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'modal-scrim';
  wrap.innerHTML = `
    <div class="modal wide">
      <div class="modal-title">${esc(t('Claim your days'))}</div>
      <div class="modal-body" id="crew-claim-body">${renderInner()}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="claim-cancel">${esc(t('Cancel'))}</button>
        <button class="btn" data-action="claim-submit" ${state.claim.selectedDayKeys.length === 0 ? 'disabled' : ''}>
          ${esc(t('Take {n} days', { n: state.claim.selectedDayKeys.length }))}
        </button>
      </div>
    </div>`;
  wrap.addEventListener('click', async (e) => {
    if (e.target === wrap) { wrap.remove(); state.claim.bountyId = null; }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'claim-cancel') { wrap.remove(); state.claim.bountyId = null; }
    if (action === 'claim-toggle-day') {
      const k = e.target.closest('[data-day-key]')?.dataset.dayKey;
      if (!k) return;
      const idx = state.claim.selectedDayKeys.indexOf(k);
      if (idx >= 0) state.claim.selectedDayKeys.splice(idx, 1);
      else state.claim.selectedDayKeys.push(k);
      // Re-render the contents without closing the modal
      const body = document.getElementById('crew-claim-body');
      if (body) body.innerHTML = renderInner();
      const submit = wrap.querySelector('[data-action="claim-submit"]');
      if (submit) {
        const n = state.claim.selectedDayKeys.length;
        submit.textContent = `Take ${n} day${n === 1 ? '' : 's'}`;
        if (n === 0) submit.setAttribute('disabled', '');
        else submit.removeAttribute('disabled');
      }
      audio.click();
    }
    if (action === 'claim-submit') {
      if (state.claim.selectedDayKeys.length === 0) return;
      const bountyId = state.claim.bountyId;
      const days = state.claim.selectedDayKeys.slice();
      wrap.remove();
      state.claim.bountyId = null;
      await acceptRequest(bountyId, days);
    }
  });
  root.appendChild(wrap);
}

async function setAvatar(avatarId) {
  try {
    await callSetProfile({ avatarId });
    showToast(t('Avatar updated.'), 'success');
    audio.coin();
  } catch (err) {
    showToast(t('Could not set avatar: {msg}', { msg: err.message }), 'error', 5000);
  }
}

async function setDigestEnabled(enabled) {
  try {
    await callSetProfile({ digestEnabled: !!enabled });
    showToast(enabled ? 'Daily digest on.' : 'Daily digest off.', 'success');
  } catch (err) {
    showToast(t('Could not update notification preference: {msg}', { msg: err.message }), 'error', 5000);
  }
}

async function cancelBountyAction(requestId) {
  try {
    const result = await callCancelBounty({ teamId: state.teamId, requestId });
    if (result.data.refunded > 0) {
      showToast(t('Bounty cancelled. {n} doubloons refunded.', { n: result.data.refunded }), 'success');
    } else {
      showToast(t('Bounty cancelled.'), 'success');
    }
  } catch (err) {
    showToast(err.message, 'error', 6000);
  }
}

async function updateTeamAction(teamId, name, photoURL) {
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (photoURL !== undefined) data.photoURL = photoURL;
    await callUpdateTeam({ teamId, ...data });
    showToast(t('Crew updated.'), 'success');
  } catch (err) {
    showToast(err.message, 'error', 6000);
  }
}

async function refreshCalendarEvents() {
  const f = state.formState;
  const start = parseLocalDate(f.startDate);
  const end = parseLocalDate(f.endDate);
  if (!start || !end || end < start) return;
  // Bump end by one day so we cover the full last day (Calendar timeMax is exclusive)
  const endExclusive = new Date(end.getTime() + 86400000);
  const winKey = `${start.getTime()}_${end.getTime()}`;
  state.calendarLastWindow = winKey;
  state.calendarLoading = true;
  state.calendarError = null;
  render();
  try {
    const events = await calendar.listEvents(start.getTime(), endExclusive.getTime());
    if (state.calendarLastWindow !== winKey) return; // stale
    state.calendarEvents = events.map(normalizeMeeting);
    // Keep previously-selected meetings if still in window
    const validIds = new Set(state.calendarEvents.map((m) => m.googleEventId));
    state.formState.meetings = state.formState.meetings.filter((m) => validIds.has(m.googleEventId));
  } catch (err) {
    state.calendarError = err.message;
    state.calendarEvents = [];
    showToast(t('Calendar: {msg}', { msg: err.message }), 'error', 6000);
  } finally {
    state.calendarLoading = false;
    render();
  }
}

async function connectCalendarAction() {
  try {
    await calendar.connect();
    showToast(t('Calendar connected.'), 'success');
    audio.coin();
    refreshCalendarEvents();
  } catch (err) {
    showToast(t('Could not connect calendar: {msg}', { msg: err.message }), 'error', 6000);
  }
}

async function addCoverageMarker(bountyId, requesterName, windowStartMs, windowEndMs) {
  const key = `vacaciones.addedMarker.${bountyId}`;
  if (localStorage.getItem(key) === '1') return false;
  let token = calendar.getToken();
  if (!token) token = await calendar.connect();
  // All-day event spanning the window. Google Calendar end.date is exclusive.
  const startDate = new Date(windowStartMs).toISOString().slice(0, 10);
  const endDateInclusive = new Date(windowEndMs).toISOString().slice(0, 10);
  const endDate = new Date(new Date(endDateInclusive).getTime() + 86400000).toISOString().slice(0, 10);
  const body = {
    summary: `🏴‍☠️ Covering for ${requesterName}`,
    description: `You're covering ${requesterName}'s shore leave through Time Off.\n\nBounty: ${location.origin}/#/team/${encodeURIComponent(state.teamId || '')}`,
    start: { date: startDate },
    end: { date: endDate },
    transparency: 'transparent',
  };
  let res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    calendar.clearToken();
    token = await calendar.connect();
    res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) throw new Error(`Marker add failed (${res.status})`);
  localStorage.setItem(key, '1');
  return true;
}

async function addAllBountyMeetings(bountyId) {
  const b = state.bounties.find((x) => x.id === bountyId);
  if (!b) return;
  if (!calendar.isConnected()) {
    try { await calendar.connect(); }
    catch (err) { showToast(t('Calendar connect failed: {msg}', { msg: err.message }), 'error'); return; }
  }
  const meetingsAlready = getAddedMeetingIds(bountyId);
  const meetingsToAdd = arr(b.meetings).filter((m) => !meetingsAlready.has(m.googleEventId));
  const markerKey = `vacaciones.addedMarker.${bountyId}`;
  const markerAlready = localStorage.getItem(markerKey) === '1';
  if (meetingsToAdd.length === 0 && markerAlready) {
    showToast(t('Everything already on your calendar.'), 'info');
    return;
  }
  let addedMeetings = 0;
  for (const m of meetingsToAdd) {
    try {
      await calendar.addEvent(m);
      markMeetingAdded(bountyId, m.googleEventId);
      addedMeetings++;
    } catch (err) {
      console.error('add event failed', m, err);
    }
  }
  let addedMarker = false;
  if (!markerAlready) {
    try {
      const requesterName = b.requesterDisplayName || 'a crewmate';
      const startMs = b.windowStart?.toMillis?.() ?? Date.now();
      const endMs = b.windowEnd?.toMillis?.() ?? startMs;
      addedMarker = await addCoverageMarker(bountyId, requesterName, startMs, endMs);
    } catch (err) {
      console.error('marker add failed', err);
    }
  }
  if (addedMeetings > 0 || addedMarker) {
    const bits = [];
    if (addedMarker) bits.push('coverage marker');
    if (addedMeetings > 0) bits.push(`${addedMeetings} meeting${addedMeetings === 1 ? '' : 's'}`);
    showToast(t('Added {what} to your calendar.', { what: bits.join(' + ') }), 'success');
    audio.coin();
  } else {
    showToast(t('Nothing new to add.'), 'info');
  }
}

async function copyInviteLink(teamId) {
  // Managers mint a fresh rotating token (14 days, 25 uses; revokes prior
  // links). The crew doc-id is no longer a join credential.
  if (state.myRole !== 'manager') {
    showToast(t('Ask a crew manager to share an invite link.'), 'info', 5000);
    return;
  }
  showToast(t('Creating invite link…'), 'info', 2000);
  try {
    const result = await callCreateInviteToken({ teamId });
    const link = `${location.origin}/#/join/${encodeURIComponent(result.data.token)}`;
    const expires = new Date(result.data.expiresAtMs);
    const expiresLabel = expires.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    try {
      await navigator.clipboard.writeText(link);
      showToast(t('Invite link copied — valid until {date} or {n} joins. Sharing a new one revokes this link.', { date: expiresLabel, n: result.data.maxUses }), 'success', 7000);
    } catch { showToast(`${t('Invite link')}: ${link}`, 'info', 10000); }
  } catch (err) { showToast(err.message, 'error', 6000); }
}

async function sendScrollAction(teamId, toUid, message, bountyId) {
  try {
    await callSendScroll({ teamId, toUid, message, bountyId: bountyId ?? null });
    showToast(t('Thank-you scroll sent.'), 'success');
    audio.rank();
  } catch (err) {
    showToast(t('Could not send the scroll: {msg}', { msg: err.message }), 'error', 5000);
  }
}

function showSkinPicker() {
  const current = skin.current();
  const body = `
    <p style="margin: 0 0 12px;">${esc(t('Pick a look. Persists across visits on this browser.'))}</p>
    <div class="skin-picker-grid">
      ${SKIN_OPTIONS.map((s) => `
        <button class="skin-card ${s.id === current ? 'selected' : ''}" data-action="pick-skin" data-id="${esc(s.id)}">
          <div class="skin-preview skin-preview-${s.id}">${s.id === 'basic' ? 'Time Off' : (s.id === 'dark-knight' ? '> Time Off_' : 'TIME OFF')}</div>
          <div class="skin-card-meta">
            <strong>${esc(t(s.label))}</strong>
            <small>${esc(t(s.desc))}</small>
          </div>
        </button>
      `).join('')}
    </div>
  `;
  showModal({
    title: t('Choose a skin'),
    body,
    wide: true,
    primaryLabel: t('Close'),
  });
}

function showAvatarPicker() {
  const u = state.user || {};
  const current = state.userDoc?.avatarId ?? null;
  const digestEnabled = state.userDoc?.digestEnabled !== false; // default true
  const team = state.teamId ? state.myTeams.find((t) => t.id === state.teamId) : null;
  const wallet = state.walletDoc;
  const totalBalance = wallet ? (wallet.earnedBalance ?? 0) + (wallet.stipendBalance ?? 0) : null;
  const stats = state.teamId ? computeStats() : null;
  const rank = stats ? computeRank(stats) : null;
  const grid = AVATAR_LIST.map((id) => {
    const isMale = id.startsWith('m');
    const isSelected = id === current;
    return `<button class="avatar-tile ${isSelected ? 'selected' : ''}" data-action="pick-avatar" data-id="${id}" title="${esc(isMale ? t('Male pirate') : t('Female pirate'))}">
      <span class="avatar-tile-art">${SVG.avatars[id]}</span>
      <span class="avatar-tile-label">${isMale ? 'M' : 'F'}${id.slice(1)}</span>
    </button>`;
  }).join('');
  const body = `
    <div class="profile-head">
      ${renderAvatar({ uid: u.uid, photoURL: u.photoURL, name: u.displayName, size: 48, klass: 'avatar-img' })}
      <div class="profile-id">
        <strong>${esc(u.displayName ?? '')}</strong>
        <small class="muted">${esc(u.email ?? '')}</small>
        ${rank && team ? `<small class="profile-rank">${spriteIcon(rank.sprite)} ${esc(t(rank.name))} · ${esc(t('{n} doubloons earned lifetime', { n: stats.lifetimeEarned }))}</small>` : ''}
      </div>
      ${team && totalBalance !== null ? `
        <span class="coin-pill" title="${esc(t('Total doubloons in this crew'))}">
          ${SVG.doubloon}<span>${totalBalance}</span>
        </span>` : ''}
    </div>

    <div class="profile-section">
      <p style="margin: 0 0 12px;">${esc(t('Pick a pirate to wear as your face. You can change it any time.'))}</p>
      <div class="avatar-grid">${grid}</div>
      ${current ? `<p style="margin: 12px 0 0; text-align: right;"><button class="btn-ghost" data-action="clear-avatar">${esc(t('Use Google photo'))}</button></p>` : ''}
    </div>

    <div class="profile-section">
      <div class="profile-row">
        <span>
          <strong style="display: block;">${esc(t('Language'))}</strong>
          <small class="muted">${esc(t('Applies immediately, everywhere in the app.'))}</small>
        </span>
        <select data-action="set-lang" aria-label="${esc(t('Language'))}" style="width: auto; min-width: 160px;">
          ${LANG_OPTIONS.map((o) => `<option value="${o.id}" ${lang.stored() === o.id ? 'selected' : ''}>${esc(o.id === 'auto' ? t('Auto (browser)') : o.label)}</option>`).join('')}
        </select>
      </div>
      <div class="profile-row">
        <span>
          <strong style="display: block;">${esc(t('Theme'))}</strong>
          <small class="muted">${esc(t('Pirate, Basic, High Contrast, or Dark Knight.'))}</small>
        </span>
        <button class="btn btn-secondary" data-action="open-skin-picker" type="button">🎨 ${esc(t('Choose a skin'))}</button>
      </div>
      <label class="profile-row" style="cursor: pointer;">
        <span>
          <strong style="display: block;">${esc(t('Sound effects'))}</strong>
          <small class="muted">${esc(t('Clicks, coins, and toast chimes.'))}</small>
        </span>
        <input type="checkbox" data-action="sound" ${audio.enabled ? 'checked' : ''} style="width: 18px; height: 18px; margin: 0;" />
      </label>
      <label class="profile-row" style="cursor: pointer;">
        <span>
          <strong style="display: block;">${esc(t('Daily email digest'))}</strong>
          <small class="muted">${esc(t('A morning summary of open bounties, doubloons earned, and new scrolls. Transactional emails (acceptance, cancellations) stay on.'))}</small>
        </span>
        <input type="checkbox" data-action="toggle-digest" ${digestEnabled ? 'checked' : ''} style="width: 18px; height: 18px; margin: 0;" />
      </label>
    </div>

    <div class="profile-section">
      <div class="profile-row">
        <span>
          <strong style="display: block;">${esc(t('Your data'))}</strong>
          <small class="muted">${esc(t('Download everything Time Off stores about you, as JSON.'))}</small>
        </span>
        <button class="btn btn-secondary" data-action="export-data" type="button">${esc(t('Export my data'))}</button>
      </div>
      <div class="profile-row">
        <span>
          <strong style="display: block;">${esc(t('Delete account'))}</strong>
          <small class="muted">${esc(t('Leaves all crews and erases your profile. Crew financial records keep an anonymous ID.'))}</small>
        </span>
        <button class="btn btn-danger" data-action="delete-account" type="button">${esc(t('Delete…'))}</button>
      </div>
    </div>

    <div class="profile-section profile-signout">
      <button class="btn btn-secondary" data-action="sign-out" type="button">${esc(t('Sign out'))}</button>
    </div>
  `;
  showModal({
    title: t('Profile'),
    body,
    wide: true,
    primaryLabel: t('Done'),
  });
}

async function exportMyDataAction() {
  showToast(t('Preparing your export…'), 'info', 3000);
  try {
    const result = await callExportMyData({});
    const blob = new Blob([JSON.stringify(result.data.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeoff-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    showToast(t('Export downloaded.'), 'success');
  } catch (err) { showToast(err.message, 'error', 6000); }
}

function showDeleteAccountModal() {
  const inputId = 'del-confirm-' + Math.random().toString(36).slice(2, 8);
  showModal({
    title: t('Delete your account?'),
    body: `
      <p>${esc(t('This permanently removes you from every crew, erases your profile, and deletes your sign-in. It cannot be undone.'))}</p>
      <p class="muted" style="font-size: var(--fs-meta);">${esc(t('Blocked while you have open or active bounties, or while you are the last manager of a crew with other members.'))}</p>
      <label style="display:block; margin-top: 12px;">
        <span style="display:block; margin-bottom: 4px;">${t('Type <code>DELETE</code> to confirm')}</span>
        <input id="${inputId}" type="text" autocomplete="off" placeholder="DELETE" />
      </label>`,
    primaryLabel: t('Delete my account'),
    secondaryLabel: t('Cancel'),
    onPrimary: () => {
      const val = document.getElementById(inputId)?.value.trim();
      if (val !== 'DELETE') {
        showToast(t('Type DELETE (in capitals) to confirm.'), 'error');
        return false;
      }
      (async () => {
        try {
          await callDeleteMyAccount({ confirm: 'DELETE' });
          showToast(t('Account deleted. Fair winds.'), 'success', 4000);
          closeAllModals();
          await signOut(auth);
        } catch (err) { showToast(err.message, 'error', 8000); }
      })();
    },
  });
}

function showDisbandCrewModal(team) {
  const inputId = 'disband-' + Math.random().toString(36).slice(2, 8);
  showModal({
    title: t('Disband this crew?'),
    body: `
      <p>${t('This permanently deletes <strong>{name}</strong> — every bounty record, wallet, ledger entry, scroll, and the audit log. It cannot be undone.', { name: esc(team.name) })}</p>
      <p class="muted" style="font-size: var(--fs-meta);">${esc(t('Blocked while open or active bounties exist. Consider exporting data first (Profile → Export my data).'))}</p>
      <label style="display:block; margin-top: 12px;">
        <span style="display:block; margin-bottom: 4px;">${esc(t('Type the crew name to confirm'))}</span>
        <input id="${inputId}" type="text" autocomplete="off" placeholder="${esc(team.name)}" />
      </label>`,
    primaryLabel: t('Disband crew'),
    secondaryLabel: t('Cancel'),
    onPrimary: () => {
      const val = document.getElementById(inputId)?.value ?? '';
      if (val.trim() !== team.name.trim()) {
        showToast(t('Crew name does not match.'), 'error');
        return false;
      }
      (async () => {
        try {
          await callDisbandCrew({ teamId: team.id, confirmName: val });
          showToast(t('Crew disbanded.'), 'success', 4000);
          closeAllModals();
          location.hash = '#/';
        } catch (err) { showToast(err.message, 'error', 8000); }
      })();
    },
  });
}

function showManageCrewModal(team) {
  const inputName = 'crew-name-' + Math.random().toString(36).slice(2, 8);
  const inputPhoto = 'crew-photo-' + Math.random().toString(36).slice(2, 8);
  const body = `
    <div class="form-grid">
      <label class="wide">
        <span>${esc(t('Crew name'))}</span>
        <input id="${inputName}" type="text" value="${esc(team.name)}" maxlength="100" />
      </label>
      <label class="wide">
        <span>${esc(t('Crew photo URL (optional)'))}</span>
        <input id="${inputPhoto}" type="text" value="${esc(team.photoURL ?? '')}" placeholder="https://…" />
      </label>
    </div>
    <p class="muted" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 16px; margin: 8px 0 0;">${esc(t('Paste a square image URL. Leave blank to use the default flag.'))}</p>
  `;
  showModal({
    title: t('Manage crew'),
    body,
    wide: true,
    primaryLabel: t('Save'),
    secondaryLabel: t('Cancel'),
    onPrimary: () => {
      const n = document.getElementById(inputName)?.value.trim() ?? '';
      const p = document.getElementById(inputPhoto)?.value.trim() ?? '';
      if (!n) {
        showToast(t('Crew name cannot be empty.'), 'error');
        return false;
      }
      const updates = { name: n };
      if (p !== (team.photoURL ?? '')) updates.photoURL = p || null;
      updateTeamAction(team.id, updates.name, updates.photoURL);
    },
  });
}

function confirmCancelBounty(bountyId) {
  const b = state.bounties.find((x) => x.id === bountyId);
  if (!b) return;
  const remaining = Math.max(0, (b.coinsEscrowed ?? 0) - (b.coinsReleased ?? 0));
  const message = remaining > 0
    ? t('Cancel this bounty? <strong>{n} doubloons</strong> will be refunded to the requester.', { n: remaining })
    : t('Cancel this bounty? Nothing to refund.');
  showModal({
    title: t('Cancel bounty?'),
    body: `<p>${message}</p>`,
    primaryLabel: t('Cancel bounty'),
    secondaryLabel: t('Keep it'),
    onPrimary: () => cancelBountyAction(bountyId),
  });
}

async function exportLedgerCsv() {
  if (!state.teamId || !state.user?.uid) {
    showToast(t('No crew loaded.'), 'info');
    return;
  }
  showToast(t('Preparing CSV…'), 'info', 2000);
  // Page through the full ledger so we don't silently cap at the live
  // listener's 40-row window. Hard cap of 10k rows to stay friendly.
  const entries = [];
  let cursor = null;
  const PAGE = 500;
  const MAX = 10000;
  try {
    while (entries.length < MAX) {
      const baseQ = [
        collection(db, `teams/${state.teamId}/ledgerEntries`),
        where('uid', '==', state.user.uid),
        orderBy('createdAt', 'desc'),
        limit(PAGE),
      ];
      const q = cursor ? query(...baseQ, startAfter(cursor)) : query(...baseQ);
      const snap = await getDocs(q);
      if (snap.empty) break;
      for (const d of snap.docs) entries.push({ id: d.id, ...d.data() });
      if (snap.docs.length < PAGE) break;
      cursor = snap.docs[snap.docs.length - 1];
    }
  } catch (err) {
    console.error('CSV export query failed', err);
    showToast(t('Could not load full ledger.'), 'error');
    return;
  }
  if (entries.length === 0) {
    showToast(t('Nothing to export.'), 'info');
    return;
  }
  const rows = [['Date','Type','Amount','Bucket','Related bounty']];
  for (const e of entries) {
    rows.push([
      e.createdAt?.toDate?.()?.toISOString() || '',
      e.type || '',
      String(e.amountSigned ?? 0),
      e.balanceBucket || '',
      e.relatedRequestId || '',
    ]);
  }
  const csv = rows.map((r) => r.map((cell) => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  // Prepend UTF-8 BOM so Excel reads non-ASCII characters correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vacaciones-ledger-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showToast(t('Exported {n} entries.', { n: entries.length }), 'success');
}

function showEditBountyModal(bountyId) {
  const b = state.bounties.find((x) => x.id === bountyId);
  if (!b) return;
  const slaId = 'edit-sla-' + Math.random().toString(36).slice(2, 8);
  const scopeId = 'edit-scope-' + Math.random().toString(36).slice(2, 8);
  const emergId = 'edit-emerg-' + Math.random().toString(36).slice(2, 8);
  const reachChecks = REACHABILITY_OPTIONS.map((r) => {
    const checked = arr(b.reachability).includes(r.value);
    return `<label class="check-pixel">
      <input type="checkbox" name="r-${r.value}" value="${r.value}" ${checked ? 'checked' : ''}/>
      <span class="check-box"></span>
      <span class="check-label">${spriteIcon(r.sprite)} ${esc(t(r.short))}</span>
    </label>`;
  }).join('');
  const kindChecks = COVERAGE_KIND_OPTIONS.map((k) => {
    const checked = arr(b.coverageKinds).includes(k.value);
    return `<label class="check-pixel">
      <input type="checkbox" name="k-${k.value}" value="${k.value}" ${checked ? 'checked' : ''}/>
      <span class="check-box"></span>
      <span class="check-label">${spriteIcon(k.sprite)} ${esc(t(k.label))}</span>
    </label>`;
  }).join('');
  const body = `
    <div class="form-grid">
      <label class="wide"><span>SLA</span><input id="${slaId}" type="text" value="${esc(b.sla || '')}" /></label>
      <label class="wide"><span>${esc(t('Coverage scope'))}</span><input id="${scopeId}" type="text" value="${esc(b.coverageScope || '')}" /></label>
      <label class="wide"><span>${esc(t('Emergency definition'))}</span><textarea id="${emergId}" rows="2">${esc(b.emergencyDef || '')}</textarea></label>
      <div class="wide">
        <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;">${esc(t('Reachability'))}</span>
        <div class="check-group">${reachChecks}</div>
      </div>
      <div class="wide">
        <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;">${esc(t('Coverage kinds'))}</span>
        <div class="check-group">${kindChecks}</div>
      </div>
    </div>
    <p class="muted" style="font-size: var(--fs-meta); margin: 8px 0 0;">${esc(t('Dates + selected days are locked to keep the escrow contract intact.'))}</p>
  `;
  showModal({
    title: t('Edit bounty'),
    body,
    wide: true,
    primaryLabel: t('Save'),
    secondaryLabel: t('Cancel'),
    onPrimary: () => {
      const sla = document.getElementById(slaId)?.value?.trim() ?? '';
      const scope = document.getElementById(scopeId)?.value?.trim() ?? '';
      const emerg = document.getElementById(emergId)?.value?.trim() ?? '';
      const reachability = REACHABILITY_OPTIONS
        .filter((r) => document.querySelector(`input[name="r-${r.value}"]`)?.checked)
        .map((r) => r.value);
      const coverageKinds = COVERAGE_KIND_OPTIONS
        .filter((k) => document.querySelector(`input[name="k-${k.value}"]`)?.checked)
        .map((k) => k.value);
      if (reachability.length === 0) {
        showToast(t('Pick at least one reachability option.'), 'error');
        return false;
      }
      (async () => {
        try {
          await callUpdateBountyDetails({
            teamId: state.teamId,
            requestId: bountyId,
            sla, coverageScope: scope || null,
            emergencyDef: emerg || null,
            reachability,
            coverageKinds,
          });
          showToast(t('Bounty updated.'), 'success');
        } catch (err) { showToast(err.message, 'error', 6000); }
      })();
    },
  });
}

function showSendBonus(targetUid, displayName) {
  showGrantBonusModal(targetUid, displayName);
}

function showSendScrollModal(toUid, toName, bountyId) {
  if (!toUid || toUid === state.user?.uid) {
    showToast(t('You cannot send a scroll to yourself.'), 'error');
    return;
  }
  const inputId = 'scroll-msg-' + Math.random().toString(36).slice(2, 8);
  const body = `
    <div class="scroll-compose">
      <div class="scroll-target">
        <span>${esc(t('To:'))}</span><strong>${esc(toName || t('A crewmate'))}</strong>
      </div>
      <textarea id="${inputId}" maxlength="240" placeholder="${esc(t('A short note of thanks…'))}"></textarea>
      <div class="scroll-char-count" id="${inputId}-count">${esc(t('{n} left', { n: 240 }))}</div>
    </div>
  `;
  showModal({
    title: t('Send a thank-you scroll'),
    body,
    primaryLabel: t('Send scroll'),
    secondaryLabel: t('Cancel'),
    onPrimary: () => {
      const el = document.getElementById(inputId);
      const message = el?.value?.trim() ?? '';
      if (!message) {
        showToast(t('Write something — even a few words.'), 'error');
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
    el.addEventListener('input', () => { count.textContent = t('{n} left', { n: 240 - el.value.length }); });
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
    showToast(t('Could not load the Wall of Fame: {msg}', { msg: err.message }), 'error', 5000);
  } finally { state.leaderboardLoading = false; render(); }
}

async function refreshCrewSettings() {
  if (!state.teamId || state.crewSettingsLoading) return;
  if (state.myRole !== 'manager') return;
  state.crewSettingsLoading = true; render();
  try {
    const result = await callGetCrewSettings({ teamId: state.teamId });
    state.crewSettings = result.data;
  } catch (err) {
    console.error('crew settings fetch failed', err);
    showToast(t('Could not load settings: {msg}', { msg: err.message }), 'error', 5000);
  } finally { state.crewSettingsLoading = false; render(); }
}

async function refreshAuditLog() {
  if (!state.teamId || state.auditLogLoading || state.myRole !== 'manager') return;
  state.auditLogLoading = true; render();
  try {
    const result = await callGetAuditLog({ teamId: state.teamId, limit: 50 });
    state.auditLog = result.data.entries;
  } catch (err) {
    console.error('audit log fetch failed', err);
    showToast(t('Could not load audit log: {msg}', { msg: err.message }), 'error', 5000);
  } finally { state.auditLogLoading = false; render(); }
}

async function changeMemberRole(targetUid, role, displayName) {
  try {
    await callUpdateMemberRole({ teamId: state.teamId, targetUid, role });
    showToast(role === 'manager' ? t('{name} is now a manager.', { name: displayName }) : t('{name} is now a member.', { name: displayName }), 'success');
    audio.coin();
    refreshCrewMembers();
  } catch (err) { showToast(err.message, 'error', 6000); }
}

async function removeMemberAction(targetUid, displayName) {
  try {
    await callRemoveMember({ teamId: state.teamId, targetUid });
    showToast(t('{name} was removed from the crew.', { name: displayName }), 'success');
    refreshCrewMembers();
  } catch (err) { showToast(err.message, 'error', 6000); }
}

async function grantBonusAction(targetUid, amount, reason, displayName) {
  try {
    const result = await callGrantBonusDoubloons({ teamId: state.teamId, targetUid, amount, reason });
    showToast(t('Sent {n} doubloons to {name}.', { n: result.data.amount, name: displayName }), 'success');
    audio.coin();
    refreshCrewMembers();
  } catch (err) { showToast(err.message, 'error', 6000); }
}

async function forceCompleteAction(requestId) {
  try {
    const result = await callForceCompleteBounty({ teamId: state.teamId, requestId });
    const released = result?.data?.coinsReleased ?? 0;
    const days = result?.data?.daysReleased ?? 0;
    const msg = released > 0
      ? `Bounty force-completed. Released ${released} doubloons over ${days} day${days === 1 ? '' : 's'}.`
      : 'Bounty force-completed.';
    showToast(msg, 'success', 5000);
    audio.rank();
  } catch (err) { showToast(err.message, 'error', 6000); }
}

function showGrantBonusModal(targetUid, displayName) {
  const amountId = 'bonus-amt-' + Math.random().toString(36).slice(2, 8);
  const reasonId = 'bonus-rsn-' + Math.random().toString(36).slice(2, 8);
  showModal({
    title: t('Grant bonus to {name}', { name: displayName || t('a crewmate') }),
    body: `
      <div class="form-grid">
        <label class="wide">
          <span style="font-family: var(--font-body); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">${esc(t('Amount (1–500)'))}</span>
          <input id="${amountId}" type="number" min="1" max="500" value="20" />
        </label>
        <label class="wide">
          <span style="font-family: var(--font-body); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">${esc(t('Reason (visible in audit log)'))}</span>
          <textarea id="${reasonId}" rows="2" placeholder="${esc(t('e.g. Covered the Acme P1 escalation over the weekend.'))}"></textarea>
        </label>
      </div>
    `,
    wide: true,
    primaryLabel: t('Send doubloons'),
    secondaryLabel: t('Cancel'),
    onPrimary: () => {
      const amount = Number(document.getElementById(amountId)?.value || 0);
      const reason = (document.getElementById(reasonId)?.value || '').trim();
      if (!amount || amount < 1 || amount > 500) {
        showToast(t('Pick an amount between 1 and 500.'), 'error'); return false;
      }
      if (reason.length < 3) {
        showToast(t('Add a short reason (audit trail).'), 'error'); return false;
      }
      grantBonusAction(targetUid, amount, reason, displayName);
    },
  });
}

function showMemberAdminModal(member) {
  const isOwner = state.myTeams.find((t) => t.id === state.teamId)?.ownerUid === member.uid;
  const isMe = member.uid === state.user?.uid;
  const targetRole = member.role;
  showModal({
    title: t('Manage {name}', { name: member.displayName || t('a crewmate') }),
    body: `
      <p style="margin: 0 0 12px;">${t('Pick an admin action for <strong>{name}</strong>.', { name: esc(member.displayName || t('this crewmate')) })}</p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${isMe ? `<p class="muted" style="font-size: var(--fs-meta);">${esc(t("Some actions disabled — that's you."))}</p>` : ''}
        <button class="btn btn-secondary" data-action="adm-bonus" data-uid="${esc(member.uid)}" data-name="${esc(member.displayName || '')}">💰 ${esc(t('Grant bonus doubloons'))}</button>
        ${targetRole === 'member'
          ? `<button class="btn btn-secondary" data-action="adm-promote" data-uid="${esc(member.uid)}" data-name="${esc(member.displayName || '')}">⬆ ${esc(t('Promote to manager'))}</button>`
          : `<button class="btn btn-secondary" data-action="adm-demote" data-uid="${esc(member.uid)}" data-name="${esc(member.displayName || '')}" ${isOwner ? `disabled title="${esc(t('Owner cannot be demoted'))}"` : ''}>⬇ ${esc(t('Demote to member'))}</button>`
        }
        <button class="btn btn-danger" data-action="adm-remove" data-uid="${esc(member.uid)}" data-name="${esc(member.displayName || '')}" ${(isOwner || isMe) ? `disabled title="${esc(t('Cannot remove owner / yourself'))}"` : ''}>🗑 ${esc(t('Remove from crew'))}</button>
      </div>
    `,
    primaryLabel: t('Close'),
  });
}

async function refreshCrewMembers() {
  if (!state.teamId || state.crewMembersLoading) return;
  state.crewMembersLoading = true; render();
  try {
    const result = await callGetCrewMembers({ teamId: state.teamId });
    state.crewMembers = result.data.members;
  } catch (err) {
    console.error('crew members fetch failed', err);
    showToast(t('Could not load the crew: {msg}', { msg: err.message }), 'error', 5000);
  } finally { state.crewMembersLoading = false; render(); }
}

async function topUpGrantAction() {
  showModal({
    title: t('Top up starter chest?'),
    body: `<p>${t('This will credit each crewmate who received the old 20-doubloon grant with the missing <strong>105 doubloons</strong> so everyone hits the new 125 starting balance. It runs once per crewmate (idempotent).')}</p>`,
    primaryLabel: t('Top up the grant'),
    secondaryLabel: t('Cancel'),
    onPrimary: async () => {
      try {
        const result = await callTopUpGrant({ teamId: state.teamId });
        if (result.data.toppedUpCount === 0) {
          showToast(t('Everyone is already at the new grant.'), 'info');
        } else {
          showToast(t('Topped up {n} crewmates (+{coins} each).', { n: result.data.toppedUpCount, coins: result.data.perUser }), 'success');
          audio.coin();
        }
      } catch (err) {
        showToast(err.message, 'error', 6000);
      }
    },
  });
}

async function generateBriefingAction(bountyId) {
  if (state.briefingLoading) return;
  state.briefingLoading = true; render();
  try {
    const result = await callGenerateBriefing({ teamId: state.teamId, requestId: bountyId });
    showToast(t('Briefing generated.'), 'success', 4000);
    audio.rank();
    // Reload bounty detail modal
    showBountyDetail(bountyId);
  } catch (err) {
    showToast(t('Briefing failed: {msg}', { msg: err.message }), 'error', 7000);
  } finally { state.briefingLoading = false; render(); }
}

async function reactToScrollAction(scrollId, emoji) {
  try {
    await callReactToScroll({ teamId: state.teamId, scrollId, emoji });
    audio.click();
  } catch (err) {
    showToast(err.message, 'error', 5000);
  }
}

async function saveCrewSettings(updates) {
  try {
    await callUpdateCrewSettings({ teamId: state.teamId, ...updates });
    showToast(t('Crew settings saved.'), 'success');
    await refreshCrewSettings();
  } catch (err) {
    showToast(err.message, 'error', 6000);
  }
}

/* ============================================================
   Coin shower + toasts + modal
   ============================================================ */

/* ============================================================
   Rank-up cinematic — full-screen Atari-era celebration.
   Fires once per rank threshold per crew (docs/14 #21, docs/16
   conflict 4: motion = meaning; this moment earns its frames).
   Diegetic retro animation, so everything runs on steps().
   ============================================================ */

function rankCineKey() { return `vacaciones.rankMin.${state.teamId || 'none'}`; }

function maybeShowRankCinematic(stats) {
  if (!state.teamId || !stats) return;
  const rank = computeRank(stats);
  const stored = localStorage.getItem(rankCineKey());
  if (stored === null) {
    // First sighting of this crew on this browser — sync silently so we
    // never replay history.
    localStorage.setItem(rankCineKey(), String(rank.min));
    return;
  }
  if (rank.min > Number(stored)) {
    localStorage.setItem(rankCineKey(), String(rank.min));
    showRankCinematic(rank);
  } else if (rank.min < Number(stored)) {
    localStorage.setItem(rankCineKey(), String(rank.min));
  }
}

function showRankCinematic(rank, opts = {}) {
  // Honor the OS motion preference: celebrate via toast instead.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    showToast(t('Promoted to {rank}!', { rank: t(rank.name) }), 'success', 6000);
    audio.rank();
    return;
  }
  // Never stack two cinematics.
  if (document.querySelector('.cine')) return;

  const isCommodore = rank.min >= 800;
  const name = firstName(state.user?.displayName) || '';
  const wrap = document.createElement('div');
  wrap.className = `cine ${isCommodore ? 'cine-gold' : ''}`;
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', t('Promotion ceremony'));
  const stars = Array.from({ length: 14 }, (_, i) =>
    `<span class="cine-star" style="left:${(i * 37 + 11) % 96}%; top:${(i * 23 + 7) % 44}%; animation-delay:${(i % 5) * 280}ms"></span>`,
  ).join('');
  const rays = Array.from({ length: 8 }, (_, i) =>
    `<span class="cine-ray" style="transform: rotate(${i * 45}deg)"></span>`,
  ).join('');
  wrap.innerHTML = `
    <div class="cine-stars">${stars}</div>
    <div class="cine-sun"></div>
    <div class="cine-sea"><div class="cine-wave"></div></div>
    <div class="cine-ship">${SVG.flag ?? ''}</div>
    <div class="cine-center">
      <div class="cine-burst">${rays}</div>
      <div class="cine-emblem">${SVG.icons[rank.sprite] ?? ''}</div>
      <div class="cine-title">${esc(t(isCommodore ? 'FLEET PROMOTION' : 'PROMOTED'))}</div>
      <div class="cine-rank">${esc(t(rank.name).toUpperCase())}${name ? ` · ${esc(name.toUpperCase())}` : ''}</div>
      ${isCommodore ? `<div class="cine-flavor">${esc(t('Highest honor on the seven seas.'))}</div>` : ''}
    </div>
    <div class="cine-skip">${esc(t('Click anywhere to continue'))}</div>
    <div class="cine-scanlines" aria-hidden="true"></div>
  `;
  const ttl = isCommodore ? 6800 : 5200;
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    wrap.classList.add('cine-out');
    setTimeout(() => wrap.remove(), 320);
  };
  const onKey = (e) => { e.preventDefault(); e.stopPropagation(); dismiss(); };
  wrap.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(wrap);
  timer = setTimeout(dismiss, ttl);
  if (!opts.silent) { audio.init(); audio.fanfare(); }
}

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
  // Make sure the live region announces this toast to screen readers.
  if (toastEl && !toastEl.hasAttribute('role')) {
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    toastEl.setAttribute('aria-atomic', 'true');
  }
  const icon = kind === 'success' ? '✓' : kind === 'error' ? '!' : '⚓';
  const srPrefix = kind === 'success' ? 'Success: ' : kind === 'error' ? 'Error: ' : '';
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span><span class="sr-only">${esc(srPrefix)}</span><span>${esc(message)}</span>`;
  toastEl.appendChild(el);
  audio.toast();
  let timer;
  const dismiss = () => { clearTimeout(timer); el.style.opacity = '0'; el.style.transition = 'opacity 0.2s'; setTimeout(() => el.remove(), 220); };
  el.addEventListener('click', dismiss);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });
  timer = setTimeout(dismiss, ttl);
}

// Modal stack — supports nested modals (e.g. confirm inside an admin modal).
const __modalStack = [];

function showModal({ title, body, primaryLabel = 'OK', secondaryLabel, onPrimary, onSecondary, wide }) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  const titleId = 'modal-title-' + Math.random().toString(36).slice(2, 9);
  wrap.className = 'modal-scrim';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="modal-title" id="${titleId}">${esc(title)}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        ${secondaryLabel ? `<button class="btn btn-secondary" data-modal="secondary" type="button">${esc(secondaryLabel)}</button>` : ''}
        <button class="btn" data-modal="primary" type="button">${esc(primaryLabel)}</button>
      </div>
    </div>`;

  // Capture the element that opened the modal so we can restore focus on close.
  const opener = document.activeElement;
  let removed = false;
  const close = () => {
    if (removed) return;
    removed = true;
    document.removeEventListener('keydown', onKeydown, true);
    wrap.remove();
    const idx = __modalStack.indexOf(wrap);
    if (idx >= 0) __modalStack.splice(idx, 1);
    // Return focus to the opener if it's still in the DOM and visible.
    if (opener && document.body.contains(opener) && typeof opener.focus === 'function') {
      try { opener.focus(); } catch (_) {}
    }
  };

  // Focus trap — tab cycles inside the modal only.
  function focusables() {
    return Array.from(wrap.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.offsetParent !== null);
  }
  function onKeydown(e) {
    // Only the topmost modal handles keys.
    if (__modalStack[__modalStack.length - 1] !== wrap) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      const result = onSecondary ? onSecondary() : undefined;
      if (result !== false) close();
      return;
    }
    if (e.key === 'Tab') {
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  document.addEventListener('keydown', onKeydown, true);

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) {
      const result = onSecondary ? onSecondary() : undefined;
      if (result !== false) close();
      return;
    }
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
  __modalStack.push(wrap);
  wrap.__close = close;

  // Focus the primary action by default (or first focusable if no primary).
  requestAnimationFrame(() => {
    const primary = wrap.querySelector('[data-modal="primary"]');
    const fallback = focusables()[0];
    (primary || fallback)?.focus();
  });

  return { close };
}

// Close every open modal, top-of-stack first (used on sign-out so no
// stale sheet survives the auth flip).
function closeAllModals() {
  [...__modalStack].reverse().forEach((w) => w.__close?.());
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
      <div class="stan-speech"><p>${esc(t(scene.speech))}</p></div>
    </div>
    <div class="stan-progress">
      ${STAN_SCENES.map((_, i) => `<span class="stan-dot ${i === idx ? 'active' : ''}"></span>`).join('')}
    </div>
  `;
  showModal({
    title: t('Stan, Harbormaster'),
    body,
    primaryLabel: isLast ? t('Set sail') : t('Next'),
    secondaryLabel: idx === 0 ? t('Skip') : t('Back'),
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
      <span class="status-badge status-${status}">${esc(t(STATUS_LABEL[status] || status))}</span>
      <span style="font-family: 'Silkscreen', monospace; font-size: 22px; color: var(--brass-deep); display: inline-flex; align-items: center; gap: 4px;">
        ${SVG.doubloon}${b.totalCoinsOffered ?? 0}
        <span style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-faded); margin-left: 4px;">${esc(t('doubloons'))}</span>
      </span>
    </div>

    <div class="bd-section">
      <h4>${esc(t('Requester'))}</h4>
      <div style="display: flex; align-items: center; gap: 8px;">
        ${b.requesterPhotoURL ? `<img class="avatar-mini" src="${esc(b.requesterPhotoURL)}" alt="" referrerpolicy="no-referrer" style="width: 32px; height: 32px;" />` : ''}
        <span class="bd-value">${esc(b.requesterDisplayName || t('A crewmate'))}${mine ? ` (${t('you')})` : ''}</span>
      </div>
    </div>

    ${(() => {
      const crewMode = (b.coverageMode || 'single') === 'crew';
      const coverers = arr(b.coverers);
      const dayCoverers = b.dayCoverers || {};
      const allKeys = arr(b.selectedDayKeys);
      if (crewMode && coverers.length > 0) {
        return `
          <div class="bd-section">
            <h4>${esc(t('Crew coverers'))} (${coverers.length})</h4>
            <ul class="coverer-list">
              ${coverers.map((c) => {
                const mineDays = allKeys.filter((k) => dayCoverers[k]?.uid === c.uid);
                return `<li>
                  ${c.photoURL ? `<img class="avatar-mini" src="${esc(c.photoURL)}" alt="" referrerpolicy="no-referrer" style="width: 28px; height: 28px;" />` : ''}
                  <span>${esc(shortName(c.displayName || t('A crewmate')))}${c.uid === state.user?.uid ? ` (${t('you')})` : ''}</span>
                  <small>${esc(t('{n} days', { n: mineDays.length }))}</small>
                </li>`;
              }).join('')}
            </ul>
            ${(() => {
              const remaining = allKeys.filter((k) => !dayCoverers[k]).length;
              return remaining > 0 ? `<p class="muted" style="margin: 8px 0 0; font-size: var(--fs-meta);">${esc(t('{n} days still open.', { n: remaining }))}</p>` : `<p class="muted" style="margin: 8px 0 0; font-size: var(--fs-meta);">${esc(t('All days claimed.'))}</p>`;
            })()}
          </div>
        `;
      }
      if (b.covererUid) {
        return `
          <div class="bd-section">
            <h4>${esc(t('Covered by'))}</h4>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${b.covererPhotoURL ? `<img class="avatar-mini" src="${esc(b.covererPhotoURL)}" alt="" referrerpolicy="no-referrer" style="width: 32px; height: 32px;" />` : ''}
              <span class="bd-value">${esc(b.covererDisplayName || t('A crewmate'))}${b.covererUid === state.user?.uid ? ` (${t('you')})` : ''}</span>
            </div>
          </div>
        `;
      }
      return '';
    })()}

    <div class="bd-grid">
      <span class="bd-label">${esc(t('Window'))}</span>
      <span class="bd-value">${esc(formatDate(b.windowStart?.toDate()))} → ${esc(formatDate(b.windowEnd?.toDate()))} (${esc(t('{n} days', { n: days }))})</span>
      <span class="bd-label">${esc(t('Timezone'))}</span>
      <span class="bd-value">${esc(b.timezone || '')}</span>
      <span class="bd-label">${esc(t('Cost breakdown'))}</span>
      <span class="bd-value">${esc(t('{a} weekdays × {x} + {b} weekend days × {y}', { a: cost.weekdays, x: ECONOMY.COVERAGE_PRICE_PER_DAY, b: cost.weekendDays, y: ECONOMY.COVERAGE_PRICE_PER_DAY * ECONOMY.WEEKEND_MULTIPLIER }))}</span>
      ${b.sla ? `<span class="bd-label">SLA</span><span class="bd-value">${esc(b.sla)}</span>` : ''}
    </div>

    ${b.coverageScope ? `
      <div class="bd-section">
        <h4>${esc(t('Coverage scope'))}</h4>
        <p class="bd-value" style="margin: 0;">${esc(b.coverageScope)}</p>
      </div>
    ` : ''}

    ${reaches.length > 0 ? `
      <div class="bd-section">
        <h4>${esc(t('Reachability'))}</h4>
        <div class="chips">${reaches.map((r) => `<span class="chip chip-cream">${spriteIcon(r.sprite)} ${esc(t(r.label))}</span>`).join('')}</div>
      </div>` : ''}

    ${kinds.length > 0 ? `
      <div class="bd-section">
        <h4>${esc(t("What you'd be covering"))}</h4>
        <div class="chips">${kinds.map((k) => `<span class="chip chip-cyan">${spriteIcon(k.sprite)} ${esc(t(k.label))}</span>`).join('')}</div>
      </div>` : ''}

    ${b.emergencyDef ? `
      <div class="bd-section">
        <h4>${esc(t('What counts as a real emergency'))}</h4>
        <p class="bd-value" style="margin: 0;">${esc(b.emergencyDef)}</p>
      </div>` : ''}

    ${b.aiBriefing ? `
      <div class="bd-section ai-briefing">
        <h4>✨ ${esc(t('AI briefing'))}</h4>
        <div class="ai-content markdown">${renderMarkdown(b.aiBriefing.content || '')}</div>
        <small class="muted" style="display: block; margin-top: 8px;">${esc(t('Generated by Gemini'))} · ${esc(timeAgo(new Date(b.aiBriefing.generatedAtMs || 0)))}</small>
      </div>` : ''}
    ${mine && (b.status === 'open' || b.status === 'accepted' || b.status === 'active') ? `
      <div style="margin-top: var(--sp-3); display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" data-action="gen-briefing" data-bounty-id="${esc(b.id)}" ${state.briefingLoading ? 'disabled' : ''}>
          ${esc(state.briefingLoading ? t('Generating…') : (b.aiBriefing ? '✨ ' + t('Regenerate briefing') : '✨ ' + t('Generate AI briefing')))}
        </button>
        ${b.status === 'open' ? `<button class="btn btn-secondary" data-action="edit-bounty" data-bounty-id="${esc(b.id)}">✏ ${esc(t('Edit details'))}</button>` : ''}
      </div>
    ` : ''}

    ${arr(b.meetings).length > 0 ? `
      <div class="bd-section">
        <h4>${esc(t('Meetings to cover'))} (${arr(b.meetings).length})</h4>
        <ul class="meeting-list bounty-meeting-list">
          ${arr(b.meetings).map((m) => `
            <li>
              <div class="meeting-info">
                <strong>${esc(m.summary)}</strong>
                <small>${esc(formatMeetingDate(m.startMs, m.endMs))}${m.attendees?.length ? ` · ${esc(t('{n} attendees', { n: m.attendees.length }))}` : ''}</small>
                <span class="meeting-links">
                  ${m.hangoutLink ? `<a href="${esc(m.hangoutLink)}" target="_blank" rel="noopener">📹 Meet</a>` : ''}
                  ${arr(m.conferenceLinks).map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener">🔗 ${esc(l.match(/teams|zoom|whereby/i)?.[0] || 'Link')}</a>`).join('')}
                  ${m.htmlLink ? `<a href="${esc(m.htmlLink)}" target="_blank" rel="noopener" class="cal-link">📅 ${esc(t('In Calendar'))}</a>` : ''}
                </span>
                ${m.location ? `<small class="meeting-loc">📍 ${esc(m.location)}</small>` : ''}
              </div>
            </li>
          `).join('')}
        </ul>
        ${b.covererUid === state.user?.uid ? (() => {
          const added = getAddedMeetingIds(b.id);
          const remaining = arr(b.meetings).filter((m) => !added.has(m.googleEventId)).length;
          const markerAdded = localStorage.getItem(`vacaciones.addedMarker.${b.id}`) === '1';
          const allDone = remaining === 0 && markerAdded;
          const label = allDone
            ? t('All added to your calendar')
            : !markerAdded && remaining === 0
              ? '📅 ' + t('Add coverage marker to my calendar')
              : '📅 ' + (remaining > 0 ? t('Add coverage marker + {n} meetings to my calendar', { n: remaining }) : t('Add coverage marker to my calendar'));
          return `<div style="margin-top: 12px;">
            <button class="btn btn-secondary" data-action="add-meetings" data-bounty-id="${esc(b.id)}" ${allDone ? 'disabled' : ''}>${esc(label)}</button>
          </div>`;
        })() : ''}
      </div>` : ''}
  `;
  const isCrew = (b.coverageMode || 'single') === 'crew';
  const dayCoverers = b.dayCoverers || {};
  const allDayKeys = arr(b.selectedDayKeys);
  const remainingDays = allDayKeys.filter((k) => !dayCoverers[k]).length;
  if (status === 'open' && !mine && isCrew && remainingDays > 0) {
    showModal({
      title: t('Bounty detail'),
      body,
      wide: true,
      primaryLabel: t('Claim days ({n} left)', { n: remainingDays }),
      secondaryLabel: t('Back'),
      onPrimary: () => startCrewClaim(bountyId),
    });
  } else if (status === 'open' && !mine) {
    showModal({
      title: t('Bounty detail'),
      body,
      wide: true,
      primaryLabel: t('Cover this bounty'),
      secondaryLabel: t('Back'),
      onPrimary: () => acceptRequest(bountyId),
    });
  } else if (status === 'completed' && mine && b.covererUid) {
    // Requester whose bounty was completed — invite them to send a scroll
    showModal({
      title: t('Bounty detail'),
      body,
      wide: true,
      primaryLabel: '🪶 ' + t('Send Thank-You Scroll'),
      secondaryLabel: t('Close'),
      onPrimary: () => showSendScrollModal(b.covererUid, b.covererDisplayName, b.id),
    });
  } else {
    // Show Cancel option for requester or manager when bounty is still cancellable
    const canCancel = (mine || state.myRole === 'manager')
      && status !== 'cancelled'
      && status !== 'completed';
    const canForceComplete = state.myRole === 'manager'
      && (status === 'accepted' || status === 'active');
    // Append force-complete button into body for managers
    let bodyWithAdmin = body;
    if (canForceComplete) {
      bodyWithAdmin += `<div style="margin-top: 12px;"><button class="btn btn-danger" data-action="force-complete" data-bounty-id="${esc(bountyId)}">🏁 ${esc(t('Force complete'))}</button></div>`;
    }
    showModal({
      title: t('Bounty detail'),
      body: bodyWithAdmin,
      wide: true,
      primaryLabel: t('Close'),
      secondaryLabel: canCancel ? '🗑 ' + t('Cancel bounty') : undefined,
      onSecondary: canCancel ? () => { confirmCancelBounty(bountyId); return false; } : undefined,
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
  const notifs = state.user ? computeNotifications() : [];
  const unread = notifs.filter((n) => n.time.getTime() > state.notifLastSeen).length;

  // Launch-gate item 11: the header carries bell + avatar only. Balance,
  // rank, theme, sound, identity and sign-out live in the Profile sheet.
  target.innerHTML = `
    <button class="bell" data-action="bell" title="${esc(t('Notifications'))}" aria-label="${esc(unread > 0 ? t('Notifications, {n} unread', { n: unread }) : t('Notifications'))}" aria-haspopup="true" aria-expanded="${state.bellOpen ? 'true' : 'false'}">
      <span aria-hidden="true">🔔</span>${unread > 0 ? `<span class="bell-badge" aria-hidden="true">${unread}</span>` : ''}
    </button>
    <button class="avatar-slot" data-action="pick-avatar-open" title="${esc(t('Profile'))}" aria-label="${esc(t('Open profile'))}" aria-haspopup="dialog">
      ${renderAvatar({ uid: u.uid, photoURL: u.photoURL, name: u.displayName, size: 32, klass: 'avatar-img' })}
    </button>
    ${state.bellOpen ? renderBellDropdown(notifs) : ''}
  `;
}

function renderBellDropdown(notifs) {
  return `
    <div class="bell-dropdown" role="region" aria-label="${esc(t('Recent activity'))}">
      <div class="dropdown-title">${esc(t('Recent activity'))}</div>
      ${notifs.length === 0 ? `
        <div class="bell-empty">${esc(t('Nothing new in the harbour.'))}</div>
      ` : `
        <ul class="bell-list">
          ${notifs.map((n) => `
            <li>
              <span class="bell-icon" aria-hidden="true">${n.icon}</span>
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
  else if (state.view === 'help') app.innerHTML = renderHelp();
  else app.innerHTML = '';
}

function renderHelp() {
  return `
    <nav class="breadcrumb">
      <a href="#/">${esc(t('Crews'))}</a><span class="sep">/</span><span class="current">${esc(t('Help'))}</span>
    </nav>
    <header class="team-header">
      <div><h1>${esc(t('How Time Off works'))}</h1></div>
    </header>
    <div class="panel">
      <div class="panel-title">${esc(t('The doubloon economy'))}</div>
      <h3 style="margin-top: 12px;">🪙 ${esc(t("Your purse, your starter chest, the Crown's stipend"))}</h3>
      <p>${t('Every crewmate starts with <strong>125 doubloons</strong> the first time they join a crew — enough to cover ~25 business days of leave right away. On top of that, the Crown drops <strong>11 doubloons</strong> every month into your stipend purse. Stipend doubloons expire at the end of each month, so spend them or lose them. Earned doubloons (the ones you got by covering crewmates) never expire.')}</p>
      <h3>📅 ${esc(t('What a day of coverage costs'))}</h3>
      <p>${t("One day costs <strong>5 doubloons</strong> (Mon–Fri). Weekend days cost <strong>10</strong>. Holidays don't have special rates yet — they cost what their weekday says.")}</p>
      <h3>🏴‍☠️ ${esc(t('Posting a bounty'))}</h3>
      <p>${t("Pick a date range, pick which days you actually want covered (toggle weekends off if you're not asking for them), set how reachable you'll be, what kinds of work need covering, and an SLA. Costs come straight from your wallet (stipend first, then earned). Single coverer mode is the default — one crewmate takes everything. Crew mode lets multiple crewmates split days; the bounty stays open until every day is claimed.")}</p>
      <h3>⚓ ${esc(t('Covering a bounty'))}</h3>
      <p>${t('Browse the Bounty Board. Click any open bounty to see the full briefing. In crew mode you pick which days you can cover; in single mode you take the whole window. Doubloons release to you one day at a time as the days pass, paid out by a daily cron.')}</p>
      <h3>🏆 ${esc(t('Voyage Rank + Wall of Fame'))}</h3>
      <p>${t("Your rank (Cabin Boy → Commodore) is based on lifetime doubloons earned by covering. The Wall of Fame ranks crewmates by what they earned in the last 90 days, so old salts can't sit on their laurels.")}</p>
      <h3>🪶 ${esc(t('Thank-You Scrolls'))}</h3>
      <p>${t("Recognition that isn't tied to doubloons. Send a scroll to a crewmate who covered you well, or tip your hat to anyone on the Wall of Fame.")}</p>
      <h3>📅 Google Calendar</h3>
      <p>${t('Optional. Connect Calendar in the post form to pick which meetings the coverer should attend. When you accept a bounty you can add a coverage marker + the meetings to your own Calendar with one click.')}</p>
      <h3>🤖 ${esc(t('Gemini briefing (manager-configured)'))}</h3>
      <p>${t('If your crew has a Gemini API key in Settings, the requester can hit "✨ Generate briefing" on their bounty and Gemini will draft a structured briefing (orientation, accounts, what to do, emergency protocol, open questions). The coverer reads it inside the bounty detail.')}</p>
    </div>
  `;
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
        <h1 class="login-title">TIME OFF</h1>
        <p class="login-tagline">${esc(t('Tales of Monkey Coverage'))}</p>
        <p class="login-pitch">${esc(t('Going on vacation? Post a bounty. A crewmate covers your accounts — with your briefing in hand — and earns doubloons for it.'))}</p>
        <div class="login-card">
          <button class="btn btn-google" data-action="sign-in" ${busy ? 'disabled' : ''}>
            ${busy ? `<span class="spinner"></span>${esc(t('Signing in…'))}` : `
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>${esc(t('Sign in with Google'))}`}
          </button>
        </div>
      </div>
      <div class="mascot-floater">
        <div class="mascot-bubble">${esc(t(pickMascotLine()))}</div>
        <div class="mascot-sprite">${SVG.turtle}</div>
      </div>
    </div>
  `;
}

function renderHarborBg() {
  return `<svg class="login-bg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1A0E40"/>
        <stop offset="30%" stop-color="#5B3A8C"/>
        <stop offset="55%" stop-color="#C8362D"/>
        <stop offset="75%" stop-color="#E0A93B"/>
        <stop offset="100%" stop-color="#FFCB47"/>
      </linearGradient>
      <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5BC9D1"/>
        <stop offset="50%" stop-color="#1E5A6B"/>
        <stop offset="100%" stop-color="#0F2A38"/>
      </linearGradient>
      <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F7E7C2"/>
        <stop offset="60%" stop-color="#E0A93B"/>
        <stop offset="100%" stop-color="#8C6418"/>
      </linearGradient>
    </defs>

    <!-- Sky -->
    <rect width="320" height="125" fill="url(#sky)"/>
    <!-- Stars (top of sky) -->
    <rect x="20" y="10" width="1" height="1" fill="#F7E7C2"/>
    <rect x="48" y="22" width="1" height="1" fill="#F7E7C2"/>
    <rect x="80" y="8" width="1" height="1" fill="#F7E7C2"/>
    <rect x="140" y="18" width="1" height="1" fill="#F7E7C2" opacity="0.8"/>
    <rect x="260" y="6" width="1" height="1" fill="#F7E7C2"/>
    <rect x="298" y="24" width="1" height="1" fill="#F7E7C2" opacity="0.7"/>
    <rect x="225" y="14" width="1" height="1" fill="#F7E7C2" opacity="0.6"/>

    <!-- Sun setting -->
    <circle cx="160" cy="90" r="22" fill="#FFD86B"/>
    <circle cx="160" cy="90" r="18" fill="#FFCB47"/>
    <circle cx="160" cy="90" r="10" fill="#FFE7A0"/>
    <!-- Sun beams reflecting on water -->
    <rect x="158" y="115" width="4" height="40" fill="#FFCB47" opacity="0.35"/>
    <rect x="155" y="118" width="10" height="2" fill="#FFCB47" opacity="0.25"/>
    <rect x="152" y="125" width="16" height="2" fill="#FFCB47" opacity="0.2"/>
    <rect x="149" y="135" width="22" height="2" fill="#FFCB47" opacity="0.15"/>

    <!-- Distant pirate ship -->
    <rect x="240" y="108" width="28" height="6" fill="#1A0E08"/>
    <rect x="244" y="106" width="20" height="2" fill="#3D2418"/>
    <rect x="252" y="92" width="1" height="14" fill="#1A0E08"/>
    <rect x="247" y="94" width="11" height="10" fill="#E8D7A8" opacity="0.9"/>
    <rect x="248" y="98" width="9" height="4" fill="#C8362D" opacity="0.7"/>
    <rect x="252" y="90" width="1" height="3" fill="#1A0E08"/>
    <rect x="249" y="89" width="6" height="2" fill="#C8362D"/>

    <!-- Ocean -->
    <rect x="0" y="125" width="320" height="35" fill="url(#ocean)"/>
    <!-- Ocean waves -->
    <rect x="0" y="125" width="320" height="1" fill="#A6C2E8" opacity="0.6"/>
    <rect x="10" y="130" width="8" height="1" fill="#A6C2E8" opacity="0.6"/>
    <rect x="40" y="134" width="14" height="1" fill="#A6C2E8" opacity="0.5"/>
    <rect x="90" y="132" width="10" height="1" fill="#A6C2E8" opacity="0.55"/>
    <rect x="115" y="138" width="20" height="1" fill="#A6C2E8" opacity="0.45"/>
    <rect x="200" y="135" width="18" height="1" fill="#A6C2E8" opacity="0.4"/>
    <rect x="240" y="140" width="22" height="1" fill="#A6C2E8" opacity="0.4"/>
    <rect x="280" y="143" width="14" height="1" fill="#A6C2E8" opacity="0.35"/>
    <rect x="20" y="146" width="30" height="1" fill="#A6C2E8" opacity="0.3"/>

    <!-- Beach -->
    <rect x="0" y="160" width="320" height="40" fill="url(#sand)"/>
    <!-- Sand sparkles -->
    <rect x="30" y="170" width="1" height="1" fill="#FFFFFF" opacity="0.6"/>
    <rect x="80" y="175" width="1" height="1" fill="#FFFFFF" opacity="0.5"/>
    <rect x="160" y="172" width="1" height="1" fill="#FFFFFF" opacity="0.6"/>
    <rect x="220" y="178" width="1" height="1" fill="#FFFFFF" opacity="0.5"/>
    <rect x="280" y="174" width="1" height="1" fill="#FFFFFF" opacity="0.6"/>

    <!-- Left palm tree (big) -->
    <rect x="22" y="78" width="3" height="82" fill="#3D2418"/>
    <rect x="20" y="85" width="1" height="20" fill="#5A3A1F"/>
    <rect x="26" y="90" width="1" height="30" fill="#5A3A1F"/>
    <!-- Palm fronds -->
    <rect x="6" y="74" width="18" height="2" fill="#3A6B2C"/>
    <rect x="4" y="76" width="20" height="2" fill="#4A8A38"/>
    <rect x="2" y="78" width="20" height="2" fill="#3A6B2C"/>
    <rect x="25" y="74" width="18" height="2" fill="#3A6B2C"/>
    <rect x="25" y="76" width="22" height="2" fill="#4A8A38"/>
    <rect x="25" y="78" width="24" height="2" fill="#3A6B2C"/>
    <rect x="12" y="68" width="2" height="8" fill="#3A6B2C"/>
    <rect x="14" y="66" width="2" height="8" fill="#4A8A38"/>
    <rect x="32" y="68" width="2" height="8" fill="#3A6B2C"/>
    <rect x="34" y="66" width="2" height="8" fill="#4A8A38"/>
    <!-- Coconuts -->
    <rect x="20" y="80" width="3" height="3" fill="#3D2418"/>
    <rect x="26" y="82" width="3" height="3" fill="#3D2418"/>

    <!-- Right palm tree (big) -->
    <rect x="290" y="72" width="3" height="88" fill="#3D2418"/>
    <rect x="288" y="80" width="1" height="22" fill="#5A3A1F"/>
    <rect x="294" y="84" width="1" height="28" fill="#5A3A1F"/>
    <rect x="272" y="68" width="20" height="2" fill="#3A6B2C"/>
    <rect x="270" y="70" width="22" height="2" fill="#4A8A38"/>
    <rect x="268" y="72" width="22" height="2" fill="#3A6B2C"/>
    <rect x="293" y="68" width="20" height="2" fill="#3A6B2C"/>
    <rect x="293" y="70" width="22" height="2" fill="#4A8A38"/>
    <rect x="293" y="72" width="24" height="2" fill="#3A6B2C"/>
    <rect x="280" y="62" width="2" height="8" fill="#3A6B2C"/>
    <rect x="282" y="60" width="2" height="8" fill="#4A8A38"/>
    <rect x="300" y="62" width="2" height="8" fill="#3A6B2C"/>
    <rect x="302" y="60" width="2" height="8" fill="#4A8A38"/>
    <rect x="288" y="74" width="3" height="3" fill="#3D2418"/>
    <rect x="294" y="76" width="3" height="3" fill="#3D2418"/>

    <!-- Parrot on right palm -->
    <rect x="304" y="78" width="5" height="3" fill="#C8362D"/>
    <rect x="303" y="79" width="1" height="2" fill="#C8362D"/>
    <rect x="305" y="76" width="3" height="2" fill="#3A6B2C"/>
    <rect x="306" y="75" width="2" height="1" fill="#FFCB47"/>
    <rect x="308" y="78" width="1" height="1" fill="#1A0E08"/>
    <rect x="304" y="81" width="2" height="2" fill="#5B3A8C"/>

    <!-- Beach umbrella (between palms, mid-left) -->
    <rect x="78" y="148" width="1" height="20" fill="#1A0E08"/>
    <rect x="68" y="140" width="22" height="2" fill="#C8362D"/>
    <rect x="64" y="142" width="30" height="2" fill="#FFCB47"/>
    <rect x="60" y="144" width="38" height="2" fill="#C8362D"/>
    <rect x="58" y="146" width="42" height="2" fill="#FFCB47"/>
    <rect x="56" y="148" width="46" height="2" fill="#C8362D"/>
    <rect x="76" y="138" width="3" height="2" fill="#FFCB47"/>

    <!-- Beach chair under umbrella with pirate + laptop -->
    <!-- Chair frame -->
    <rect x="62" y="156" width="34" height="2" fill="#3D2418"/>
    <rect x="62" y="158" width="2" height="6" fill="#3D2418"/>
    <rect x="94" y="158" width="2" height="6" fill="#3D2418"/>
    <rect x="92" y="148" width="2" height="10" fill="#3D2418"/>
    <rect x="64" y="150" width="30" height="6" fill="#5BC9D1"/>
    <rect x="64" y="150" width="30" height="1" fill="#A6E5E8"/>

    <!-- Pirate body on chair -->
    <rect x="70" y="146" width="14" height="10" fill="#1A0E08"/>
    <rect x="72" y="148" width="10" height="2" fill="#FFCB47"/>
    <rect x="72" y="151" width="10" height="5" fill="#1A0E08"/>
    <!-- Pirate head -->
    <rect x="72" y="138" width="10" height="8" fill="#E0A93B"/>
    <rect x="73" y="140" width="2" height="1" fill="#1A0E08"/>
    <rect x="79" y="140" width="2" height="1" fill="#1A0E08"/>
    <!-- Eyepatch -->
    <rect x="78" y="139" width="4" height="3" fill="#1A0E08"/>
    <rect x="76" y="140" width="2" height="1" fill="#1A0E08"/>
    <!-- Mouth/beard -->
    <rect x="74" y="143" width="6" height="1" fill="#1A0E08"/>
    <rect x="74" y="144" width="2" height="2" fill="#F7E7C2"/>
    <rect x="78" y="144" width="2" height="2" fill="#F7E7C2"/>
    <!-- Pirate hat (tricorn) -->
    <rect x="68" y="134" width="18" height="3" fill="#1A0E08"/>
    <rect x="70" y="131" width="14" height="3" fill="#1A0E08"/>
    <rect x="74" y="129" width="6" height="2" fill="#1A0E08"/>
    <rect x="76" y="132" width="2" height="2" fill="#F7E7C2"/>
    <rect x="78" y="132" width="2" height="2" fill="#1A0E08"/>
    <rect x="76" y="133" width="2" height="1" fill="#F7E7C2"/>
    <rect x="80" y="132" width="1" height="1" fill="#F7E7C2"/>

    <!-- Pirate's laptop -->
    <rect x="68" y="153" width="12" height="1" fill="#3D2418"/>
    <rect x="68" y="146" width="12" height="7" fill="#1A0E08"/>
    <rect x="69" y="147" width="10" height="5" fill="#5BC9D1"/>
    <rect x="71" y="148" width="2" height="1" fill="#FFCB47"/>
    <rect x="74" y="148" width="4" height="1" fill="#F7E7C2"/>
    <rect x="71" y="150" width="6" height="1" fill="#F7E7C2"/>

    <!-- Second pirate further right with laptop -->
    <!-- Towel -->
    <rect x="180" y="170" width="40" height="4" fill="#C8362D"/>
    <rect x="180" y="171" width="40" height="1" fill="#E25347"/>
    <rect x="184" y="170" width="2" height="4" fill="#FFCB47"/>
    <rect x="200" y="170" width="2" height="4" fill="#FFCB47"/>
    <rect x="216" y="170" width="2" height="4" fill="#FFCB47"/>
    <!-- Pirate 2 sitting body -->
    <rect x="192" y="160" width="14" height="10" fill="#3D2418"/>
    <rect x="194" y="162" width="10" height="2" fill="#F7E7C2"/>
    <!-- Pirate 2 head -->
    <rect x="194" y="152" width="10" height="8" fill="#C4A86B"/>
    <rect x="195" y="154" width="2" height="1" fill="#1A0E08"/>
    <rect x="201" y="154" width="2" height="1" fill="#1A0E08"/>
    <rect x="196" y="157" width="6" height="1" fill="#1A0E08"/>
    <!-- Bandana -->
    <rect x="192" y="148" width="14" height="4" fill="#C8362D"/>
    <rect x="192" y="149" width="14" height="1" fill="#E25347"/>
    <rect x="190" y="150" width="2" height="3" fill="#C8362D"/>
    <rect x="206" y="150" width="2" height="3" fill="#C8362D"/>
    <!-- Pirate 2 laptop -->
    <rect x="190" y="167" width="14" height="1" fill="#3D2418"/>
    <rect x="190" y="160" width="14" height="7" fill="#1A0E08"/>
    <rect x="191" y="161" width="12" height="5" fill="#5BC9D1"/>
    <rect x="193" y="162" width="3" height="1" fill="#FFCB47"/>
    <rect x="197" y="162" width="5" height="1" fill="#F7E7C2"/>
    <rect x="193" y="164" width="8" height="1" fill="#F7E7C2"/>

    <!-- Treasure chest in foreground -->
    <rect x="120" y="172" width="22" height="14" fill="#3D2418"/>
    <rect x="120" y="170" width="22" height="2" fill="#5A3A1F"/>
    <rect x="122" y="174" width="18" height="10" fill="#5A3A1F"/>
    <rect x="124" y="176" width="2" height="6" fill="#FFCB47"/>
    <rect x="136" y="176" width="2" height="6" fill="#FFCB47"/>
    <rect x="130" y="174" width="2" height="3" fill="#1A0E08"/>
    <rect x="131" y="175" width="1" height="1" fill="#FFCB47"/>
    <rect x="124" y="184" width="2" height="2" fill="#FFCB47"/>
    <rect x="138" y="184" width="2" height="2" fill="#FFCB47"/>
    <!-- Coins spilling out -->
    <rect x="143" y="184" width="3" height="3" fill="#FFCB47"/>
    <rect x="147" y="186" width="3" height="3" fill="#FFCB47"/>
    <rect x="150" y="185" width="2" height="2" fill="#FFD86B"/>
    <rect x="116" y="186" width="3" height="3" fill="#FFCB47"/>
    <rect x="113" y="187" width="2" height="2" fill="#FFD86B"/>

    <!-- Small crab on the right beach -->
    <rect x="252" y="186" width="6" height="3" fill="#C8362D"/>
    <rect x="251" y="187" width="1" height="1" fill="#C8362D"/>
    <rect x="258" y="187" width="1" height="1" fill="#C8362D"/>
    <rect x="253" y="185" width="1" height="1" fill="#1A0E08"/>
    <rect x="256" y="185" width="1" height="1" fill="#1A0E08"/>
    <rect x="250" y="186" width="1" height="1" fill="#C8362D"/>
    <rect x="259" y="186" width="1" height="1" fill="#C8362D"/>
    <rect x="252" y="189" width="1" height="1" fill="#C8362D"/>
    <rect x="257" y="189" width="1" height="1" fill="#C8362D"/>
  </svg>`;
}

/* ============================================================
   Home
   ============================================================ */

function renderHome() {
  const teams = state.myTeams;
  return `
    <section class="hero">
      <h1>${esc(t('Welcome aboard, {name}', { name: firstName(state.user?.displayName) }))}</h1>
      <p>${esc(t('Pick a crew to manage bounties, or raise your own colours.'))}</p>
    </section>
    <section>
      <h2>${esc(t('Your Crews'))}</h2>
      ${teams.length === 0 ? `
        <div class="empty-card">
          <div class="empty-mascot">${SVG.turtle}</div>
          <p><strong>${esc(t('No crew yet.'))}</strong></p>
          <p class="muted">${esc(t('Form one with your colleagues, or sign on with an invite link.'))}</p>
        </div>
      ` : `
        <ul class="team-list">
          ${teams.map((tm) => `
            <li>
              <a href="#/team/${esc(tm.id)}" class="team-card">
                ${tm.photoURL
                  ? `<img class="team-flag" src="${esc(tm.photoURL)}" alt="" referrerpolicy="no-referrer" />`
                  : `<span class="team-flag">${SVG.flag}</span>`}
                <div class="team-main">
                  <strong>${esc(tm.name)}</strong>
                  <small>${esc(t('{n} crewmates', { n: tm.memberUids?.length || 0 }))}</small>
                </div>
                <code class="team-id-chip" title="${esc(t('Crew ID (internal reference — invites use manager-shared links)'))}">${esc(tm.id)}</code>
                <span class="arrow">▶</span>
              </a>
            </li>
          `).join('')}
        </ul>
      `}
    </section>
    <section class="actions">
      <div class="panel">
        <div class="panel-title">${esc(t('Form a crew'))}</div>
        <p class="muted" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 18px; margin: 0 0 12px;">${esc(t('You become the quartermaster. Every crewmate starts with 125 doubloons — enough to cover 25 business days right away.'))}</p>
        <div class="row">
          <input id="new-team-name" type="text" placeholder="${esc(t('Crew name'))}" maxlength="100" ${state.busy.createTeam ? 'disabled' : ''} />
          <button class="btn" data-action="create-team" ${state.busy.createTeam ? 'disabled' : ''}>${esc(state.busy.createTeam ? t('Creating…') : t('Create crew'))}</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">${esc(t('Sign on with a crew'))}</div>
        <p class="muted" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 18px; margin: 0 0 12px;">${esc(t('Paste the invite link a crew manager shared.'))}</p>
        <div class="row">
          <input id="join-team-id" type="text" placeholder="${esc(t('Invite link'))}" ${state.busy.joinTeam ? 'disabled' : ''} />
          <button class="btn" data-action="join-team" ${state.busy.joinTeam ? 'disabled' : ''}>${esc(state.busy.joinTeam ? t('Joining…') : t('Join'))}</button>
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
        <h2 style="color: var(--ink-pure);">${esc(t('Crew not found'))}</h2>
        <p class="muted">${esc(t('You may have been pressed elsewhere, or the crew ID is wrong.'))}</p>
        <p style="margin-top: 16px;"><a href="#/">◀ ${esc(t('Back to your crews'))}</a></p>
      </div>
    `;
  }
  const openCount = state.bounties.filter((b) => b.status === 'open').length;
  const tab = state.teamTab;
  let body = '';
  if (tab === 'chest') body = renderChestTab();
  else if (tab === 'post') body = renderPostTab();
  else if (tab === 'wof') body = renderWofTab();
  else if (tab === 'settings') body = renderSettingsTab();
  else if (tab === 'members') body = renderMembersTab();
  else body = renderBountyBoardTab();

  return `
    <nav class="breadcrumb">
      <a href="#/">${esc(t('Crews'))}</a><span class="sep">/</span><span class="current">${esc(team.name)}</span>
    </nav>
    <header class="team-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${team.photoURL
          ? `<img src="${esc(team.photoURL)}" alt="" referrerpolicy="no-referrer" style="width: 48px; height: 48px; box-shadow: 0 0 0 2px var(--wood-dark); image-rendering: pixelated;" />`
          : `<span style="width: 48px; height: 48px; display: inline-block;">${SVG.flag}</span>`}
        <div>
          <h1>${esc(team.name)}</h1>
          <small>${esc(t('{n} crewmates', { n: team.memberUids?.length || 0 }))} · ID: <code>${esc(team.id)}</code></small>
        </div>
      </div>
      <div class="invite-actions">
        ${state.myRole === 'manager' ? `<button class="btn-ghost" data-action="manage-crew">✏ ${esc(t('Manage'))}</button>` : ''}
        ${state.myRole === 'manager' ? `<button class="btn-ghost" data-action="copy-invite" data-id="${esc(team.id)}">🔗 ${esc(t('Share invite'))}</button>` : ''}
      </div>
    </header>
    <nav class="tabs" aria-label="${esc(t('Crew navigation'))}">
      <a href="#/team/${esc(team.id)}" class="tab ${tab === 'bounties' ? 'active' : ''}" ${tab === 'bounties' ? 'aria-current="page"' : ''}>${esc(t('Bounty Board'))} ${openCount > 0 ? `<span class="tab-count" aria-label="${esc(t('{n} open', { n: openCount }))}">${openCount}</span>` : ''}</a>
      <a href="#/team/${esc(team.id)}/chest" class="tab ${tab === 'chest' ? 'active' : ''}" ${tab === 'chest' ? 'aria-current="page"' : ''}>${esc(t('Treasure Chest'))}</a>
      <a href="#/team/${esc(team.id)}/wof" class="tab ${tab === 'wof' ? 'active' : ''}" ${tab === 'wof' ? 'aria-current="page"' : ''}>${esc(t('Wall of Fame'))}</a>
      <a href="#/team/${esc(team.id)}/members" class="tab ${tab === 'members' ? 'active' : ''}" ${tab === 'members' ? 'aria-current="page"' : ''}>${esc(t('Crew'))}</a>
      <a href="#/team/${esc(team.id)}/post" class="tab ${tab === 'post' ? 'active' : ''}" ${tab === 'post' ? 'aria-current="page"' : ''}>${esc(t('Post Bounty'))}</a>
      ${state.myRole === 'manager' ? `<a href="#/team/${esc(team.id)}/settings" class="tab ${tab === 'settings' ? 'active' : ''}" ${tab === 'settings' ? 'aria-current="page"' : ''}><span aria-hidden="true">⚙ </span>${esc(t('Settings'))}</a>` : ''}
    </nav>
    ${body}
  `;
}

/* First-run "how it works" strip — three steps, dismissible, shown on the
   Bounty Board until dismissed. The single biggest "I don't get this
   product" fix: the mechanic explained where the user lands. */
function renderHowItWorks() {
  if (localStorage.getItem('vacaciones.howDismissed') === '1') return '';
  return `
    <section class="panel howto" aria-label="${esc(t('How Time Off works'))}">
      <button class="howto-dismiss" data-action="dismiss-how" title="${esc(t('Got it — hide this'))}" aria-label="${esc(t('Got it — hide this'))}">✕</button>
      <div class="howto-steps">
        <div class="howto-step">
          <span class="howto-num">1</span>
          ${spriteIcon('unreachable')}
          <strong>${esc(t('Post'))}</strong>
          <small>${esc(t('Going out? Post a bounty with your days, reachability, and context.'))}</small>
        </div>
        <div class="howto-step">
          <span class="howto-num">2</span>
          ${spriteIcon('deckhand')}
          <strong>${esc(t('Cover'))}</strong>
          <small>${esc(t('A crewmate claims it and gets your briefing — accounts, meetings, SLA.'))}</small>
        </div>
        <div class="howto-step">
          <span class="howto-num">3</span>
          ${spriteIcon('first-mate')}
          <strong>${esc(t('Earn'))}</strong>
          <small>${esc(t('They earn doubloons day by day. Spend yours on your next trip.'))}</small>
        </div>
      </div>
      <div class="howto-actions">
        <button class="btn" data-action="preset-next-week">🏝 ${esc(t("I'm out next week"))}</button>
        <a href="#/help" class="btn-ghost">${esc(t('Full guide'))}</a>
      </div>
    </section>
  `;
}

/* One-click preset: prefill next week's Mon–Fri and jump to the post form.
   Time-to-first-bounty is the product's north-star input (docs/17 §B2). */
function applyNextWeekPreset() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysToMonday = ((8 - dow) % 7) || 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMonday);
  const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const f = state.formState;
  f.startDate = iso(monday);
  f.endDate = iso(friday);
  f.selectedDayKeys = allDayKeysInRange(parseLocalDate(f.startDate), parseLocalDate(f.endDate));
  if (f.reachability.length === 0) f.reachability = ['email-only-emergencies'];
  if (!f.sla) f.sla = t('Reply to P1s within 4h');
  f.coverageMode = f.coverageMode || 'single';
  navigate('team', state.teamId, 'post');
  render();
  showToast(t('Prefilled next week (Mon–Fri). Adjust and post.'), 'success', 4000);
}

/* Bounty Board */
function renderBountyBoardTab() {
  const filter = state.bountyFilter;
  const searchText = (state.bountyFilterText || '').trim().toLowerCase();
  let list = state.bounties.slice();
  if (filter === 'open') list = list.filter((b) => b.status === 'open');
  else if (filter === 'taken') list = list.filter((b) => b.status === 'accepted' || b.status === 'active');
  else if (filter === 'done') list = list.filter((b) => b.status === 'completed');
  else if (filter === 'mine') list = list.filter((b) => b.requesterUid === state.user.uid);
  if (searchText) {
    list = list.filter((b) => {
      const hay = [
        b.requesterDisplayName,
        b.coverageScope,
        b.sla,
        b.emergencyDef,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(searchText);
    });
  }
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
    ${renderHowItWorks()}
    <section>
      <div class="filter-row">
        ${renderFilter('all', `${t('All')} · ${counts.all}`)}
        ${renderFilter('open', `${t('Open')} · ${counts.open}`)}
        ${renderFilter('taken', `${t('Taken')} · ${counts.taken}`)}
        ${renderFilter('done', `${t('Done')} · ${counts.done}`)}
        ${renderFilter('mine', `${t('Mine')} · ${counts.mine}`)}
      </div>
      <div class="search-row">
        <input id="bounty-search" type="text" placeholder="${esc(t('Search requester, scope, SLA…'))}" value="${esc(state.bountyFilterText)}" />
        ${state.bountyFilterText ? `<button class="btn-ghost" data-action="clear-search">${esc(t('Clear'))}</button>` : ''}
        <button class="btn-ghost density-toggle" data-action="toggle-density" title="${esc(state.density === 'compact' ? t('Switch to comfortable rows') : t('Switch to compact rows'))}" aria-pressed="${state.density === 'compact' ? 'true' : 'false'}" aria-label="${esc(state.density === 'compact' ? t('Switch to comfortable rows') : t('Switch to compact rows'))}">${esc(state.density === 'compact' ? t('Comfortable') : t('Compact'))}</button>
      </div>
      ${list.length === 0 ? `
        <div class="empty-card">
          <div class="empty-mascot">${SVG.turtle}</div>
          <p><strong>${esc(filter === 'all' ? t('The bounty board is empty.') : t('Nothing matches this filter.'))}</strong></p>
          <p class="muted">${esc(filter === 'all' ? t('Post one yourself — your crewmates earn doubloons by covering you.') : t('Switch the filter above to see other bounties.'))}</p>
          ${filter === 'all' ? `
            <div style="margin-top: 16px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              <button class="btn" data-action="preset-next-week">🏝 ${esc(t("I'm out next week"))}</button>
              <a href="#/team/${esc(state.teamId)}/post" class="btn-ghost">${esc(t('Post a bounty'))}</a>
            </div>` : ''}
        </div>
      ` : `<ul class="bounties" data-density="${esc(state.density)}">${list.map(renderBountyCard).join('')}</ul>`}
    </section>
  `;
}

function renderFilter(value, label) {
  const active = state.bountyFilter === value;
  return `<button class="filter-chip ${active ? 'active' : ''}" data-action="set-filter" data-filter="${value}">${esc(label)}</button>`;
}

function renderBountyCard(b) {
  const status = b.status || 'open';
  const statusLabel = t(STATUS_LABEL[status] || status);
  const mine = b.requesterUid === state.user?.uid;
  const accepting = state.busy.acceptId === b.id;
  const days = Math.max(1, Math.round(((b.windowEnd?.toDate?.() ?? new Date()) - (b.windowStart?.toDate?.() ?? new Date())) / 86400000) + 1);
  const reqName = b.requesterDisplayName || (mine ? t('You') : t('A crewmate'));
  const reqPhoto = b.requesterPhotoURL;
  const mode = b.coverageMode || 'single';
  const isCrew = mode === 'crew';
  const allDays = arr(b.selectedDayKeys);
  const dayCoverers = b.dayCoverers || {};
  const claimedCount = allDays.filter((k) => dayCoverers[k]).length;
  const remainingCount = allDays.length - claimedCount;
  const coverers = arr(b.coverers);
  const youCover = coverers.some((c) => c.uid === state.user?.uid)
    || b.covererUid === state.user?.uid;
  const youHaveDays = allDays.some((k) => dayCoverers[k]?.uid === state.user?.uid);

  let actionHtml = '';
  if (mine) {
    actionHtml = `<span class="own-tag">${esc(t('Your bounty'))}</span>`;
  } else if (isCrew && status === 'open') {
    actionHtml = `<button class="btn" data-action="crew-claim" data-id="${esc(b.id)}" ${accepting ? 'disabled' : ''}>${accepting ? esc(t('Accepting…')) : esc(t('Claim days ({n} left)', { n: remainingCount }))}</button>`;
  } else if (status === 'open') {
    actionHtml = `<button class="btn" data-action="accept" data-id="${esc(b.id)}" ${accepting ? 'disabled' : ''}>${accepting ? esc(t('Accepting…')) : esc(t('Cover'))}</button>`;
  }
  // Taken states need no action slot — the status badge (row 1) and the
  // "covered by" note (row 2) carry it.

  // Launch-gate item 7 — the card is three lines. Scope, SLA, chips and
  // meetings live in the detail modal (click anywhere on the card).
  // Line 2 carries who-covers when the bounty is taken.
  const covererNote = (() => {
    if (status === 'open') return '';
    if (isCrew && coverers.length > 0) {
      const names = coverers.slice(0, 2).map((c) => shortName(c.displayName ?? '')).join(', ');
      return ` · ${t('covered by {name}', { name: names })}${coverers.length > 2 ? ` +${coverers.length - 2}` : ''}`;
    }
    if (b.covererDisplayName || youCover) {
      return ` · ${t('covered by {name}', { name: shortName(b.covererDisplayName || t('you')) })}`;
    }
    return '';
  })();

  return `
    <li class="bounty bounty-${status}" data-bounty-id="${esc(b.id)}" role="button" tabindex="0" aria-label="${esc(t('Bounty from {name}, {status}, {n} doubloons', { name: b.requesterDisplayName ?? t('A crewmate'), status: statusLabel, n: b.totalCoinsOffered ?? 0 }))}" style="cursor: pointer;">
      <div class="b-row1">
        ${reqPhoto ? `<img class="avatar-mini" src="${esc(reqPhoto)}" alt="" referrerpolicy="no-referrer" />` : `<span class="avatar-mini avatar-mini-blank"></span>`}
        <strong class="b-name" title="${esc(b.requesterDisplayName ?? '')}">${esc(shortName(reqName))}</strong>
        <span class="status-badge status-${status}">${esc(statusLabel)}</span>
        ${isCrew ? `<span class="mode-pill" title="${esc(t('{a}/{b} days claimed', { a: claimedCount, b: allDays.length }))}">${esc(t('Crew'))} ${claimedCount}/${allDays.length}</span>` : ''}
        ${(youHaveDays || youCover) ? `<span class="mine-pill">${esc(t('You'))}</span>` : ''}
      </div>
      <div class="b-row2">
        ${esc(formatDate(b.windowStart?.toDate()))} – ${esc(formatDate(b.windowEnd?.toDate()))}
        · ${esc(t('{n} days', { n: days }))}${b.timezone ? ` · ${esc(b.timezone)}` : ''}${esc(covererNote)}
      </div>
      <div class="b-row3">
        <span class="b-price">${SVG.doubloon}<strong>${b.totalCoinsOffered ?? 0}</strong></span>
        ${actionHtml}
      </div>
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
      <div class="rank-emblem">${SVG.icons[rank.sprite] ?? ''}</div>
      <div class="rank-info">
        <div class="rank-name">${esc(t(rank.name))}</div>
        <div class="rank-progress">
          ${rank.nextName
            ? t('Earn <strong>{n}</strong> more doubloons to reach <strong>{rank}</strong>.', { n: rank.toNext, rank: esc(t(rank.nextName)) })
            : t('Highest rank achieved. Your name will be sung in shanties.')}
        </div>
        <div class="rank-bar"><div class="rank-bar-fill" style="width: ${Math.round(rank.progress * 100)}%"></div></div>
        <div><button class="btn-ghost" data-action="replay-cine" style="margin-top: 6px;">▶ ${esc(t('Replay promotion ceremony'))}</button></div>
      </div>
    </div>

    <div class="panel wallet-panel">
      <div class="panel-title">${esc(t('Your treasure chest'))}</div>
      ${w ? `
        <div class="balances">
          <div class="bucket">
            <strong>${w.earnedBalance ?? 0}</strong>
            <small>${esc(t('Earned'))}</small>
          </div>
          <div class="bucket">
            <strong>${w.stipendBalance ?? 0}</strong>
            <small>${esc(t('Crown’s stipend'))}</small>
            <em>${esc(t('resets monthly'))}</em>
          </div>
          <div class="bucket total">
            <strong>${(w.earnedBalance ?? 0) + (w.stipendBalance ?? 0)}</strong>
            <small>${esc(t('Total doubloons'))}</small>
          </div>
        </div>
      ` : `<p class="muted" style="margin: 0 0 12px;">${esc(t('No doubloons yet — the chest will fill as you act.'))}</p>`}

      <h3 style="margin-bottom: 8px;">${esc(t('Honors'))}</h3>
      <div class="achievements">
        ${achievements.map((a) => `
          <div class="badge ${a.unlocked ? '' : 'locked'}" title="${esc(t(a.name))}">
            <div class="badge-icon">${a.icon}</div>
            <div class="badge-name">${esc(t(a.name))}</div>
          </div>
        `).join('')}
      </div>

      <div style="margin: 12px 0 8px; display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
        <h3 style="margin: 0;">${esc(t('Captain’s log'))}</h3>
        ${state.ledger.length > 0 ? `<button class="btn-ghost" data-action="export-csv">📥 ${esc(t('Download CSV'))}</button>` : ''}
      </div>
      ${state.ledger.length === 0 ? `<p class="muted">${esc(t('Your ledger is empty for now.'))}</p>` : `
        <ul class="ledger">
          ${state.ledger.slice(0, 20).map((e) => `
            <li class="${e.amountSigned > 0 ? 'credit' : e.amountSigned < 0 ? 'debit' : ''}">
              <div>
                <strong>${esc(t(LEDGER_TYPE_LABELS[e.type] ?? e.type))}</strong>
                <small>${esc(formatDateTime(e.createdAt?.toDate()))}</small>
              </div>
              <span class="amount">
                ${e.amountSigned > 0 ? '+' : ''}${e.amountSigned}
                <small>${esc(t(e.balanceBucket))}</small>
              </span>
            </li>
          `).join('')}
        </ul>
      `}
    </div>
  `;
}

/* Post tab */
function renderDayPicker() {
  const f = state.formState;
  const start = parseLocalDate(f.startDate);
  const end = parseLocalDate(f.endDate);
  if (!start || !end || end < start) {
    return `<div class="meetings-picker"><span class="muted" style="font-size: var(--fs-meta);">${esc(t('Pick the date range above first.'))}</span></div>`;
  }
  const allKeys = allDayKeysInRange(start, end);
  const selectedSet = new Set(f.selectedDayKeys.length > 0 ? f.selectedDayKeys : allKeys);
  if (f.selectedDayKeys.length === 0) f.selectedDayKeys = allKeys.slice();
  const cost = computeCostFromKeys(Array.from(selectedSet));
  return `
    <div class="meetings-picker">
      <div class="meetings-head">
        <span class="muted" style="font-size: var(--fs-meta);">${esc(t('{a} of {b} days · {n} doubloons', { a: selectedSet.size, b: allKeys.length, n: cost.totalCoins }))}</span>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button type="button" class="btn-ghost" data-action="select-weekdays">${esc(t('Weekdays only'))}</button>
          <button type="button" class="btn-ghost" data-action="select-all-days">${esc(t('All'))}</button>
        </div>
      </div>
      <ul class="day-list">
        ${allKeys.map((key) => {
          const d = parseDateKey(key);
          const dow = d.getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const cost = isWeekend ? 10 : 5;
          const sel = selectedSet.has(key);
          return `
            <li class="day-card ${sel ? 'selected' : 'off'} ${isWeekend ? 'weekend' : ''}" data-action="toggle-day" data-day-key="${esc(key)}" role="button" tabindex="0" aria-pressed="${sel ? 'true' : 'false'}" aria-label="${esc(t(WEEKDAY_NAMES[dow]))} ${d.getUTCDate()} ${esc(t(MONTH_NAMES[d.getUTCMonth()]))}, ${esc(t('{n} doubloons', { n: cost }))}, ${esc(sel ? t('selected') : t('not selected'))}">
              <strong aria-hidden="true">${esc(t(WEEKDAY_NAMES[dow]))}</strong>
              <span class="day-date" aria-hidden="true">${d.getUTCDate()} ${esc(t(MONTH_NAMES[d.getUTCMonth()]))}</span>
              <span class="day-cost" aria-hidden="true">${cost} <small>${SVG.doubloon}</small></span>
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}

function renderMeetingsPicker() {
  const f = state.formState;
  const hasDates = !!parseLocalDate(f.startDate) && !!parseLocalDate(f.endDate);
  if (!hasDates) {
    return `<div class="meetings-picker"><span class="muted" style="font-size: var(--fs-meta);">${esc(t('Pick dates above to see your meetings in that window.'))}</span></div>`;
  }
  if (!calendar.isConnected()) {
    return `
      <div class="meetings-picker">
        <button type="button" class="btn btn-secondary" data-action="connect-calendar">📅 ${esc(t('Connect Google Calendar'))}</button>
        <p class="muted" style="margin: 8px 0 0; font-size: var(--fs-meta);">${esc(t('Optional. Lets you pick which meetings the coverer should attend, with Meet/Teams/Zoom links included.'))}</p>
      </div>
    `;
  }
  if (state.calendarLoading) {
    return `<div class="meetings-picker"><span class="loading-doubloon">${SVG.doubloon}</span> ${esc(t('Loading meetings…'))}</div>`;
  }
  if (state.calendarError) {
    return `
      <div class="meetings-picker">
        <p class="error-text">${esc(t('Calendar: {msg}', { msg: state.calendarError }))}</p>
        <button type="button" class="btn-ghost" data-action="refresh-cal">↻ ${esc(t('Retry'))}</button>
      </div>
    `;
  }
  const events = state.calendarEvents;
  if (events.length === 0) {
    return `
      <div class="meetings-picker">
        <p class="muted" style="margin: 0;">${esc(t('No meetings in this window. (Clear sailing!)'))}</p>
        <button type="button" class="btn-ghost" data-action="refresh-cal" style="margin-top: 8px;">↻ ${esc(t('Refresh'))}</button>
      </div>
    `;
  }
  const selectedIds = new Set(f.meetings.map((m) => m.googleEventId));
  return `
    <div class="meetings-picker">
      <div class="meetings-head">
        <span class="muted" style="font-size: var(--fs-meta);">${esc(t('{n} meetings in window. Tick the ones the coverer should handle.', { n: events.length }))}</span>
        <button type="button" class="btn-ghost" data-action="refresh-cal">↻ ${esc(t('Refresh'))}</button>
      </div>
      <ul class="meeting-list">
        ${events.map((m) => `
          <li>
            <label class="meeting-row ${selectedIds.has(m.googleEventId) ? 'selected' : ''}">
              <input type="checkbox" name="meeting" value="${esc(m.googleEventId)}" ${selectedIds.has(m.googleEventId) ? 'checked' : ''} data-meeting-id="${esc(m.googleEventId)}" />
              <span class="check-box"></span>
              <span class="meeting-info">
                <strong>${esc(m.summary)}</strong>
                <small>${esc(formatMeetingDate(m.startMs, m.endMs))}${m.attendees?.length ? ` · ${esc(t('{n} attendees', { n: m.attendees.length }))}` : ''}</small>
                <span class="meeting-links">
                  ${m.hangoutLink ? `<a href="${esc(m.hangoutLink)}" target="_blank" rel="noopener">📹 Meet</a>` : ''}
                  ${m.conferenceLinks?.map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener">🔗 ${esc(l.match(/teams|zoom|whereby/i)?.[0] || 'Link')}</a>`).join('') || ''}
                  ${m.htmlLink ? `<a href="${esc(m.htmlLink)}" target="_blank" rel="noopener" class="cal-link">📅 ${esc(t('In Calendar'))}</a>` : ''}
                </span>
                ${m.location ? `<small class="meeting-loc">📍 ${esc(m.location)}</small>` : ''}
              </span>
            </label>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function computeCurrentPostCost() {
  const f = state.formState;
  if (f.selectedDayKeys.length > 0) return computeCostFromKeys(f.selectedDayKeys);
  return computeCoverageCost(parseLocalDate(f.startDate), parseLocalDate(f.endDate));
}

function renderPostTab() {
  const tz = state.formState.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  state.formState.timezone = tz;
  const f = state.formState;
  const cost = computeCurrentPostCost();
  return `
    <div class="create-card">
      <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span>${esc(t('Post a bounty'))}</span>
        <button type="button" class="btn-ghost" data-action="preset-next-week">🏝 ${esc(t("I'm out next week"))}</button>
      </div>
      <p class="muted" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 18px; margin: 0 0 14px;">
        ${esc(t('{x}× multiplier on Saturdays and Sundays. Doubloons leave your chest and sit in escrow until a crewmate covers.', { x: ECONOMY.WEEKEND_MULTIPLIER }))}
      </p>
      <form id="create-form" autocomplete="off">
        <div class="form-grid">
          <label><span>${esc(t('Shore leave from'))}</span><input type="date" name="startDate" value="${esc(f.startDate)}" /></label>
          <label><span>${esc(t('Returning by'))}</span><input type="date" name="endDate" value="${esc(f.endDate)}" /></label>
          <label class="wide"><span>${esc(t('Timezone'))}</span><input type="text" name="timezone" value="${esc(tz)}" /></label>
          <label class="wide">
            <span>${esc(t('What you’re covered for · pick any'))}</span>
            <div class="check-group">
              ${COVERAGE_KIND_OPTIONS.map((k) => `
                <label class="check-pixel">
                  <input type="checkbox" name="coverageKinds" value="${esc(k.value)}" ${f.coverageKinds.includes(k.value) ? 'checked' : ''}/>
                  <span class="check-box"></span>
                  <span class="check-label">${spriteIcon(k.sprite)} ${esc(t(k.label))}</span>
                </label>
              `).join('')}
            </div>
          </label>
          <label class="wide">
            <span>${esc(t('How reachable while away · pick any'))}</span>
            <div class="check-group">
              ${REACHABILITY_OPTIONS.map((r) => `
                <label class="check-pixel">
                  <input type="checkbox" name="reachability" value="${esc(r.value)}" ${f.reachability.includes(r.value) ? 'checked' : ''}/>
                  <span class="check-box"></span>
                  <span class="check-label">${spriteIcon(r.sprite)} ${esc(t(r.label))}</span>
                </label>
              `).join('')}
            </div>
          </label>
          <div class="wide" id="day-picker-host">
            <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 11px; color: var(--ink-pure); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; display: block;">${esc(t('Days to be covered · click to toggle'))}</span>
            ${renderDayPicker()}
          </div>

          <div class="wide">
            <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 11px; color: var(--ink-pure); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; display: block;">${esc(t('Coverage mode'))}</span>
            <div class="mode-toggle">
              <label class="mode-option">
                <input type="radio" name="coverageMode" value="single" ${(f.coverageMode || 'single') === 'single' ? 'checked' : ''} />
                <div>
                  <strong>👤 ${esc(t('Single coverer'))}</strong>
                  <small>${esc(t('One crewmate takes the whole window. Some clients want only one person on the rotation.'))}</small>
                </div>
              </label>
              <label class="mode-option">
                <input type="radio" name="coverageMode" value="crew" ${f.coverageMode === 'crew' ? 'checked' : ''} />
                <div>
                  <strong>🏴‍☠️ ${esc(t('Crew coverage'))}</strong>
                  <small>${esc(t('Several crewmates can split the days. Long vacations get covered faster.'))}</small>
                </div>
              </label>
            </div>
          </div>

          <label class="wide"><span>${esc(t('Coverage scope · which accounts / responsibilities'))}</span><input type="text" name="coverageScope" placeholder="${esc(t('e.g. Acme + 2 SMBs · my weekly 1:1s with BigCorp'))}" value="${esc(f.coverageScope)}" /></label>

          <div class="wide" id="meetings-picker-host">
            <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 11px; color: var(--ink-pure); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; display: block;">${esc(t('Meetings to be covered'))}</span>
            ${renderMeetingsPicker()}
          </div>
          <label class="wide"><span>${esc(t('SLA the coverer should hold'))}</span><input type="text" name="sla" value="${esc(f.sla)}" /></label>
          <label class="wide"><span>${esc(t('What counts as a real emergency? (optional)'))}</span><textarea name="emergencyDef" rows="2" placeholder="${esc(t('“Wake me only if Acme’s production is down.”'))}">${esc(f.emergencyDef)}</textarea></label>
        </div>
        <div class="preview-row">
          <div class="preview">
            ${cost.days > 0
              ? `<div class="cost"><strong>${cost.totalCoins}</strong><span>${esc(t('doubloons'))}</span></div>
                 <small>${esc(t('{n} days', { n: cost.days }))} · ${esc(t('{n} weekday', { n: cost.weekdays }))} · ${esc(t('{n} weekend', { n: cost.weekendDays }))}</small>`
              : `<small class="muted-light">${esc(t('Pick a window to preview the cost.'))}</small>`}
          </div>
          <button type="submit" class="btn btn-large" ${state.busy.postRequest ? 'disabled' : ''}>${esc(state.busy.postRequest ? t('Posting…') : t('Post bounty'))}</button>
        </div>
      </form>
    </div>
  `;
}

/* Wall of Fame */
function renderWofTab() {
  if (state.leaderboardLoading && !state.leaderboard) {
    return `<div class="loading"><span class="loading-doubloon">${SVG.doubloon}</span>${esc(t("Reading the ship's logs…"))}</div>`;
  }
  const lb = state.leaderboard;
  if (!lb || lb.entries.length === 0) {
    return `
      <div class="empty-card">
        <div class="empty-mascot">${SVG.turtle}</div>
        <p><strong>${esc(t('No covers yet.'))}</strong></p>
        <p class="muted">${esc(t('The wall fills as crewmates earn doubloons by covering each other.'))}</p>
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
      <span>${esc(t('Top covers in the last {n} days', { n: lb.windowDays }))} · ${esc(t('refreshed {when}', { when: timeAgo(new Date(lb.generatedAtMs)) }))}</span>
      <button class="btn-ghost" data-action="refresh-wof" ${state.leaderboardLoading ? 'disabled' : ''}>${esc(state.leaderboardLoading ? t('Refreshing…') : '↻ ' + t('Refresh'))}</button>
    </div>

    <div class="wof-podium">
      ${podiumOrder.map((p) => `
        <div class="podium-place ${podiumClass(p)}">
          <div class="podium-emoji">${podiumEmoji(p)}</div>
          <div class="podium-rank">${p === top3[0] ? '#1' : p === top3[1] ? '#2' : '#3'}</div>
          ${p.photoURL
            ? `<img class="podium-avatar" src="${esc(p.photoURL)}" alt="" referrerpolicy="no-referrer" />`
            : `<div class="podium-avatar-fallback">${esc(initials(p.displayName))}</div>`}
          <div class="podium-name">${esc(shortName(p.displayName))}${p.displayName === meName ? ` (${t('you')})` : ''}</div>
          <div class="podium-score">${SVG.doubloon}${p.earnedInWindow}</div>
          <div class="podium-voyages">${esc(t('{n} voyages', { n: p.voyages }))}</div>
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
            <div class="wof-name">${esc(shortName(entry.displayName))}${entry.displayName === meName ? ` (${t('you')})` : ''}<br><small>${esc(t('{n} voyages', { n: entry.voyages }))}</small></div>
            <span class="wof-score">${SVG.doubloon}${entry.earnedInWindow}</span>
            ${entry.uid !== state.user?.uid
              ? `<button class="tip-hat" data-action="tip-hat" data-to-uid="${esc(entry.uid)}" data-to-name="${esc(entry.displayName)}">🪶 ${esc(t('Tip hat'))}</button>`
              : ''}
          </li>
        `).join('')}
      </ul>
    ` : ''}

    ${renderTavern()}
  `;
}

function renderMembersTab() {
  if (state.crewMembersLoading && state.crewMembers.length === 0) {
    return `<div class="loading"><span class="loading-doubloon">${SVG.doubloon}</span>${esc(t('Mustering the crew…'))}</div>`;
  }
  const members = state.crewMembers;
  if (members.length === 0) {
    return `<div class="empty-card"><p><strong>${esc(t('Empty roster.'))}</strong></p><p class="muted">${esc(t('Should never see this — refresh.'))}</p></div>`;
  }
  return `
    <section>
      <div class="wof-meta">
        <span>${esc(t('{n} crewmates aboard', { n: members.length }))}</span>
        <button class="btn-ghost" data-action="refresh-members">↻ ${esc(t('Refresh'))}</button>
      </div>
      <ul class="member-list">
        ${members.map((m) => {
          const isMe = m.uid === state.user?.uid;
          const rank = computeRank({ lifetimeEarned: m.lifetimeEarned, voyages: m.voyages, weekendCovers: 0, bountiesPosted: 0, stipendExpired: 0, crewCount: 1 });
          const avatarHtml = m.avatarId && SVG.avatars[m.avatarId]
            ? `<span class="avatar-img" style="width:48px;height:48px;display:inline-block;">${SVG.avatars[m.avatarId]}</span>`
            : m.photoURL
              ? `<img class="avatar-img" src="${esc(m.photoURL)}" alt="" referrerpolicy="no-referrer" style="width:48px;height:48px;" />`
              : `<span class="avatar-img avatar-fallback" style="width:48px;height:48px;display:inline-flex;align-items:center;justify-content:center;background:var(--parchment-dim);color:var(--ink-pure);font-family:'Inter',system-ui,sans-serif;font-weight:700;font-size:14px;">${esc(initials(m.displayName))}</span>`;
          return `
            <li class="member-card ${isMe ? 'me' : ''}">
              ${avatarHtml}
              <div class="member-main">
                <strong>${esc(m.displayName)}${isMe ? ` (${t('you')})` : ''}</strong>
                <small>${spriteIcon(rank.sprite)} ${esc(t(rank.name))} · ${esc(t('{n} voyages', { n: m.voyages }))}</small>
              </div>
              ${m.role === 'manager' ? `<span class="role-badge manager">${esc(t('Manager'))}</span>` : `<span class="role-badge member">${esc(t('Member'))}</span>`}
              <div class="member-stats">
                <span class="member-stat">${SVG.doubloon}<strong>${m.earnedLast90d}</strong></span>
                <small>${esc(t('90d earned'))}</small>
              </div>
              ${state.myRole === 'manager' ? `<button class="kebab" data-action="member-admin" data-uid="${esc(m.uid)}" title="${esc(t('Admin actions'))}" aria-label="${esc(t('Admin actions for {name}', { name: m.displayName || t('a crewmate') }))}" aria-haspopup="dialog"><span aria-hidden="true">⋯</span></button>` : ''}
            </li>
          `;
        }).join('')}
      </ul>
    </section>
  `;
}

function renderSettingsTab() {
  if (state.myRole !== 'manager') {
    return `
      <div class="empty-card">
        <div class="empty-mascot">${SVG.turtle}</div>
        <p><strong>${esc(t("Captain's quarters."))}</strong></p>
        <p class="muted">${esc(t('Only the crew manager can edit settings.'))}</p>
      </div>
    `;
  }
  if (state.crewSettingsLoading && !state.crewSettings) {
    return `<div class="loading"><span class="loading-doubloon">${SVG.doubloon}</span>${esc(t('Loading crew settings…'))}</div>`;
  }
  const s = state.crewSettings || { hasGeminiKey: false, geminiKeyLast4: null, geminiKeySetAtMs: null };
  const inputId = 'gemini-key-' + Math.random().toString(36).slice(2, 8);
  return `
    <div class="panel">
      <div class="panel-title">${esc(t('Crew settings'))}</div>
      <p class="muted" style="margin: 0 0 var(--sp-3); font-size: var(--fs-meta);">
        ${esc(t('Only managers can change these settings. Secret keys are stored server-side and never returned to the browser — only metadata (last 4 characters, set date).'))}
      </p>

      <div class="setting-row">
        <div class="setting-info">
          <strong>${esc(t('Gemini API key'))}</strong>
          <p class="muted" style="margin: 4px 0 0; font-size: var(--fs-meta);">
            ${t('Powers the AI briefing on bounties. Get one at {link}.', { link: '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>' })}
          </p>
          ${s.hasGeminiKey ? `
            <p class="setting-status" style="margin: 8px 0 0;">
              <span class="status-badge status-active">${esc(t('Configured'))}</span>
              ${esc(t('ends in'))} <code>${esc(s.geminiKeyLast4 ?? '????')}</code>
              ${s.geminiKeySetAtMs ? ` · ${esc(t('set {when}', { when: timeAgo(new Date(s.geminiKeySetAtMs)) }))}` : ''}
            </p>
          ` : `
            <p class="setting-status" style="margin: 8px 0 0;">
              <span class="status-badge status-cancelled">${esc(t('Not set'))}</span>
            </p>
          `}
        </div>
      </div>

      <div style="margin-top: var(--sp-3);">
        <label>
          <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;">${esc(s.hasGeminiKey ? t('Replace the key') : t('Set the key'))}</span>
          <input type="password" id="${inputId}" placeholder="AIza..." autocomplete="off" />
        </label>
        <div style="display: flex; gap: var(--sp-2); margin-top: var(--sp-3); flex-wrap: wrap;">
          <button class="btn" data-action="save-gemini" data-input-id="${inputId}">${esc(t('Save key'))}</button>
          ${s.hasGeminiKey ? `<button class="btn btn-danger" data-action="clear-gemini">${esc(t('Clear key'))}</button>` : ''}
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: var(--sp-4);">
      <div class="panel-title">${esc(t('Crew identity'))}</div>
      <p class="muted" style="margin: 0 0 var(--sp-2); font-size: var(--fs-meta);">${esc(t('Rename the crew or set its photo.'))}</p>
      <button class="btn btn-secondary" data-action="manage-crew">✏ ${esc(t('Manage crew'))}</button>
    </div>

    <div class="panel" style="margin-top: var(--sp-4);">
      <div class="panel-title">${esc(t('Backfill onboarding grant'))}</div>
      <p class="muted" style="font-size: var(--fs-meta); margin-bottom: var(--sp-2);">
        ${esc(t("The starter chest used to be 20 doubloons; it's now 125 (covers 25 business days). Top up any existing crewmate who got the old grant so everyone starts on the new floor."))}
      </p>
      <button class="btn btn-secondary" data-action="topup-grant">💰 ${esc(t('Top up to 125'))}</button>
    </div>

    <div class="panel" style="margin-top: var(--sp-4);">
      <div class="panel-title">${esc(t('Audit log · last 50 actions'))}</div>
      <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
        <button class="btn-ghost" data-action="refresh-audit">${esc(state.auditLogLoading ? t('Refreshing…') : '↻ ' + t('Refresh'))}</button>
      </div>
      ${state.auditLog.length === 0 ? `
        <p class="muted" style="font-size: var(--fs-meta);">${esc(t('No admin actions recorded yet.'))}</p>
      ` : `
        <ul class="audit-list">
          ${state.auditLog.map((a) => {
            const icon = ({
              cancelBounty: '🗑',
              updateTeam: '✏',
              updateCrewSettings: '⚙',
              topUpOnboardingGrant: '💰',
              updateBountyDetails: '✏',
              updateMemberRole: '👑',
              removeMember: '⛔',
              grantBonusDoubloons: '💸',
              forceCompleteBounty: '🏁',
            })[a.action] || '📜';
            const text = ({
              cancelBounty: t('cancelled a bounty'),
              updateTeam: t('updated crew name / photo'),
              updateCrewSettings: t('changed crew settings'),
              topUpOnboardingGrant: t('topped up the onboarding grant'),
              updateBountyDetails: t('edited a bounty'),
              updateMemberRole: t('made {name} a {role}', { name: a.targetName || t('a crewmate'), role: a.details?.to === 'manager' ? t('manager') : t('member') }),
              removeMember: t('removed {name}', { name: a.targetName || t('a crewmate') }),
              grantBonusDoubloons: t('granted {n} doubloons to {name}', { n: a.details?.amount || '', name: a.targetName || t('a crewmate') }),
              forceCompleteBounty: a.details?.coinsReleased
                ? t('force-completed a bounty (released {n} doubloons over {d} days)', { n: a.details.coinsReleased, d: a.details.daysReleased })
                : t('force-completed a bounty'),
              createInviteToken: t('created a fresh invite link'),
              memberLeftViaAccountDeletion: t('left the crew (account deletion)'),
            })[a.action] || a.action;
            const reason = a.details?.reason ? ` · "${esc(a.details.reason)}"` : '';
            return `
              <li class="audit-entry">
                <span class="audit-icon">${icon}</span>
                <div class="audit-body">
                  <span><strong>${esc(shortName(a.actorName))}</strong> ${esc(text)}${reason}</span>
                  <small class="audit-time">${esc(timeAgo(new Date(a.createdAtMs)))}</small>
                </div>
              </li>
            `;
          }).join('')}
        </ul>
      `}
    </div>

    <div class="panel danger-zone" style="margin-top: var(--sp-4);">
      <div class="panel-title">${esc(t('Danger zone'))}</div>
      <div class="setting-row">
        <div class="setting-info">
          <strong>${esc(t('Disband crew'))}</strong>
          <p class="muted" style="margin: 4px 0 0; font-size: var(--fs-meta);">
            ${esc(t('Permanently deletes this crew and everything in it — bounties, wallets, ledger, scrolls, audit log. Blocked while bounties are open or active.'))}
          </p>
        </div>
        <button class="btn btn-danger" data-action="disband-crew">${esc(t('Disband…'))}</button>
      </div>
    </div>
  `;
}

function renderTavern() {
  const scrolls = state.scrolls || [];
  return `
    <section class="tavern">
      <h2>${esc(t('The Tavern · recent scrolls'))}</h2>
      <div class="tavern-meta">${esc(t('Peer recognition, decoupled from doubloons. Hand someone a tip of the hat for a good cover.'))}</div>
      ${scrolls.length === 0 ? `
        <div class="empty-card" style="padding: 24px;">
          <p><strong>${esc(t('The tavern is quiet.'))}</strong></p>
          <p class="muted">${esc(t('Send the first scroll to a crewmate who covered you well.'))}</p>
        </div>
      ` : `
        <ul class="scrolls">
          ${scrolls.map((s) => {
            const reactions = s.reactions || {};
            const counts = {};
            let myReact = null;
            for (const [reactUid, emo] of Object.entries(reactions)) {
              counts[emo] = (counts[emo] || 0) + 1;
              if (reactUid === state.user?.uid) myReact = emo;
            }
            const reactionBar = ['🪙','🍻','🏴‍☠️','⚓','🦜'].map((emo) => {
              const cnt = counts[emo] || 0;
              const mine = myReact === emo;
              return `<button class="react-btn ${mine ? 'mine' : ''}" data-action="react-scroll" data-scroll-id="${esc(s.id)}" data-emoji="${esc(emo)}" data-mine="${mine ? '1' : '0'}" aria-pressed="${mine ? 'true' : 'false'}" aria-label="${esc(t('React with {emoji}', { emoji: emo }))}${cnt > 0 ? `, ${cnt}` : ''}"><span aria-hidden="true">${emo}</span>${cnt > 0 ? ` <span class="react-count" aria-hidden="true">${cnt}</span>` : ''}</button>`;
            }).join('');
            return `
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
                <div class="react-bar">${reactionBar}</div>
              </li>
            `;
          }).join('')}
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
  } else if (action === 'crew-claim') {
    e.preventDefault();
    e.stopPropagation();
    startCrewClaim(t.dataset.id);
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
    // No preventDefault — the Profile sheet renders this as a checkbox and
    // the click must keep its native toggle.
    audio.toggle();
  } else if (action === 'refresh-wof') {
    e.preventDefault();
    refreshLeaderboard();
  } else if (action === 'tip-hat') {
    e.preventDefault();
    e.stopPropagation();
    showSendScrollModal(t.dataset.toUid, t.dataset.toName, null);
  } else if (action === 'open-skin-picker') {
    e.preventDefault();
    showSkinPicker();
  } else if (action === 'pick-skin') {
    e.preventDefault();
    skin.set(t.dataset.id);
    document.querySelectorAll('.skin-card').forEach((el) => el.classList.toggle('selected', el === t));
    showToast(t('Skin applied.'), 'success', 2500);
    render();
  } else if (action === 'pick-avatar-open') {
    e.preventDefault();
    showAvatarPicker();
  } else if (action === 'pick-avatar') {
    e.preventDefault();
    setAvatar(t.dataset.id);
    document.querySelectorAll('.avatar-tile').forEach((el) => el.classList.toggle('selected', el === t));
  } else if (action === 'clear-avatar') {
    e.preventDefault();
    setAvatar(null);
    document.querySelectorAll('.avatar-tile').forEach((el) => el.classList.remove('selected'));
  } else if (action === 'toggle-digest') {
    // Don't preventDefault — the checkbox should toggle visually.
    setDigestEnabled(t.checked);
  } else if (action === 'manage-crew') {
    e.preventDefault();
    const team = state.myTeams.find((t) => t.id === state.teamId);
    if (team) showManageCrewModal(team);
  } else if (action === 'save-gemini') {
    e.preventDefault();
    const input = document.getElementById(t.dataset.inputId);
    const key = input?.value?.trim() ?? '';
    if (!key) { showToast(t('Paste an API key first.'), 'error'); return; }
    if (key.length < 8) { showToast(t('Key looks too short. Double-check.'), 'error'); return; }
    saveCrewSettings({ geminiApiKey: key });
    if (input) input.value = '';
  } else if (action === 'toggle-day') {
    e.preventDefault();
    const key = t.dataset.dayKey;
    const idx = state.formState.selectedDayKeys.indexOf(key);
    if (idx >= 0) state.formState.selectedDayKeys.splice(idx, 1);
    else state.formState.selectedDayKeys.push(key);
    render();
  } else if (action === 'select-weekdays') {
    e.preventDefault();
    const start = parseLocalDate(state.formState.startDate);
    const end = parseLocalDate(state.formState.endDate);
    const all = allDayKeysInRange(start, end);
    state.formState.selectedDayKeys = all.filter((k) => {
      const dow = parseDateKey(k).getUTCDay();
      return dow !== 0 && dow !== 6;
    });
    render();
  } else if (action === 'select-all-days') {
    e.preventDefault();
    const start = parseLocalDate(state.formState.startDate);
    const end = parseLocalDate(state.formState.endDate);
    state.formState.selectedDayKeys = allDayKeysInRange(start, end);
    render();
  } else if (action === 'connect-calendar') {
    e.preventDefault();
    connectCalendarAction();
  } else if (action === 'refresh-cal') {
    e.preventDefault();
    refreshCalendarEvents();
  } else if (action === 'add-meetings') {
    e.preventDefault();
    addAllBountyMeetings(t.dataset.bountyId);
  } else if (action === 'clear-search') {
    e.preventDefault();
    state.bountyFilterText = '';
    render();
  } else if (action === 'toggle-density') {
    e.preventDefault();
    state.density = state.density === 'compact' ? 'comfortable' : 'compact';
    localStorage.setItem('vacaciones.density', state.density);
    render();
  } else if (action === 'replay-cine') {
    e.preventDefault();
    showRankCinematic(computeRank(computeStats()));
  } else if (action === 'dismiss-how') {
    e.preventDefault();
    localStorage.setItem('vacaciones.howDismissed', '1');
    render();
  } else if (action === 'preset-next-week') {
    e.preventDefault();
    applyNextWeekPreset();
  } else if (action === 'export-data') {
    e.preventDefault();
    exportMyDataAction();
  } else if (action === 'delete-account') {
    e.preventDefault();
    showDeleteAccountModal();
  } else if (action === 'disband-crew') {
    e.preventDefault();
    const team = state.myTeams.find((t) => t.id === state.teamId);
    if (team) showDisbandCrewModal(team);
  } else if (action === 'refresh-members') {
    e.preventDefault();
    refreshCrewMembers();
  } else if (action === 'topup-grant') {
    e.preventDefault();
    topUpGrantAction();
  } else if (action === 'refresh-audit') {
    e.preventDefault();
    refreshAuditLog();
  } else if (action === 'member-admin') {
    e.preventDefault();
    const m = state.crewMembers.find((x) => x.uid === t.dataset.uid);
    if (m) showMemberAdminModal(m);
  } else if (action === 'adm-bonus') {
    e.preventDefault();
    showSendBonus(t.dataset.uid, t.dataset.name);
  } else if (action === 'adm-promote') {
    e.preventDefault();
    showModal({
      title: tr('Promote to manager?'),
      body: `<p>${tr("This will give <strong>{name}</strong> manager rights — they'll be able to edit the crew, cancel bounties, grant bonuses, change roles.", { name: esc(t.dataset.name) })}</p>`,
      primaryLabel: tr('Promote to manager'),
      secondaryLabel: tr('Cancel'),
      onPrimary: () => changeMemberRole(t.dataset.uid, 'manager', t.dataset.name),
    });
  } else if (action === 'adm-demote') {
    e.preventDefault();
    showModal({
      title: tr('Demote to member?'),
      body: `<p>${tr('This will remove manager rights from <strong>{name}</strong>.', { name: esc(t.dataset.name) })}</p>`,
      primaryLabel: tr('Demote to member'),
      secondaryLabel: tr('Cancel'),
      onPrimary: () => changeMemberRole(t.dataset.uid, 'member', t.dataset.name),
    });
  } else if (action === 'adm-remove') {
    e.preventDefault();
    showModal({
      title: tr('Remove from crew?'),
      body: `<p>${tr('This will remove <strong>{name}</strong> from the crew. They can be re-invited, but their wallet for this crew is sealed.', { name: esc(t.dataset.name) })}</p>`,
      primaryLabel: tr('Remove from crew'),
      secondaryLabel: tr('Cancel'),
      onPrimary: () => removeMemberAction(t.dataset.uid, t.dataset.name),
    });
  } else if (action === 'force-complete') {
    e.preventDefault();
    showModal({
      title: tr('Force complete bounty?'),
      body: `<p>${tr("This marks the bounty as completed immediately. Any unreleased doubloons for the covered days are paid out to the coverer(s) right now, then the harbour fee is burned. Use when the regular daily release can't finish on its own.")}</p>`,
      primaryLabel: tr('Force complete'),
      secondaryLabel: tr('Cancel'),
      onPrimary: () => forceCompleteAction(t.dataset.bountyId),
    });
  } else if (action === 'export-csv') {
    e.preventDefault();
    exportLedgerCsv();
  } else if (action === 'gen-briefing') {
    e.preventDefault();
    generateBriefingAction(t.dataset.bountyId);
  } else if (action === 'edit-bounty') {
    e.preventDefault();
    showEditBountyModal(t.dataset.bountyId);
  } else if (action === 'react-scroll') {
    e.preventDefault();
    e.stopPropagation();
    const mine = t.dataset.mine === '1';
    reactToScrollAction(t.dataset.scrollId, mine ? null : t.dataset.emoji);
  } else if (action === 'clear-gemini') {
    e.preventDefault();
    showModal({
      title: tr('Clear Gemini key?'),
      body: `<p>${tr('The crew will lose access to AI-powered features until you set a new key.')}</p>`,
      primaryLabel: tr('Clear key'),
      secondaryLabel: tr('Keep it'),
      onPrimary: () => saveCrewSettings({ geminiApiKey: null }),
    });
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
  if (e.target.id === 'bounty-search') {
    state.bountyFilterText = e.target.value;
    clearTimeout(window._bountySearchTimer);
    window._bountySearchTimer = setTimeout(render, 200);
  }
});
document.addEventListener('change', (e) => {
  const form = e.target.closest('#create-form');
  if (form) syncFormStateFromDom(form);
  if (e.target.matches?.('[data-action="set-lang"]')) {
    lang.set(e.target.value);
    render();
    renderUserInfo();
    // Re-open the profile sheet in the new language so the change is
    // visible where it was made.
    closeAllModals();
    showAvatarPicker();
  }
});

function syncFormStateFromDom(form) {
  const data = new FormData(form);
  const f = state.formState;
  const prevStart = f.startDate;
  const prevEnd = f.endDate;
  f.startDate = data.get('startDate') || '';
  f.endDate = data.get('endDate') || '';
  const datesChanged = f.startDate !== prevStart || f.endDate !== prevEnd;
  // When dates change, reset selectedDayKeys so the day picker rebuilds
  if (datesChanged) {
    const start = parseLocalDate(f.startDate);
    const end = parseLocalDate(f.endDate);
    f.selectedDayKeys = allDayKeysInRange(start, end);
  }
  f.timezone = (data.get('timezone') || '').trim();
  f.sla = (data.get('sla') || '').trim();
  f.emergencyDef = (data.get('emergencyDef') || '').trim();
  f.coverageScope = (data.get('coverageScope') || '').trim();
  f.reachability = data.getAll('reachability');
  f.coverageKinds = data.getAll('coverageKinds');
  f.coverageMode = data.get('coverageMode') || 'single';
  // Sync meeting selections from DOM
  const selectedIds = new Set(data.getAll('meeting'));
  f.meetings = state.calendarEvents.filter((m) => selectedIds.has(m.googleEventId));
  // Auto-fetch when dates change and calendar is connected
  if (datesChanged && calendar.isConnected() && f.startDate && f.endDate) {
    clearTimeout(syncFormStateFromDom._calTimer);
    syncFormStateFromDom._calTimer = setTimeout(() => refreshCalendarEvents(), 400);
  }
  // Surgical re-render of the day picker + meetings picker on date change —
  // a full render() would lose date-input focus mid-keystroke on Safari.
  if (datesChanged) {
    const dayHost = document.getElementById('day-picker-host');
    if (dayHost) {
      const old = dayHost.querySelector('.meetings-picker');
      if (old) old.outerHTML = renderDayPicker();
    }
    const meetingHost = document.getElementById('meetings-picker-host');
    if (meetingHost) {
      const old = meetingHost.querySelector('.meetings-picker');
      if (old) old.outerHTML = renderMeetingsPicker();
    }
  }
  const previewEl = document.querySelector('.preview');
  if (previewEl) {
    const cost = computeCurrentPostCost();
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
  // Enter / Space on a focused bounty card opens its detail.
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.matches?.('.bounty[data-bounty-id][role="button"]')) {
    e.preventDefault();
    showBountyDetail(document.activeElement.dataset.bountyId);
  }
  // Enter / Space on a focused day-card toggles it.
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.matches?.('.day-card[data-day-key][role="button"]')) {
    e.preventDefault();
    document.activeElement.click();
  }
});

render();
