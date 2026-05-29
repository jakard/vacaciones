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

const MASCOT_LINES = [
  '"Ahoy, weary TAM!"',
  '"Coins, or coverage?"',
  '"Need a week ashore?"',
  '"Even pirates take leave."',
  '"Doubloons jingle softly."',
];

/* ============================================================
   Firebase init
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

/* ============================================================
   State
   ============================================================ */

const state = {
  authReady: false,
  user: null,
  view: 'login',
  teamId: null,
  teamTab: 'bounties', // 'bounties' | 'chest' | 'post'
  bountyFilter: 'all', // 'all' | 'open' | 'taken' | 'done' | 'mine'
  myTeams: [],
  walletDoc: null,
  ledger: [],
  prevLedgerIds: new Set(),
  bounties: [],
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
  if (!start || !end || end < start) {
    return { totalCoins: 0, weekdays: 0, weekendDays: 0, days: 0 };
  }
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

function pickMascotLine() {
  return MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)];
}

function arr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return [val];
  return [];
}

/* ============================================================
   SVG sprites (subset — see styles for the rest)
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
    return { view: 'team', teamId: decodeURIComponent(tid), tab };
  }
  if (h.startsWith('#/join/')) {
    return { view: 'home', joinId: decodeURIComponent(h.slice('#/join/'.length)) };
  }
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
      if (result.data.initialized) showWelcomeModal();
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
  } catch (err) {
    showToast(err.message, 'error', 5000);
  } finally {
    state.busy.signIn = false;
    render();
  }
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
  const q = query(
    collection(db, 'teams'),
    where('memberUids', 'array-contains', state.user.uid),
  );
  unsubTeams = onSnapshot(q,
    (snap) => {
      state.myTeams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
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

  unsubWallet = onSnapshot(
    doc(db, `teams/${teamId}/wallets/${state.user.uid}`),
    (snap) => {
      state.walletDoc = snap.exists() ? snap.data() : null;
      render();
    },
    (err) => console.error('wallet query failed', err),
  );

  unsubLedger = onSnapshot(
    query(
      collection(db, `teams/${teamId}/ledgerEntries`),
      where('uid', '==', state.user.uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
    (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (state.prevLedgerIds.size > 0) {
        const fresh = next.filter((e) => !state.prevLedgerIds.has(e.id));
        for (const entry of fresh) {
          if (entry.amountSigned > 0 && entry.type !== 'grant') {
            launchCoinShower(`+${entry.amountSigned}`);
          }
        }
      }
      state.prevLedgerIds = new Set(next.map((e) => e.id));
      state.ledger = next;
      render();
    },
    (err) => console.error('ledger query failed', err),
  );

  // All recent bounties (any status except cancelled), client-side filter by tab/filter
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
}

function teardownTeamSubs() {
  unsubWallet?.(); unsubWallet = null;
  unsubLedger?.(); unsubLedger = null;
  unsubRequests?.(); unsubRequests = null;
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
  state.busy.createTeam = true;
  render();
  try {
    const result = await callCreateTeam({ name });
    showToast(`Crew "${name}" formed. 20 doubloons in your chest.`, 'success');
    const input = document.getElementById('new-team-name');
    if (input) input.value = '';
    navigate('team', result.data.teamId);
  } catch (err) {
    showToast(err.message, 'error', 5000);
  } finally {
    state.busy.createTeam = false;
    render();
  }
}

async function joinTeam(teamId) {
  if (state.busy.joinTeam || !teamId) return;
  state.busy.joinTeam = true;
  render();
  try {
    const result = await callJoinTeam({ teamId });
    if (result.data.alreadyMember) showToast('You’re already aboard that crew.', 'info');
    else showToast('Signed aboard! 20 doubloons in your chest.', 'success');
    const input = document.getElementById('join-team-id');
    if (input) input.value = '';
    navigate('team', result.data.teamId);
  } catch (err) {
    showToast(err.message, 'error', 5000);
  } finally {
    state.busy.joinTeam = false;
    render();
  }
}

async function postBounty() {
  if (state.busy.postRequest) return;
  const f = state.formState;
  const start = parseLocalDate(f.startDate);
  const end = parseLocalDate(f.endDate);
  if (!start || !end || end < start) {
    showToast('Pick a valid date window.', 'error');
    return;
  }
  if (f.reachability.length === 0) {
    showToast('Pick at least one reachability option.', 'error');
    return;
  }
  state.busy.postRequest = true;
  render();
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
    // Reset form state
    state.formState = {
      startDate: '',
      endDate: '',
      timezone: state.formState.timezone,
      reachability: ['email-only-emergencies'],
      coverageKinds: [],
      coverageScope: '',
      sla: state.formState.sla,
      emergencyDef: '',
    };
    navigate('team', state.teamId, 'bounties');
  } catch (err) {
    showToast(err.message, 'error', 6000);
  } finally {
    state.busy.postRequest = false;
    render();
  }
}

async function acceptRequest(requestId) {
  if (state.busy.acceptId) return;
  state.busy.acceptId = requestId;
  render();
  try {
    const result = await callAcceptCoverageRequest({ teamId: state.teamId, requestId });
    showToast(`Voyage accepted. ${result.data.coinsEscrowed} doubloons locked in escrow.`, 'success');
  } catch (err) {
    showToast(err.message, 'error', 6000);
  } finally {
    state.busy.acceptId = null;
    render();
  }
}

async function copyInviteLink(teamId) {
  const link = `${location.origin}/#/join/${encodeURIComponent(teamId)}`;
  try {
    await navigator.clipboard.writeText(link);
    showToast('Invite link copied. Hand it to a crewmate.', 'success');
  } catch {
    showToast(`Invite link: ${link}`, 'info', 8000);
  }
}

/* ============================================================
   Coin shower + toasts + modal
   ============================================================ */

function launchCoinShower(label) {
  const root = document.getElementById('coin-shower');
  if (!root) return;
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
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s';
    setTimeout(() => el.remove(), 220);
  };
  el.addEventListener('click', dismiss);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1500); });
  timer = setTimeout(dismiss, ttl);
}

function showModal({ title, body, primaryLabel = 'AYE', secondaryLabel, onPrimary, onSecondary }) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-scrim';
  wrap.innerHTML = `
    <div class="modal">
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
    if (action === 'primary') { onPrimary?.(); close(); }
    if (action === 'secondary') { onSecondary?.(); close(); }
  });
  root.appendChild(wrap);
}

function showWelcomeModal() {
  showModal({
    title: 'AHOY, NEW DECKHAND',
    body: `
      <p>Welcome aboard <strong>Vacaciones</strong> — the coverage marketplace where TAMs trade doubloons to take leave without dropping the ball.</p>
      <ul>
        <li><strong>20 doubloons</strong> in your starter chest the moment you join a crew.</li>
        <li>The Crown drops <strong>10 stipend coins</strong> in your purse every month — spend them or they vanish at month’s end.</li>
        <li>A coverage day costs <strong>5 doubloons</strong> (weekends double).</li>
        <li>Cover a crewmate, earn their doubloons as the days pass. Top earners get the captain’s hat.</li>
      </ul>
      <p>Find your crew, post a bounty, take your damn vacation.</p>
    `,
    primaryLabel: 'Set sail',
  });
}

/* ============================================================
   Header
   ============================================================ */

function setHeaderVisible(visible) {
  document.getElementById('header').hidden = !visible;
}

function renderUserInfo() {
  const target = document.getElementById('user-info');
  if (!state.user) { target.innerHTML = ''; return; }
  const u = state.user;
  const team = state.teamId ? state.myTeams.find((t) => t.id === state.teamId) : null;
  const wallet = state.walletDoc;
  const totalBalance = wallet ? (wallet.earnedBalance ?? 0) + (wallet.stipendBalance ?? 0) : null;
  target.innerHTML = `
    ${totalBalance !== null && team ? `
      <span class="coin-pill" title="Total doubloons in this crew">
        ${SVG.doubloon}<span>${totalBalance}</span>
      </span>` : ''}
    ${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer" />` : ''}
    <div class="who">
      <span class="name">${esc(u.displayName ?? '')}</span>
      <span class="email">${esc(u.email ?? '')}</span>
    </div>
    <button class="btn-secondary" data-action="sign-out" style="padding: 6px 10px; font-size: 8px;">SIGN OUT</button>
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
  return `
    <svg class="login-bg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="130" fill="#0F1A2E"/>
      <rect x="20" y="20" width="1" height="1" fill="#F7E7C2"/>
      <rect x="48" y="34" width="1" height="1" fill="#F7E7C2"/>
      <rect x="80" y="18" width="1" height="1" fill="#F7E7C2"/>
      <rect x="140" y="40" width="1" height="1" fill="#F7E7C2"/>
      <rect x="180" y="22" width="1" height="1" fill="#F7E7C2"/>
      <rect x="220" y="38" width="1" height="1" fill="#F7E7C2"/>
      <rect x="260" y="14" width="1" height="1" fill="#F7E7C2"/>
      <rect x="298" y="44" width="1" height="1" fill="#F7E7C2"/>
      <rect x="60" y="60" width="1" height="1" fill="#A6C2E8"/>
      <rect x="115" y="70" width="1" height="1" fill="#A6C2E8"/>
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
    </svg>
  `;
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
  else body = renderBountyBoardTab();

  return `
    <nav class="breadcrumb">
      <a href="#/">Crews</a>
      <span class="sep">/</span>
      <span class="current">${esc(team.name)}</span>
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
      <a href="#/team/${esc(team.id)}" class="tab ${tab === 'bounties' ? 'active' : ''}">
        Bounty Board ${openCount > 0 ? `<span class="tab-count">${openCount}</span>` : ''}
      </a>
      <a href="#/team/${esc(team.id)}/chest" class="tab ${tab === 'chest' ? 'active' : ''}">
        Treasure Chest
      </a>
      <a href="#/team/${esc(team.id)}/post" class="tab ${tab === 'post' ? 'active' : ''}">
        Post Bounty
      </a>
    </nav>

    ${body}
  `;
}

/* ============================================================
   Tab: Bounty Board
   ============================================================ */

function renderBountyBoardTab() {
  const filter = state.bountyFilter;
  let list = state.bounties.slice();

  // Apply filter
  if (filter === 'open') list = list.filter((b) => b.status === 'open');
  else if (filter === 'taken') list = list.filter((b) => b.status === 'accepted' || b.status === 'active');
  else if (filter === 'done') list = list.filter((b) => b.status === 'completed');
  else if (filter === 'mine') list = list.filter((b) => b.requesterUid === state.user.uid);

  // Sort: open first, then by status priority, then by windowStart
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
          <p class="muted">${filter === 'all'
            ? 'Post one yourself — your crewmates earn doubloons by covering you.'
            : 'Switch the filter above to see other bounties.'}</p>
          ${filter === 'all' ? `<p style="margin-top: 16px;"><a href="#/team/${esc(state.teamId)}/post">▶ Post a bounty</a></p>` : ''}
        </div>
      ` : `
        <ul class="bounties">
          ${list.map(renderBountyCard).join('')}
        </ul>
      `}
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
  if (mine) {
    actionHtml = `<span class="own-tag bounty-action">Your bounty</span>`;
  } else if (status === 'open') {
    actionHtml = `<div class="bounty-action"><button class="btn" data-action="accept" data-id="${esc(b.id)}" ${accepting ? 'disabled' : ''}>${accepting ? 'Accepting…' : 'Take voyage'}</button></div>`;
  } else if (covererName) {
    actionHtml = `<div class="taken-by">
      <span class="taken-by-label">Covered by</span>
      ${covererPhoto ? `<img class="avatar-mini" src="${esc(covererPhoto)}" alt="" referrerpolicy="no-referrer"/>` : ''}
      <span>${esc(shortName(covererName))}</span>
    </div>`;
  } else {
    actionHtml = `<div class="bounty-action"><span class="own-tag">${esc(statusLabel)}</span></div>`;
  }

  return `
    <li class="bounty bounty-${status}">
      <div class="bounty-status-area">
        <span class="status-badge status-${status}">${esc(statusLabel)}</span>
      </div>
      <div class="bounty-requester" title="${esc(b.requesterDisplayName ?? '')}">
        ${reqPhoto ? `<img class="avatar-mini" src="${esc(reqPhoto)}" alt="" referrerpolicy="no-referrer" />`
                  : `<span class="avatar-mini" style="background: var(--parchment-dim); display: inline-block;"></span>`}
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

/* ============================================================
   Tab: Treasure Chest
   ============================================================ */

function renderChestTab() {
  const w = state.walletDoc;
  return `
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

      <h3 style="margin-bottom: 8px;">Captain’s log</h3>
      ${state.ledger.length === 0 ? `
        <p class="muted">Your ledger is empty for now.</p>
      ` : `
        <ul class="ledger">
          ${state.ledger.map((e) => `
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

/* ============================================================
   Tab: Post Bounty
   ============================================================ */

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
          <label>
            <span>Shore leave from</span>
            <input type="date" name="startDate" value="${esc(f.startDate)}" />
          </label>
          <label>
            <span>Returning by</span>
            <input type="date" name="endDate" value="${esc(f.endDate)}" />
          </label>
          <label class="wide">
            <span>Timezone</span>
            <input type="text" name="timezone" value="${esc(tz)}" />
          </label>

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

          <label class="wide">
            <span>Coverage scope · which accounts / responsibilities</span>
            <input type="text" name="coverageScope" placeholder="e.g. Acme + 2 SMBs · my weekly 1:1s with BigCorp" value="${esc(f.coverageScope)}" />
          </label>

          <label class="wide">
            <span>SLA the coverer should hold</span>
            <input type="text" name="sla" value="${esc(f.sla)}" />
          </label>

          <label class="wide">
            <span>What counts as a real emergency? (optional)</span>
            <textarea name="emergencyDef" rows="2" placeholder="“Wake me only if Acme’s production is down.”">${esc(f.emergencyDef)}</textarea>
          </label>
        </div>

        <div class="preview-row">
          <div class="preview">
            ${cost.days > 0 ? `
              <div class="cost"><strong>${cost.totalCoins}</strong><span>doubloons</span></div>
              <small>${cost.days} day${cost.days === 1 ? '' : 's'} · ${cost.weekdays} weekday · ${cost.weekendDays} weekend</small>
            ` : `<small class="muted-light">Pick a window to preview the cost.</small>`}
          </div>
          <button type="submit" class="btn btn-large" ${state.busy.postRequest ? 'disabled' : ''}>${state.busy.postRequest ? 'Posting…' : 'Post bounty'}</button>
        </div>
      </form>
    </div>
  `;
}

/* ============================================================
   Event delegation
   ============================================================ */

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
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
    await acceptRequest(t.dataset.id);
  } else if (action === 'copy-invite') {
    e.preventDefault();
    await copyInviteLink(t.dataset.id);
  } else if (action === 'set-filter') {
    e.preventDefault();
    state.bountyFilter = t.dataset.filter;
    render();
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
  // Update cost preview without full re-render
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
    const input = document.getElementById('new-team-name');
    createTeam(input.value.trim());
  }
  if (e.key === 'Enter' && document.activeElement?.id === 'join-team-id') {
    e.preventDefault();
    const input = document.getElementById('join-team-id');
    let raw = input.value.trim();
    const m = raw.match(/#\/join\/([^?&#]+)/);
    if (m) raw = decodeURIComponent(m[1]);
    joinTeam(raw);
  }
});

/* ============================================================
   Bootstrap
   ============================================================ */

render();
