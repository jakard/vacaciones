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
  ONBOARDING_GRANT: 125,
  MONTHLY_STIPEND: 11,
  COVERAGE_PRICE_PER_DAY: 5,
  WEEKEND_MULTIPLIER: 2,
  TRANSACTION_FEE: 1,
  DEFAULT_ANNUAL_PTO_DAYS: 25,
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
  { speech: "Yer starter chest holds 125 doubloons — 25 business days of leave from the jump. Spend wisely." },
  { speech: "Every month the Crown drops 11 more stipend coins in yer purse — that's the year-after-year budget. Use 'em or watch 'em vanish at month's end." },
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

/* ============================================================
   Sound module (Web Audio chiptune SFX)
   ============================================================ */

const SKIN_OPTIONS = [
  { id: 'pirate', label: 'Pirate (Monkey Island)', desc: 'Pixel-art parchment + Inter. Pirate vibe, regular legible font.' },
  { id: 'basic', label: 'Basic', desc: 'Clean modern. Inter font, soft shadows, rounded corners.' },
  { id: 'hc', label: 'High Contrast', desc: 'Atkinson Hyperlegible, black/white/yellow. Maximum legibility.' },
];

const skin = {
  current() { return localStorage.getItem('vacaciones.skin') || 'pirate'; },
  set(id) {
    if (!SKIN_OPTIONS.some((s) => s.id === id)) return;
    localStorage.setItem('vacaciones.skin', id);
    document.documentElement.dataset.skin = id;
  },
};
skin.set(skin.current());

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
    return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}–${e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `${s.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} → ${e.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`;
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
      showToast(`Could not register your sailor card: ${err.message}`, 'error', 5000);
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
    showToast(`Crew "${name}" formed. 125 doubloons in your chest.`, 'success');
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
    else { showToast('Signed aboard! 125 doubloons in your chest.', 'success'); audio.coin(); }
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
    const selectedDayKeys = f.selectedDayKeys.length > 0 ? f.selectedDayKeys : allDayKeysInRange(start, end);
    if (selectedDayKeys.length === 0) {
      showToast('Pick at least one day to be covered.', 'error');
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
    showToast(`Bounty posted for ${result.data.coinsOffered} doubloons. Anchors aweigh!`, 'success');
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
      <p style="margin: 0 0 8px;">Pick the days you can cover. Unclaimed days are tappable.</p>
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
            ? `<small>Taken</small>${dayCoverer?.displayName ? `<small style="font-size: 10px;">${esc(shortName(dayCoverer.displayName))}</small>` : ''}`
            : claimedByMe
              ? `<small>Yours</small>`
              : `<span class="day-cost">${isWeekend ? 10 : 5} <small>${SVG.doubloon}</small></span>`;
          return `
            <li class="${klass}" ${(claimedByOther || claimedByMe) ? '' : `data-action="claim-toggle-day" data-day-key="${esc(key)}"`}>
              <strong>${WEEKDAY_NAMES[dow]}</strong>
              <span class="day-date">${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}</span>
              ${inner}
            </li>
          `;
        }).join('')}
      </ul>
      <p style="margin: 12px 0 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;">
        <strong>${state.claim.selectedDayKeys.length} day${state.claim.selectedDayKeys.length === 1 ? '' : 's'}</strong> ·
        <strong style="color: var(--brass-deep);">${cost.totalCoins} doubloons</strong>
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
      <div class="modal-title">CLAIM YOUR DAYS</div>
      <div class="modal-body" id="crew-claim-body">${renderInner()}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="claim-cancel">Cancel</button>
        <button class="btn" data-action="claim-submit" ${state.claim.selectedDayKeys.length === 0 ? 'disabled' : ''}>
          Take ${state.claim.selectedDayKeys.length} day${state.claim.selectedDayKeys.length === 1 ? '' : 's'}
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
    showToast('Pirate avatar set.', 'success');
    audio.coin();
  } catch (err) {
    showToast(`Could not set avatar: ${err.message}`, 'error', 5000);
  }
}

async function cancelBountyAction(requestId) {
  try {
    const result = await callCancelBounty({ teamId: state.teamId, requestId });
    if (result.data.refunded > 0) {
      showToast(`Bounty cancelled. ${result.data.refunded} doubloons refunded.`, 'success');
    } else {
      showToast('Bounty cancelled.', 'success');
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
    showToast('Crew updated.', 'success');
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
    showToast(`Calendar: ${err.message}`, 'error', 6000);
  } finally {
    state.calendarLoading = false;
    render();
  }
}

async function connectCalendarAction() {
  try {
    await calendar.connect();
    showToast('Calendar connected.', 'success');
    audio.coin();
    refreshCalendarEvents();
  } catch (err) {
    showToast(`Could not connect calendar: ${err.message}`, 'error', 6000);
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
    description: `You're covering ${requesterName}'s shore leave through Vacaciones.\n\nBounty: ${location.origin}/#/team/${encodeURIComponent(state.teamId || '')}`,
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
    catch (err) { showToast(`Calendar connect failed: ${err.message}`, 'error'); return; }
  }
  const meetingsAlready = getAddedMeetingIds(bountyId);
  const meetingsToAdd = arr(b.meetings).filter((m) => !meetingsAlready.has(m.googleEventId));
  const markerKey = `vacaciones.addedMarker.${bountyId}`;
  const markerAlready = localStorage.getItem(markerKey) === '1';
  if (meetingsToAdd.length === 0 && markerAlready) {
    showToast('Everything already on your calendar.', 'info');
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
    showToast(`Added ${bits.join(' + ')} to your calendar.`, 'success');
    audio.coin();
  } else {
    showToast('Nothing new to add.', 'info');
  }
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

function showSkinPicker() {
  const current = skin.current();
  const body = `
    <p style="margin: 0 0 12px;">Pick a look. Persists across visits on this browser.</p>
    <div class="skin-picker-grid">
      ${SKIN_OPTIONS.map((s) => `
        <button class="skin-card ${s.id === current ? 'selected' : ''}" data-action="pick-skin" data-id="${esc(s.id)}">
          <div class="skin-preview skin-preview-${s.id}">${s.id === 'pirate' ? 'VACACIONES' : (s.id === 'basic' ? 'Vacaciones' : 'VACACIONES')}</div>
          <div class="skin-card-meta">
            <strong>${esc(s.label)}</strong>
            <small>${esc(s.desc)}</small>
          </div>
        </button>
      `).join('')}
    </div>
  `;
  showModal({
    title: 'CHOOSE A SKIN',
    body,
    wide: true,
    primaryLabel: 'Close',
  });
}

function showAvatarPicker() {
  const current = state.userDoc?.avatarId ?? null;
  const grid = AVATAR_LIST.map((id) => {
    const isMale = id.startsWith('m');
    const isSelected = id === current;
    return `<button class="avatar-tile ${isSelected ? 'selected' : ''}" data-action="pick-avatar" data-id="${id}" title="${isMale ? 'Male' : 'Female'} pirate">
      <span class="avatar-tile-art">${SVG.avatars[id]}</span>
      <span class="avatar-tile-label">${isMale ? 'M' : 'F'}${id.slice(1)}</span>
    </button>`;
  }).join('');
  const body = `
    <p style="margin: 0 0 12px;">Pick a pirate to wear as yer face. Ye can change it any time.</p>
    <div class="avatar-grid">${grid}</div>
    ${current ? `<p style="margin: 12px 0 0; text-align: right;"><button class="btn-ghost" data-action="clear-avatar">USE GOOGLE PHOTO</button></p>` : ''}
  `;
  showModal({
    title: 'CHOOSE YOUR PIRATE',
    body,
    wide: true,
    primaryLabel: 'Close',
  });
}

function showManageCrewModal(team) {
  const inputName = 'crew-name-' + Math.random().toString(36).slice(2, 8);
  const inputPhoto = 'crew-photo-' + Math.random().toString(36).slice(2, 8);
  const body = `
    <div class="form-grid">
      <label class="wide">
        <span>Crew name</span>
        <input id="${inputName}" type="text" value="${esc(team.name)}" maxlength="100" />
      </label>
      <label class="wide">
        <span>Crew photo URL (optional)</span>
        <input id="${inputPhoto}" type="text" value="${esc(team.photoURL ?? '')}" placeholder="https://…" />
      </label>
    </div>
    <p class="muted" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 16px; margin: 8px 0 0;">Paste a square image URL. Leave blank to use the default flag.</p>
  `;
  showModal({
    title: 'MANAGE CREW',
    body,
    wide: true,
    primaryLabel: 'Save',
    secondaryLabel: 'Cancel',
    onPrimary: () => {
      const n = document.getElementById(inputName)?.value.trim() ?? '';
      const p = document.getElementById(inputPhoto)?.value.trim() ?? '';
      if (!n) {
        showToast('Crew name cannot be empty.', 'error');
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
    ? `Cancel this bounty? <strong>${remaining} doubloons</strong> will be refunded to the requester.`
    : 'Cancel this bounty? Nothing to refund.';
  showModal({
    title: 'CANCEL BOUNTY?',
    body: `<p>${message}</p>`,
    primaryLabel: 'Aye, cancel',
    secondaryLabel: 'Nevermind',
    onPrimary: () => cancelBountyAction(bountyId),
  });
}

function exportLedgerCsv() {
  const entries = state.ledger || [];
  if (entries.length === 0) {
    showToast('Nothing to export.', 'info');
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
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vacaciones-ledger-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showToast(`Exported ${entries.length} ledger entries.`, 'success');
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
      <span class="check-label">${r.icon} ${esc(r.short)}</span>
    </label>`;
  }).join('');
  const kindChecks = COVERAGE_KIND_OPTIONS.map((k) => {
    const checked = arr(b.coverageKinds).includes(k.value);
    return `<label class="check-pixel">
      <input type="checkbox" name="k-${k.value}" value="${k.value}" ${checked ? 'checked' : ''}/>
      <span class="check-box"></span>
      <span class="check-label">${k.icon} ${esc(k.label)}</span>
    </label>`;
  }).join('');
  const body = `
    <div class="form-grid">
      <label class="wide"><span>SLA</span><input id="${slaId}" type="text" value="${esc(b.sla || '')}" /></label>
      <label class="wide"><span>Coverage scope</span><input id="${scopeId}" type="text" value="${esc(b.coverageScope || '')}" /></label>
      <label class="wide"><span>Emergency definition</span><textarea id="${emergId}" rows="2">${esc(b.emergencyDef || '')}</textarea></label>
      <div class="wide">
        <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 8px; letter-spacing: 1px; text-transform: uppercase;">Reachability</span>
        <div class="check-group">${reachChecks}</div>
      </div>
      <div class="wide">
        <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 8px; letter-spacing: 1px; text-transform: uppercase;">Coverage kinds</span>
        <div class="check-group">${kindChecks}</div>
      </div>
    </div>
    <p class="muted" style="font-size: var(--fs-meta); margin: 8px 0 0;">Dates + selected days are locked to keep the escrow contract intact.</p>
  `;
  showModal({
    title: 'EDIT BOUNTY',
    body,
    wide: true,
    primaryLabel: 'Save',
    secondaryLabel: 'Cancel',
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
        showToast('Pick at least one reachability option.', 'error');
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
          showToast('Bounty updated.', 'success');
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

async function refreshCrewSettings() {
  if (!state.teamId || state.crewSettingsLoading) return;
  if (state.myRole !== 'manager') return;
  state.crewSettingsLoading = true; render();
  try {
    const result = await callGetCrewSettings({ teamId: state.teamId });
    state.crewSettings = result.data;
  } catch (err) {
    console.error('crew settings fetch failed', err);
    showToast(`Could not load settings: ${err.message}`, 'error', 5000);
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
    showToast(`Could not load audit log: ${err.message}`, 'error', 5000);
  } finally { state.auditLogLoading = false; render(); }
}

async function changeMemberRole(targetUid, role, displayName) {
  try {
    await callUpdateMemberRole({ teamId: state.teamId, targetUid, role });
    showToast(`${displayName} is now a ${role === 'manager' ? 'captain' : 'crewmate'}.`, 'success');
    audio.coin();
    refreshCrewMembers();
  } catch (err) { showToast(err.message, 'error', 6000); }
}

async function removeMemberAction(targetUid, displayName) {
  try {
    await callRemoveMember({ teamId: state.teamId, targetUid });
    showToast(`${displayName} was removed from the crew.`, 'success');
    refreshCrewMembers();
  } catch (err) { showToast(err.message, 'error', 6000); }
}

async function grantBonusAction(targetUid, amount, reason, displayName) {
  try {
    const result = await callGrantBonusDoubloons({ teamId: state.teamId, targetUid, amount, reason });
    showToast(`Sent ${result.data.amount} doubloons to ${displayName}.`, 'success');
    audio.coin();
    refreshCrewMembers();
  } catch (err) { showToast(err.message, 'error', 6000); }
}

async function forceCompleteAction(requestId) {
  try {
    await callForceCompleteBounty({ teamId: state.teamId, requestId });
    showToast('Bounty force-completed.', 'success');
    audio.rank();
  } catch (err) { showToast(err.message, 'error', 6000); }
}

function showGrantBonusModal(targetUid, displayName) {
  const amountId = 'bonus-amt-' + Math.random().toString(36).slice(2, 8);
  const reasonId = 'bonus-rsn-' + Math.random().toString(36).slice(2, 8);
  showModal({
    title: `GRANT BONUS TO ${esc((displayName || 'CREWMATE').toUpperCase())}`,
    body: `
      <div class="form-grid">
        <label class="wide">
          <span style="font-family: var(--font-body); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Amount (1–500)</span>
          <input id="${amountId}" type="number" min="1" max="500" value="20" />
        </label>
        <label class="wide">
          <span style="font-family: var(--font-body); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Reason (visible in audit log)</span>
          <textarea id="${reasonId}" rows="2" placeholder="e.g. Covered the Acme P1 escalation over the weekend."></textarea>
        </label>
      </div>
    `,
    wide: true,
    primaryLabel: 'Send doubloons',
    secondaryLabel: 'Cancel',
    onPrimary: () => {
      const amount = Number(document.getElementById(amountId)?.value || 0);
      const reason = (document.getElementById(reasonId)?.value || '').trim();
      if (!amount || amount < 1 || amount > 500) {
        showToast('Pick an amount between 1 and 500.', 'error'); return false;
      }
      if (reason.length < 3) {
        showToast('Add a short reason (audit trail).', 'error'); return false;
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
    title: `MANAGE ${esc((member.displayName || 'CREWMATE').toUpperCase())}`,
    body: `
      <p style="margin: 0 0 12px;">Pick an admin action for <strong>${esc(member.displayName || 'this crewmate')}</strong>.</p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${isMe ? `<p class="muted" style="font-size: var(--fs-meta);">Some actions disabled — that's you.</p>` : ''}
        <button class="btn btn-secondary" data-action="adm-bonus" data-uid="${esc(member.uid)}" data-name="${esc(member.displayName || '')}">💰 Grant bonus doubloons</button>
        ${targetRole === 'member'
          ? `<button class="btn btn-secondary" data-action="adm-promote" data-uid="${esc(member.uid)}" data-name="${esc(member.displayName || '')}">⬆ Promote to captain</button>`
          : `<button class="btn btn-secondary" data-action="adm-demote" data-uid="${esc(member.uid)}" data-name="${esc(member.displayName || '')}" ${isOwner ? 'disabled title="Owner cannot be demoted"' : ''}>⬇ Demote to crewmate</button>`
        }
        <button class="btn btn-danger" data-action="adm-remove" data-uid="${esc(member.uid)}" data-name="${esc(member.displayName || '')}" ${(isOwner || isMe) ? 'disabled title="Cannot remove owner / yourself"' : ''}>🗑 Remove from crew</button>
      </div>
    `,
    primaryLabel: 'Close',
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
    showToast(`Could not load the crew: ${err.message}`, 'error', 5000);
  } finally { state.crewMembersLoading = false; render(); }
}

async function topUpGrantAction() {
  showModal({
    title: 'TOP UP STARTER CHEST?',
    body: `<p>This will credit each crewmate who received the old 20-doubloon grant with the missing <strong>105 doubloons</strong> so everyone hits the new 125 starting balance. It runs once per crewmate (idempotent).</p>`,
    primaryLabel: 'Aye, top up',
    secondaryLabel: 'Cancel',
    onPrimary: async () => {
      try {
        const result = await callTopUpGrant({ teamId: state.teamId });
        if (result.data.toppedUpCount === 0) {
          showToast('Everyone is already at the new grant.', 'info');
        } else {
          showToast(`Topped up ${result.data.toppedUpCount} crewmate${result.data.toppedUpCount === 1 ? '' : 's'} (+${result.data.perUser} each).`, 'success');
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
    showToast('✨ Briefing generated.', 'success', 4000);
    audio.rank();
    // Reload bounty detail modal
    showBountyDetail(bountyId);
  } catch (err) {
    showToast(`Briefing failed: ${err.message}`, 'error', 7000);
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
    showToast('Crew settings saved.', 'success');
    await refreshCrewSettings();
  } catch (err) {
    showToast(err.message, 'error', 6000);
  }
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
        <span style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: var(--ink-faded); margin-left: 4px;">doubloons</span>
      </span>
    </div>

    <div class="bd-section">
      <h4>Requester</h4>
      <div style="display: flex; align-items: center; gap: 8px;">
        ${b.requesterPhotoURL ? `<img class="avatar-mini" src="${esc(b.requesterPhotoURL)}" alt="" referrerpolicy="no-referrer" style="width: 32px; height: 32px;" />` : ''}
        <span class="bd-value">${esc(b.requesterDisplayName || 'A crewmate')}${mine ? ' (you)' : ''}</span>
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
            <h4>Crew coverers (${coverers.length})</h4>
            <ul class="coverer-list">
              ${coverers.map((c) => {
                const mineDays = allKeys.filter((k) => dayCoverers[k]?.uid === c.uid);
                return `<li>
                  ${c.photoURL ? `<img class="avatar-mini" src="${esc(c.photoURL)}" alt="" referrerpolicy="no-referrer" style="width: 28px; height: 28px;" />` : ''}
                  <span>${esc(shortName(c.displayName || 'Crewmate'))}${c.uid === state.user?.uid ? ' (you)' : ''}</span>
                  <small>${mineDays.length} day${mineDays.length === 1 ? '' : 's'}</small>
                </li>`;
              }).join('')}
            </ul>
            ${(() => {
              const remaining = allKeys.filter((k) => !dayCoverers[k]).length;
              return remaining > 0 ? `<p class="muted" style="margin: 8px 0 0; font-size: var(--fs-meta);">${remaining} day${remaining === 1 ? '' : 's'} still open.</p>` : `<p class="muted" style="margin: 8px 0 0; font-size: var(--fs-meta);">All days claimed.</p>`;
            })()}
          </div>
        `;
      }
      if (b.covererUid) {
        return `
          <div class="bd-section">
            <h4>Covered by</h4>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${b.covererPhotoURL ? `<img class="avatar-mini" src="${esc(b.covererPhotoURL)}" alt="" referrerpolicy="no-referrer" style="width: 32px; height: 32px;" />` : ''}
              <span class="bd-value">${esc(b.covererDisplayName || 'A crewmate')}${b.covererUid === state.user?.uid ? ' (you)' : ''}</span>
            </div>
          </div>
        `;
      }
      return '';
    })()}

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

    ${b.aiBriefing ? `
      <div class="bd-section ai-briefing">
        <h4>✨ AI briefing</h4>
        <div class="ai-content">${esc(b.aiBriefing.content || '').replace(/\n/g, '<br>')}</div>
        <small class="muted" style="display: block; margin-top: 8px;">Generated by Gemini · ${esc(timeAgo(new Date(b.aiBriefing.generatedAtMs || 0)))}</small>
      </div>` : ''}
    ${mine && (b.status === 'open' || b.status === 'accepted' || b.status === 'active') ? `
      <div style="margin-top: var(--sp-3); display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" data-action="gen-briefing" data-bounty-id="${esc(b.id)}" ${state.briefingLoading ? 'disabled' : ''}>
          ${state.briefingLoading ? 'Generating…' : (b.aiBriefing ? '✨ Regenerate briefing' : '✨ Generate AI briefing')}
        </button>
        ${b.status === 'open' ? `<button class="btn btn-secondary" data-action="edit-bounty" data-bounty-id="${esc(b.id)}">✏ Edit details</button>` : ''}
      </div>
    ` : ''}

    ${arr(b.meetings).length > 0 ? `
      <div class="bd-section">
        <h4>Meetings to cover (${arr(b.meetings).length})</h4>
        <ul class="meeting-list bounty-meeting-list">
          ${arr(b.meetings).map((m) => `
            <li>
              <div class="meeting-info">
                <strong>${esc(m.summary)}</strong>
                <small>${esc(formatMeetingDate(m.startMs, m.endMs))}${m.attendees?.length ? ` · ${m.attendees.length} attendees` : ''}</small>
                <span class="meeting-links">
                  ${m.hangoutLink ? `<a href="${esc(m.hangoutLink)}" target="_blank" rel="noopener">📹 Meet</a>` : ''}
                  ${arr(m.conferenceLinks).map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener">🔗 ${esc(l.match(/teams|zoom|whereby/i)?.[0] || 'Link')}</a>`).join('')}
                  ${m.htmlLink ? `<a href="${esc(m.htmlLink)}" target="_blank" rel="noopener" class="cal-link">📅 In Calendar</a>` : ''}
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
            ? 'All added to your calendar'
            : !markerAdded && remaining === 0
              ? '📅 Add coverage marker to my calendar'
              : `📅 Add coverage marker${remaining > 0 ? ` + ${remaining} meeting${remaining === 1 ? '' : 's'}` : ''} to my calendar`;
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
      title: 'BOUNTY DETAIL',
      body,
      wide: true,
      primaryLabel: `Claim days (${remainingDays} left)`,
      secondaryLabel: 'Back',
      onPrimary: () => startCrewClaim(bountyId),
    });
  } else if (status === 'open' && !mine) {
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
    // Show Cancel option for requester or manager when bounty is still cancellable
    const canCancel = (mine || state.myRole === 'manager')
      && status !== 'cancelled'
      && status !== 'completed';
    const canForceComplete = state.myRole === 'manager'
      && (status === 'accepted' || status === 'active');
    // Append force-complete button into body for managers
    let bodyWithAdmin = body;
    if (canForceComplete) {
      bodyWithAdmin += `<div style="margin-top: 12px;"><button class="btn btn-danger" data-action="force-complete" data-bounty-id="${esc(bountyId)}">🏁 Force complete</button></div>`;
    }
    showModal({
      title: 'BOUNTY DETAIL',
      body: bodyWithAdmin,
      wide: true,
      primaryLabel: 'Close',
      secondaryLabel: canCancel ? '🗑 Cancel bounty' : undefined,
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
    <button class="sound-toggle" data-action="open-skin-picker" title="Theme">🎨</button>
    <button class="sound-toggle ${audio.enabled ? 'on' : ''}" data-action="sound" title="Sound effects">
      ${audio.enabled ? '🔊' : '🔇'}
    </button>
    <button class="avatar-slot" data-action="pick-avatar-open" title="Choose your pirate" aria-label="Choose your pirate">
      ${renderAvatar({ uid: u.uid, photoURL: u.photoURL, name: u.displayName, size: 32, klass: 'avatar-img' })}
    </button>
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
  else if (state.view === 'help') app.innerHTML = renderHelp();
  else app.innerHTML = '';
}

function renderHelp() {
  return `
    <nav class="breadcrumb">
      <a href="#/">Crews</a><span class="sep">/</span><span class="current">Help</span>
    </nav>
    <header class="team-header">
      <div><h1>HOW VACACIONES WORKS</h1></div>
    </header>
    <div class="panel">
      <div class="panel-title">The doubloon economy</div>
      <h3 style="margin-top: 12px;">🪙 Your purse, your starter chest, the Crown's stipend</h3>
      <p>Every crewmate starts with <strong>125 doubloons</strong> the first time they join a crew — enough to cover ~25 business days of leave right away. On top of that, the Crown drops <strong>11 doubloons</strong> every month into your stipend purse. Stipend coins expire at the end of each month, so spend 'em or lose 'em. Earned coins (the ones you got by covering crewmates) never expire.</p>
      <h3>📅 What a day of coverage costs</h3>
      <p>One day costs <strong>5 doubloons</strong> (Mon–Fri). Weekend days cost <strong>10</strong>. Holidays don't have special rates yet — they cost what their weekday says.</p>
      <h3>🏴‍☠️ Posting a bounty</h3>
      <p>Pick a date range, pick which days you actually want covered (toggle weekends off if you're not asking for them), set how reachable you'll be, what kinds of work need covering, and an SLA. Costs come straight from your wallet (stipend first, then earned). Single coverer mode is the default — one crewmate takes everything. Crew mode lets multiple crewmates split days; the bounty stays open until every day is claimed.</p>
      <h3>⚓ Taking a voyage</h3>
      <p>Browse the Bounty Board. Click any open bounty to see the full briefing. In crew mode you pick which days you can cover; in single mode you take the whole window. Doubloons release to you one day at a time as the days pass, paid out by a daily cron.</p>
      <h3>🏆 Voyage Rank + Wall of Fame</h3>
      <p>Your rank (Cabin Boy → Commodore) is based on lifetime coins earned by covering. The Wall of Fame ranks crewmates by what they earned in the last 90 days, so old salts can't sit on their laurels.</p>
      <h3>🪶 Thank-You Scrolls</h3>
      <p>Recognition that isn't tied to coins. Send a scroll to a crewmate who covered you well, or tip your hat to anyone on the Wall of Fame.</p>
      <h3>📅 Google Calendar</h3>
      <p>Optional. Connect Calendar in the post form to pick which meetings the coverer should attend. When you accept a bounty you can add a coverage marker + the meetings to your own Calendar with one click.</p>
      <h3>🤖 Gemini briefing (manager-configured)</h3>
      <p>If your crew has a Gemini API key in Settings, the requester can hit "✨ Generate briefing" on their bounty and Gemini will draft a structured briefing (orientation, accounts, what to do, emergency protocol, open questions). The coverer reads it inside the bounty detail.</p>
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
                ${t.photoURL
                  ? `<img class="team-flag" src="${esc(t.photoURL)}" alt="" referrerpolicy="no-referrer" />`
                  : `<span class="team-flag">${SVG.flag}</span>`}
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
        <p class="muted" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 18px; margin: 0 0 12px;">You become the quartermaster. Every crewmate starts with 125 doubloons — enough to cover 25 business days right away.</p>
        <div class="row">
          <input id="new-team-name" type="text" placeholder="Crew name" maxlength="100" ${state.busy.createTeam ? 'disabled' : ''} />
          <button class="btn" data-action="create-team" ${state.busy.createTeam ? 'disabled' : ''}>${state.busy.createTeam ? 'Forming…' : 'Hoist'}</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">Sign on with a crew</div>
        <p class="muted" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 18px; margin: 0 0 12px;">Paste the crew ID (or invite link) a teammate shared.</p>
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
  else if (tab === 'settings') body = renderSettingsTab();
  else if (tab === 'members') body = renderMembersTab();
  else body = renderBountyBoardTab();

  return `
    <nav class="breadcrumb">
      <a href="#/">Crews</a><span class="sep">/</span><span class="current">${esc(team.name)}</span>
    </nav>
    <header class="team-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${team.photoURL
          ? `<img src="${esc(team.photoURL)}" alt="" referrerpolicy="no-referrer" style="width: 48px; height: 48px; box-shadow: 0 0 0 2px var(--wood-dark); image-rendering: pixelated;" />`
          : `<span style="width: 48px; height: 48px; display: inline-block;">${SVG.flag}</span>`}
        <div>
          <h1>${esc(team.name).toUpperCase()}</h1>
          <small>${team.memberUids?.length || 0} crewmate${team.memberUids?.length === 1 ? '' : 's'} · ID: <code>${esc(team.id)}</code></small>
        </div>
      </div>
      <div class="invite-actions">
        ${state.myRole === 'manager' ? `<button class="btn-ghost" data-action="manage-crew">✏ MANAGE</button>` : ''}
        <button class="btn-ghost" data-action="copy-invite" data-id="${esc(team.id)}">🔗 SHARE INVITE</button>
      </div>
    </header>
    <nav class="tabs">
      <a href="#/team/${esc(team.id)}" class="tab ${tab === 'bounties' ? 'active' : ''}">Bounty Board ${openCount > 0 ? `<span class="tab-count">${openCount}</span>` : ''}</a>
      <a href="#/team/${esc(team.id)}/chest" class="tab ${tab === 'chest' ? 'active' : ''}">Treasure Chest</a>
      <a href="#/team/${esc(team.id)}/wof" class="tab ${tab === 'wof' ? 'active' : ''}">Wall of Fame</a>
      <a href="#/team/${esc(team.id)}/members" class="tab ${tab === 'members' ? 'active' : ''}">Crew</a>
      <a href="#/team/${esc(team.id)}/post" class="tab ${tab === 'post' ? 'active' : ''}">Post Bounty</a>
      ${state.myRole === 'manager' ? `<a href="#/team/${esc(team.id)}/settings" class="tab ${tab === 'settings' ? 'active' : ''}">⚙ Settings</a>` : ''}
    </nav>
    ${body}
  `;
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
    <section>
      <div class="filter-row">
        ${renderFilter('all', `All · ${counts.all}`)}
        ${renderFilter('open', `Open · ${counts.open}`)}
        ${renderFilter('taken', `Taken · ${counts.taken}`)}
        ${renderFilter('done', `Done · ${counts.done}`)}
        ${renderFilter('mine', `Mine · ${counts.mine}`)}
      </div>
      <div class="search-row">
        <input id="bounty-search" type="text" placeholder="🔍 Search requester, scope, SLA…" value="${esc(state.bountyFilterText)}" />
        ${state.bountyFilterText ? `<button class="btn-ghost" data-action="clear-search">Clear</button>` : ''}
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
  const accepting = state.busy.acceptId === b.id;
  const days = Math.max(1, Math.round(((b.windowEnd?.toDate?.() ?? new Date()) - (b.windowStart?.toDate?.() ?? new Date())) / 86400000) + 1);
  const reaches = arr(b.reachability).map((r) => REACHABILITY_OPTIONS.find((o) => o.value === r)).filter(Boolean);
  const kinds = arr(b.coverageKinds).map((k) => COVERAGE_KIND_OPTIONS.find((o) => o.value === k)).filter(Boolean);
  const reqName = b.requesterDisplayName || (mine ? 'You' : 'A crewmate');
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
    actionHtml = `<span class="own-tag bounty-action">Your bounty</span>`;
  } else if (isCrew && status === 'open') {
    actionHtml = `<div class="bounty-action"><button class="btn" data-action="crew-claim" data-id="${esc(b.id)}" ${accepting ? 'disabled' : ''}>${accepting ? 'Accepting…' : `Claim days (${remainingCount} left)`}</button></div>`;
  } else if (status === 'open') {
    actionHtml = `<div class="bounty-action"><button class="btn" data-action="accept" data-id="${esc(b.id)}" ${accepting ? 'disabled' : ''}>${accepting ? 'Accepting…' : 'Take voyage'}</button></div>`;
  } else if (isCrew && coverers.length > 0) {
    actionHtml = `<div class="taken-by crew-coverers">
      <span class="taken-by-label">Crew</span>
      <div class="coverer-stack">${coverers.slice(0, 4).map((c) => c.photoURL ? `<img class="avatar-mini" src="${esc(c.photoURL)}" alt="" referrerpolicy="no-referrer" title="${esc(c.displayName ?? '')}"/>` : `<span class="avatar-mini" style="background: var(--parchment-dim); display: inline-block;" title="${esc(c.displayName ?? '')}"></span>`).join('')}${coverers.length > 4 ? `<span class="more">+${coverers.length - 4}</span>` : ''}</div>
    </div>`;
  } else if (b.covererDisplayName || youCover) {
    const covererName = b.covererDisplayName || 'You';
    const covererPhoto = b.covererPhotoURL;
    actionHtml = `<div class="taken-by">
      <span class="taken-by-label">Covered by</span>
      ${covererPhoto ? `<img class="avatar-mini" src="${esc(covererPhoto)}" alt="" referrerpolicy="no-referrer"/>` : ''}
      <span>${esc(shortName(covererName))}</span>
    </div>`;
  } else {
    actionHtml = `<div class="bounty-action"><span class="own-tag">${esc(statusLabel)}</span></div>`;
  }

  return `
    <li class="bounty bounty-${status}" data-bounty-id="${esc(b.id)}" style="cursor: pointer;">
      <div class="bounty-status-area">
        <span class="status-badge status-${status}">${esc(statusLabel)}</span>
        ${isCrew ? `<span class="mode-pill" title="${claimedCount}/${allDays.length} days claimed">🏴‍☠️ CREW · ${claimedCount}/${allDays.length}</span>` : ''}
        ${youHaveDays && isCrew ? `<span class="mine-pill">YOU</span>` : ''}
      </div>
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

      <div style="margin: 12px 0 8px; display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
        <h3 style="margin: 0;">Captain’s log</h3>
        ${state.ledger.length > 0 ? `<button class="btn-ghost" data-action="export-csv">📥 Download CSV</button>` : ''}
      </div>
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
function renderDayPicker() {
  const f = state.formState;
  const start = parseLocalDate(f.startDate);
  const end = parseLocalDate(f.endDate);
  if (!start || !end || end < start) {
    return `<div class="meetings-picker"><span class="muted" style="font-size: var(--fs-meta);">Pick the date range above first.</span></div>`;
  }
  const allKeys = allDayKeysInRange(start, end);
  const selectedSet = new Set(f.selectedDayKeys.length > 0 ? f.selectedDayKeys : allKeys);
  if (f.selectedDayKeys.length === 0) f.selectedDayKeys = allKeys.slice();
  const cost = computeCostFromKeys(Array.from(selectedSet));
  return `
    <div class="meetings-picker">
      <div class="meetings-head">
        <span class="muted" style="font-size: var(--fs-meta);">${selectedSet.size} of ${allKeys.length} day${allKeys.length === 1 ? '' : 's'} · ${cost.totalCoins} doubloons</span>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button type="button" class="btn-ghost" data-action="select-weekdays">Weekdays only</button>
          <button type="button" class="btn-ghost" data-action="select-all-days">All</button>
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
            <li class="day-card ${sel ? 'selected' : 'off'} ${isWeekend ? 'weekend' : ''}" data-action="toggle-day" data-day-key="${esc(key)}">
              <strong>${WEEKDAY_NAMES[dow]}</strong>
              <span class="day-date">${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}</span>
              <span class="day-cost">${cost} <small>${SVG.doubloon}</small></span>
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
    return `<div class="meetings-picker"><span class="muted" style="font-size: var(--fs-meta);">Pick dates above to see your meetings in that window.</span></div>`;
  }
  if (!calendar.isConnected()) {
    return `
      <div class="meetings-picker">
        <button type="button" class="btn btn-secondary" data-action="connect-calendar">📅 Connect Google Calendar</button>
        <p class="muted" style="margin: 8px 0 0; font-size: var(--fs-meta);">Optional. Lets you pick which meetings the coverer should attend, with Meet/Teams/Zoom links included.</p>
      </div>
    `;
  }
  if (state.calendarLoading) {
    return `<div class="meetings-picker"><span class="loading-doubloon">${SVG.doubloon}</span> Loading meetings…</div>`;
  }
  if (state.calendarError) {
    return `
      <div class="meetings-picker">
        <p class="error-text">Calendar: ${esc(state.calendarError)}</p>
        <button type="button" class="btn-ghost" data-action="refresh-cal">↻ Retry</button>
      </div>
    `;
  }
  const events = state.calendarEvents;
  if (events.length === 0) {
    return `
      <div class="meetings-picker">
        <p class="muted" style="margin: 0;">No meetings in this window. (Cleared shore leave!)</p>
        <button type="button" class="btn-ghost" data-action="refresh-cal" style="margin-top: 8px;">↻ Refresh</button>
      </div>
    `;
  }
  const selectedIds = new Set(f.meetings.map((m) => m.googleEventId));
  return `
    <div class="meetings-picker">
      <div class="meetings-head">
        <span class="muted" style="font-size: var(--fs-meta);">${events.length} meeting${events.length === 1 ? '' : 's'} in window. Tick the ones the coverer should handle.</span>
        <button type="button" class="btn-ghost" data-action="refresh-cal">↻ Refresh</button>
      </div>
      <ul class="meeting-list">
        ${events.map((m) => `
          <li>
            <label class="meeting-row ${selectedIds.has(m.googleEventId) ? 'selected' : ''}">
              <input type="checkbox" name="meeting" value="${esc(m.googleEventId)}" ${selectedIds.has(m.googleEventId) ? 'checked' : ''} data-meeting-id="${esc(m.googleEventId)}" />
              <span class="check-box"></span>
              <span class="meeting-info">
                <strong>${esc(m.summary)}</strong>
                <small>${esc(formatMeetingDate(m.startMs, m.endMs))}${m.attendees?.length ? ` · ${m.attendees.length} attendees` : ''}</small>
                <span class="meeting-links">
                  ${m.hangoutLink ? `<a href="${esc(m.hangoutLink)}" target="_blank" rel="noopener">📹 Meet</a>` : ''}
                  ${m.conferenceLinks?.map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener">🔗 ${esc(l.match(/teams|zoom|whereby/i)?.[0] || 'Link')}</a>`).join('') || ''}
                  ${m.htmlLink ? `<a href="${esc(m.htmlLink)}" target="_blank" rel="noopener" class="cal-link">📅 In Calendar</a>` : ''}
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
      <div class="panel-title">Post a bounty</div>
      <p class="muted" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 18px; margin: 0 0 14px;">
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
          <div class="wide">
            <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 8px; color: var(--ink-pure); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; display: block;">Days to be covered · click to toggle</span>
            ${renderDayPicker()}
          </div>

          <div class="wide">
            <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 8px; color: var(--ink-pure); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; display: block;">Coverage mode</span>
            <div class="mode-toggle">
              <label class="mode-option ${(f.coverageMode || 'single') === 'single' ? 'selected' : ''}">
                <input type="radio" name="coverageMode" value="single" ${(f.coverageMode || 'single') === 'single' ? 'checked' : ''} />
                <div>
                  <strong>👤 Single coverer</strong>
                  <small>One crewmate takes the whole window. Some clients want only one person on the rotation.</small>
                </div>
              </label>
              <label class="mode-option ${f.coverageMode === 'crew' ? 'selected' : ''}">
                <input type="radio" name="coverageMode" value="crew" ${f.coverageMode === 'crew' ? 'checked' : ''} />
                <div>
                  <strong>🏴‍☠️ Crew coverage</strong>
                  <small>Several crewmates can split the days. Long vacations get covered faster.</small>
                </div>
              </label>
            </div>
          </div>

          <label class="wide"><span>Coverage scope · which accounts / responsibilities</span><input type="text" name="coverageScope" placeholder="e.g. Acme + 2 SMBs · my weekly 1:1s with BigCorp" value="${esc(f.coverageScope)}" /></label>

          <div class="wide">
            <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 8px; color: var(--ink-pure); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; display: block;">Meetings to be covered</span>
            ${renderMeetingsPicker()}
          </div>
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

function renderMembersTab() {
  if (state.crewMembersLoading && state.crewMembers.length === 0) {
    return `<div class="loading"><span class="loading-doubloon">${SVG.doubloon}</span>Mustering the crew&hellip;</div>`;
  }
  const members = state.crewMembers;
  if (members.length === 0) {
    return `<div class="empty-card"><p><strong>Empty roster.</strong></p><p class="muted">Should never see this — refresh.</p></div>`;
  }
  return `
    <section>
      <div class="wof-meta">
        <span>${members.length} crewmate${members.length === 1 ? '' : 's'} aboard</span>
        <button class="btn-ghost" data-action="refresh-members">↻ Refresh</button>
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
                <strong>${esc(m.displayName)}${isMe ? ' (you)' : ''}</strong>
                <small>${rank.icon} ${esc(rank.name)} · ${m.voyages} voyage${m.voyages === 1 ? '' : 's'}</small>
              </div>
              ${m.role === 'manager' ? `<span class="role-badge manager">CAPTAIN</span>` : `<span class="role-badge member">CREW</span>`}
              <div class="member-stats">
                <span class="member-stat">${SVG.doubloon}<strong>${m.earnedLast90d}</strong></span>
                <small>90d earned</small>
              </div>
              ${state.myRole === 'manager' ? `<button class="kebab" data-action="member-admin" data-uid="${esc(m.uid)}" title="Admin actions">⋯</button>` : ''}
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
        <p><strong>Captain's quarters.</strong></p>
        <p class="muted">Only the crew manager can edit settings.</p>
      </div>
    `;
  }
  if (state.crewSettingsLoading && !state.crewSettings) {
    return `<div class="loading"><span class="loading-doubloon">${SVG.doubloon}</span>Loading the captain's ledger&hellip;</div>`;
  }
  const s = state.crewSettings || { hasGeminiKey: false, geminiKeyLast4: null, geminiKeySetAtMs: null };
  const inputId = 'gemini-key-' + Math.random().toString(36).slice(2, 8);
  return `
    <div class="panel">
      <div class="panel-title">Crew settings</div>
      <p class="muted" style="margin: 0 0 var(--sp-3); font-size: var(--fs-meta);">
        These settings only the manager can change. Secret keys are stored server-side
        and never returned to the browser — only metadata (last 4 chars, set date).
      </p>

      <div class="setting-row">
        <div class="setting-info">
          <strong>Gemini API key</strong>
          <p class="muted" style="margin: 4px 0 0; font-size: var(--fs-meta);">
            Used by future AI-powered features (briefing extraction, smart bounty drafts).
            Get one at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.
          </p>
          ${s.hasGeminiKey ? `
            <p class="setting-status" style="margin: 8px 0 0;">
              <span class="status-badge status-active">CONFIGURED</span>
              ends in <code>${esc(s.geminiKeyLast4 ?? '????')}</code>
              ${s.geminiKeySetAtMs ? ` · set ${esc(timeAgo(new Date(s.geminiKeySetAtMs)))}` : ''}
            </p>
          ` : `
            <p class="setting-status" style="margin: 8px 0 0;">
              <span class="status-badge status-cancelled">NOT SET</span>
            </p>
          `}
        </div>
      </div>

      <div style="margin-top: var(--sp-3);">
        <label>
          <span style="font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 8px; letter-spacing: 1px; text-transform: uppercase;">${s.hasGeminiKey ? 'Replace' : 'Set'} the key</span>
          <input type="password" id="${inputId}" placeholder="AIza..." autocomplete="off" />
        </label>
        <div style="display: flex; gap: var(--sp-2); margin-top: var(--sp-3); flex-wrap: wrap;">
          <button class="btn" data-action="save-gemini" data-input-id="${inputId}">Save key</button>
          ${s.hasGeminiKey ? `<button class="btn btn-danger" data-action="clear-gemini">Clear key</button>` : ''}
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: var(--sp-4);">
      <div class="panel-title">Crew identity</div>
      <p class="muted" style="margin: 0 0 var(--sp-2); font-size: var(--fs-meta);">Name and crew photo also live under MANAGE on the header.</p>
      <button class="btn btn-secondary" data-action="manage-crew">✏ Open Manage Crew</button>
    </div>

    <div class="panel" style="margin-top: var(--sp-4);">
      <div class="panel-title">Backfill onboarding grant</div>
      <p class="muted" style="font-size: var(--fs-meta); margin-bottom: var(--sp-2);">
        The starter chest used to be 20 doubloons; it's now 125 (covers 25 business days). Top up any existing crewmate who got the old grant so everyone starts on the new floor.
      </p>
      <button class="btn btn-secondary" data-action="topup-grant">💰 Top up to 125</button>
    </div>

    <div class="panel" style="margin-top: var(--sp-4);">
      <div class="panel-title">Audit log · last 50 actions</div>
      <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
        <button class="btn-ghost" data-action="refresh-audit">${state.auditLogLoading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>
      ${state.auditLog.length === 0 ? `
        <p class="muted" style="font-size: var(--fs-meta);">No admin actions recorded yet.</p>
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
              cancelBounty: 'cancelled a bounty',
              updateTeam: 'updated crew name / photo',
              updateCrewSettings: 'changed crew settings',
              topUpOnboardingGrant: 'topped up the onboarding grant',
              updateBountyDetails: 'edited a bounty',
              updateMemberRole: `made ${a.targetName || 'crewmate'} a ${a.details?.to || 'role'}`,
              removeMember: `removed ${a.targetName || 'crewmate'}`,
              grantBonusDoubloons: `granted ${a.details?.amount || ''} doubloons to ${a.targetName || 'crewmate'}`,
              forceCompleteBounty: 'force-completed a bounty',
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
              return `<button class="react-btn ${mine ? 'mine' : ''}" data-action="react-scroll" data-scroll-id="${esc(s.id)}" data-emoji="${esc(emo)}" data-mine="${mine ? '1' : '0'}">${emo}${cnt > 0 ? ` <span class="react-count">${cnt}</span>` : ''}</button>`;
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
  } else if (action === 'open-skin-picker') {
    e.preventDefault();
    showSkinPicker();
  } else if (action === 'pick-skin') {
    e.preventDefault();
    skin.set(t.dataset.id);
    document.querySelectorAll('.skin-card').forEach((el) => el.classList.toggle('selected', el === t));
    showToast('Skin applied.', 'success', 2500);
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
  } else if (action === 'manage-crew') {
    e.preventDefault();
    const team = state.myTeams.find((t) => t.id === state.teamId);
    if (team) showManageCrewModal(team);
  } else if (action === 'save-gemini') {
    e.preventDefault();
    const input = document.getElementById(t.dataset.inputId);
    const key = input?.value?.trim() ?? '';
    if (!key) { showToast('Paste an API key first.', 'error'); return; }
    if (key.length < 8) { showToast('Key looks too short. Double-check.', 'error'); return; }
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
      title: 'PROMOTE TO CAPTAIN?',
      body: `<p>This will give <strong>${esc(t.dataset.name)}</strong> manager rights — they'll be able to edit the crew, cancel bounties, grant bonuses, change roles.</p>`,
      primaryLabel: 'Aye, promote',
      secondaryLabel: 'Cancel',
      onPrimary: () => changeMemberRole(t.dataset.uid, 'manager', t.dataset.name),
    });
  } else if (action === 'adm-demote') {
    e.preventDefault();
    showModal({
      title: 'DEMOTE TO CREWMATE?',
      body: `<p>This will remove manager rights from <strong>${esc(t.dataset.name)}</strong>.</p>`,
      primaryLabel: 'Aye, demote',
      secondaryLabel: 'Cancel',
      onPrimary: () => changeMemberRole(t.dataset.uid, 'member', t.dataset.name),
    });
  } else if (action === 'adm-remove') {
    e.preventDefault();
    showModal({
      title: 'REMOVE FROM CREW?',
      body: `<p>This will boot <strong>${esc(t.dataset.name)}</strong> from the crew. They can be re-invited but their wallet for this crew is sealed.</p>`,
      primaryLabel: 'Aye, remove',
      secondaryLabel: 'Cancel',
      onPrimary: () => removeMemberAction(t.dataset.uid, t.dataset.name),
    });
  } else if (action === 'force-complete') {
    e.preventDefault();
    showModal({
      title: 'FORCE COMPLETE BOUNTY?',
      body: `<p>This marks the bounty as completed immediately and burns the harbour fee. Use only when the regular daily release won't finish (coverer disappeared, etc.).</p>`,
      primaryLabel: 'Aye, complete it',
      secondaryLabel: 'Cancel',
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
      title: 'CLEAR GEMINI KEY?',
      body: '<p>The crew will lose access to AI-powered features until you set a new key.</p>',
      primaryLabel: 'Aye, clear it',
      secondaryLabel: 'Nevermind',
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
});

function syncFormStateFromDom(form) {
  const data = new FormData(form);
  const f = state.formState;
  const prevStart = f.startDate;
  const prevEnd = f.endDate;
  f.startDate = data.get('startDate') || '';
  f.endDate = data.get('endDate') || '';
  // When dates change, reset selectedDayKeys so the day picker rebuilds
  if (f.startDate !== prevStart || f.endDate !== prevEnd) {
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
  if ((f.startDate !== prevStart || f.endDate !== prevEnd) && calendar.isConnected() && f.startDate && f.endDate) {
    clearTimeout(syncFormStateFromDom._calTimer);
    syncFormStateFromDom._calTimer = setTimeout(() => refreshCalendarEvents(), 400);
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
});

render();
