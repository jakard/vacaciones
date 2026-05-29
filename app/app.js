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
  { value: 'unreachable', label: 'Unreachable — true shore leave' },
  { value: 'email-only-emergencies', label: 'Email only, emergencies' },
  { value: 'phone-emergencies', label: 'Phone, P1 emergencies only' },
  { value: 'daily-check-in', label: 'Daily check-in' },
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
  myTeams: [],
  walletDoc: null,
  ledger: [],
  prevLedgerIds: new Set(),
  openRequests: [],
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

function pickMascotLine() {
  return MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)];
}

/* ============================================================
   SVG sprites
   ============================================================ */

const SVG = {
  // 16x16 doubloon
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
  // 32x32 flag (for team / bounty)
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
  // 32x32 scroll (for bounty open status)
  scroll: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="4" y="6" width="24" height="20" fill="#E8D7A8"/>
    <rect x="4" y="6" width="24" height="2" fill="#C4A86B"/>
    <rect x="4" y="24" width="24" height="2" fill="#C4A86B"/>
    <rect x="2" y="6" width="2" height="20" fill="#5A3A1F"/>
    <rect x="28" y="6" width="2" height="20" fill="#5A3A1F"/>
    <rect x="8" y="11" width="16" height="1" fill="#6B4F30"/>
    <rect x="8" y="14" width="14" height="1" fill="#6B4F30"/>
    <rect x="8" y="17" width="16" height="1" fill="#6B4F30"/>
    <rect x="8" y="20" width="10" height="1" fill="#6B4F30"/>
  </svg>`,
  // 96x96 turtle mascot
  turtle: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <!-- shell -->
    <rect x="8" y="11" width="16" height="9" fill="#5A3A1F"/>
    <rect x="7" y="12" width="18" height="7" fill="#8C6418"/>
    <rect x="8" y="13" width="16" height="5" fill="#A57B36"/>
    <rect x="10" y="14" width="2" height="2" fill="#5A3A1F"/>
    <rect x="14" y="14" width="2" height="2" fill="#5A3A1F"/>
    <rect x="18" y="14" width="2" height="2" fill="#5A3A1F"/>
    <rect x="20" y="14" width="2" height="2" fill="#5A3A1F"/>
    <!-- head -->
    <rect x="4" y="14" width="4" height="4" fill="#2A6A1E"/>
    <rect x="3" y="15" width="1" height="2" fill="#2A6A1E"/>
    <rect x="5" y="15" width="1" height="1" fill="#F7E7C2"/>
    <rect x="5" y="15" width="1" height="1" fill="#1A0E08" opacity="0"/>
    <rect x="6" y="15" width="1" height="1" fill="#1A0E08"/>
    <!-- pirate hat -->
    <rect x="4" y="12" width="6" height="2" fill="#1A0E08"/>
    <rect x="3" y="13" width="8" height="1" fill="#1A0E08"/>
    <rect x="6" y="11" width="2" height="1" fill="#1A0E08"/>
    <rect x="5" y="13" width="1" height="1" fill="#E0A93B"/>
    <!-- legs -->
    <rect x="9" y="20" width="2" height="3" fill="#2A6A1E"/>
    <rect x="21" y="20" width="2" height="3" fill="#2A6A1E"/>
    <!-- tail -->
    <rect x="24" y="14" width="2" height="2" fill="#2A6A1E"/>
  </svg>`,
};

/* ============================================================
   Routing
   ============================================================ */

function parseHash() {
  const h = location.hash || '#/';
  if (h.startsWith('#/team/')) {
    return { view: 'team', teamId: decodeURIComponent(h.slice('#/team/'.length)) };
  }
  if (h.startsWith('#/join/')) {
    return { view: 'home', joinId: decodeURIComponent(h.slice('#/join/'.length)) };
  }
  return { view: 'home', teamId: null };
}

function navigate(view, teamId) {
  if (view === 'team' && teamId) location.hash = `#/team/${encodeURIComponent(teamId)}`;
  else location.hash = '#/';
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
    // Auto-join from invite link
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
  render();
}

/* ============================================================
   Auth lifecycle
   ============================================================ */

onAuthStateChanged(auth, async (user) => {
  state.authReady = true;
  state.user = user;
  setHeaderVisible(!!user);
  renderUserInfo();
  if (user) {
    try {
      const result = await callInitUser();
      if (result.data.initialized) {
        // Brand new user — show welcome modal
        showWelcomeModal();
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
  } catch (err) {
    showToast(err.message, 'error', 5000);
  } finally {
    state.busy.signIn = false;
    render();
  }
}

async function handleSignOut() {
  try {
    await signOut(auth);
  } catch (err) {
    showToast(err.message, 'error', 5000);
  }
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
  unsubTeams = onSnapshot(
    q,
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
  state.openRequests = [];
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
      // Detect new credit entries → coin shower
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

  unsubRequests = onSnapshot(
    query(
      collection(db, `teams/${teamId}/coverageRequests`),
      where('status', '==', 'open'),
      orderBy('windowStart', 'asc'),
    ),
    (snap) => {
      state.openRequests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => console.error('open requests query failed', err),
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
    if (result.data.alreadyMember) {
      showToast('You’re already aboard that crew.', 'info');
    } else {
      showToast('Signed aboard! 20 doubloons in your chest.', 'success');
    }
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

async function postCoverageRequest(form) {
  if (state.busy.postRequest) return;
  const start = parseLocalDate(form.startDate);
  const end = parseLocalDate(form.endDate);
  if (!start || !end || end < start) {
    showToast('Pick a valid date window.', 'error');
    return;
  }
  state.busy.postRequest = true;
  render();
  try {
    const result = await callCreateCoverageRequest({
      teamId: state.teamId,
      windowStartIso: start.toISOString(),
      windowEndIso: end.toISOString(),
      timezone: form.timezone,
      reachability: form.reachability,
      sla: form.sla,
      emergencyDef: form.emergencyDef || null,
    });
    showToast(`Bounty posted for ${result.data.coinsOffered} doubloons. Anchors aweigh!`, 'success');
    const startEl = document.getElementById('start-date');
    const endEl = document.getElementById('end-date');
    const emEl = document.getElementById('emergency-def');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    if (emEl) emEl.value = '';
    renderCostPreview();
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
   Coin shower
   ============================================================ */

function launchCoinShower(label) {
  const root = document.getElementById('coin-shower');
  if (!root) return;
  // Anchor at the wallet bucket if visible, otherwise top-center
  const anchor = document.querySelector('.bucket.total') ?? document.body;
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

/* ============================================================
   Toasts
   ============================================================ */

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

/* ============================================================
   Modal
   ============================================================ */

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
        <li><strong>20 doubloons</strong> jingle in your starter chest the moment you join a crew.</li>
        <li>The Crown drops <strong>10 stipend coins</strong> in your purse every month — spend them or they vanish at month’s end.</li>
        <li>A day of coverage costs <strong>5 doubloons</strong> (weekends double).</li>
        <li>Cover a crewmate, earn their doubloons as the days pass. The top earners get the captain’s pirate hat.</li>
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
  if (!state.user) {
    target.innerHTML = '';
    return;
  }
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
   Rendering
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
  // Inline SVG: night-time pirate harbor scene
  return `
    <svg class="login-bg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <!-- Sky -->
      <rect width="320" height="130" fill="#0F1A2E"/>
      <!-- Stars -->
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
      <!-- Moon -->
      <circle cx="80" cy="55" r="20" fill="#F7E7C2"/>
      <circle cx="74" cy="50" r="3" fill="#C4A86B" opacity="0.6"/>
      <circle cx="86" cy="60" r="2" fill="#C4A86B" opacity="0.6"/>
      <!-- Moon dither halo -->
      <rect x="56" y="40" width="2" height="2" fill="#F7E7C2" opacity="0.4"/>
      <rect x="100" y="40" width="2" height="2" fill="#F7E7C2" opacity="0.4"/>
      <rect x="58" y="70" width="2" height="2" fill="#F7E7C2" opacity="0.4"/>
      <rect x="102" y="68" width="2" height="2" fill="#F7E7C2" opacity="0.4"/>
      <!-- Sea -->
      <rect x="0" y="130" width="320" height="70" fill="#1E2D4A"/>
      <rect x="0" y="130" width="320" height="2" fill="#5BC9D1"/>
      <rect x="20" y="138" width="6" height="1" fill="#A6C2E8" opacity="0.5"/>
      <rect x="70" y="142" width="8" height="1" fill="#A6C2E8" opacity="0.5"/>
      <rect x="140" y="148" width="10" height="1" fill="#A6C2E8" opacity="0.5"/>
      <rect x="210" y="155" width="12" height="1" fill="#A6C2E8" opacity="0.5"/>
      <rect x="280" y="162" width="10" height="1" fill="#A6C2E8" opacity="0.5"/>
      <!-- Moon reflection on water -->
      <rect x="74" y="134" width="12" height="1" fill="#F7E7C2" opacity="0.7"/>
      <rect x="76" y="140" width="8" height="1" fill="#F7E7C2" opacity="0.4"/>
      <rect x="78" y="146" width="4" height="1" fill="#F7E7C2" opacity="0.3"/>
      <!-- Distant island silhouette -->
      <rect x="220" y="115" width="60" height="15" fill="#0A1320"/>
      <rect x="230" y="105" width="40" height="10" fill="#0A1320"/>
      <rect x="240" y="100" width="20" height="5" fill="#0A1320"/>
      <!-- Ship hull -->
      <rect x="180" y="110" width="40" height="20" fill="#2A1810"/>
      <rect x="178" y="112" width="44" height="16" fill="#3D2418"/>
      <rect x="175" y="120" width="50" height="8" fill="#3D2418"/>
      <rect x="186" y="116" width="2" height="2" fill="#FFCB47"/>
      <rect x="194" y="116" width="2" height="2" fill="#FFCB47"/>
      <rect x="202" y="116" width="2" height="2" fill="#FFCB47"/>
      <rect x="210" y="116" width="2" height="2" fill="#FFCB47"/>
      <!-- Ship masts and sails -->
      <rect x="195" y="70" width="1" height="40" fill="#1A0E08"/>
      <rect x="205" y="60" width="1" height="50" fill="#1A0E08"/>
      <rect x="215" y="75" width="1" height="35" fill="#1A0E08"/>
      <rect x="188" y="78" width="15" height="20" fill="#E8D7A8" opacity="0.85"/>
      <rect x="200" y="68" width="12" height="32" fill="#E8D7A8" opacity="0.85"/>
      <rect x="211" y="82" width="8" height="20" fill="#E8D7A8" opacity="0.85"/>
      <!-- Pirate flag -->
      <rect x="205" y="56" width="8" height="5" fill="#1A0E08"/>
      <rect x="207" y="57" width="2" height="2" fill="#F7E7C2"/>
      <rect x="210" y="57" width="2" height="2" fill="#F7E7C2"/>
      <!-- Dock -->
      <rect x="0" y="148" width="60" height="6" fill="#5A3A1F"/>
      <rect x="0" y="154" width="60" height="2" fill="#3D2418"/>
      <!-- Dock posts with lanterns -->
      <rect x="14" y="120" width="2" height="34" fill="#5A3A1F"/>
      <rect x="11" y="120" width="8" height="6" fill="#1A0E08"/>
      <rect x="12" y="121" width="6" height="4" fill="#FFCB47"/>
      <rect x="13" y="122" width="4" height="2" fill="#FFD86B"/>
      <!-- Lantern glow -->
      <rect x="9" y="119" width="2" height="2" fill="#FFCB47" opacity="0.3"/>
      <rect x="20" y="119" width="2" height="2" fill="#FFCB47" opacity="0.3"/>
      <rect x="14" y="126" width="2" height="2" fill="#E0A93B" opacity="0.4"/>
      <rect x="34" y="120" width="2" height="34" fill="#5A3A1F"/>
      <rect x="31" y="120" width="8" height="6" fill="#1A0E08"/>
      <rect x="32" y="121" width="6" height="4" fill="#FFCB47"/>
      <rect x="33" y="122" width="4" height="2" fill="#FFD86B"/>
      <rect x="29" y="119" width="2" height="2" fill="#FFCB47" opacity="0.3"/>
      <rect x="40" y="119" width="2" height="2" fill="#FFCB47" opacity="0.3"/>
      <!-- Palm tree -->
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
          <button class="btn" data-action="create-team" ${state.busy.createTeam ? 'disabled' : ''}>
            ${state.busy.createTeam ? 'Forming…' : 'Hoist'}
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Sign on with a crew</div>
        <p class="muted" style="font-family: 'VT323', monospace; font-size: 18px; margin: 0 0 12px;">Paste the crew ID (or invite link) a teammate shared.</p>
        <div class="row">
          <input id="join-team-id" type="text" placeholder="Crew ID" ${state.busy.joinTeam ? 'disabled' : ''} />
          <button class="btn" data-action="join-team" ${state.busy.joinTeam ? 'disabled' : ''}>
            ${state.busy.joinTeam ? 'Boarding…' : 'Aye'}
          </button>
        </div>
      </div>
    </section>
  `;
}

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

    ${renderBounties()}
    ${renderWallet()}
    ${renderCreateForm()}
  `;
}

function renderWallet() {
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

function renderBounties() {
  const reqs = state.openRequests;
  return `
    <section>
      <div class="section-head">
        <h2>The bounty board</h2>
        <small>${reqs.length} open</small>
      </div>
      ${reqs.length === 0 ? `
        <div class="empty-card">
          <div class="empty-mascot">${SVG.turtle}</div>
          <p><strong>No bounties posted.</strong></p>
          <p class="muted">When a crewmate puts one up, you can earn their doubloons by covering.</p>
        </div>
      ` : `
        <ul class="bounties">
          ${reqs.map((r) => {
            const mine = r.requesterUid === state.user.uid;
            const reachLabel = REACHABILITY_OPTIONS.find((o) => o.value === r.reachability)?.label ?? r.reachability;
            const accepting = state.busy.acceptId === r.id;
            return `
              <li class="bounty">
                <span class="bounty-flag">${SVG.scroll}</span>
                <div class="bounty-meta">
                  <strong>${esc(formatDate(r.windowStart?.toDate()))} → ${esc(formatDate(r.windowEnd?.toDate()))}</strong>
                  <small>${esc(r.timezone)} · ${esc(reachLabel)}</small>
                </div>
                <div class="bounty-price">
                  <strong>${SVG.doubloon}${r.totalCoinsOffered}</strong>
                  <small>doubloons</small>
                </div>
                ${mine
                  ? `<span class="own-tag">Your bounty</span>`
                  : `<button class="btn" data-action="accept" data-id="${esc(r.id)}" ${accepting ? 'disabled' : ''}>
                       ${accepting ? 'Accepting…' : 'Take voyage'}
                     </button>`
                }
              </li>
            `;
          }).join('')}
        </ul>
      `}
    </section>
  `;
}

function renderCreateForm() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `
    <div class="create-card">
      <div class="panel-title">Post a bounty</div>
      <p class="muted" style="font-family: 'VT323', monospace; font-size: 18px; margin: 0 0 14px;">${ECONOMY.WEEKEND_MULTIPLIER}× multiplier on Saturdays and Sundays. Doubloons leave your chest and sit in escrow until a crewmate covers.</p>
      <form id="create-form" autocomplete="off">
        <div class="form-grid">
          <label>
            <span>Shore leave from</span>
            <input type="date" id="start-date" name="startDate" />
          </label>
          <label>
            <span>Returning by</span>
            <input type="date" id="end-date" name="endDate" />
          </label>
          <label>
            <span>Timezone</span>
            <input type="text" id="timezone" name="timezone" value="${esc(tz)}" />
          </label>
          <label>
            <span>How reachable?</span>
            <select id="reachability" name="reachability">
              ${REACHABILITY_OPTIONS.map((o) => `
                <option value="${esc(o.value)}" ${o.value === 'email-only-emergencies' ? 'selected' : ''}>${esc(o.label)}</option>
              `).join('')}
            </select>
          </label>
          <label class="wide">
            <span>SLA the coverer should hold</span>
            <input type="text" id="sla" name="sla" value="P1 within 2h, P2 next business day" />
          </label>
          <label class="wide">
            <span>What counts as a real emergency? (optional)</span>
            <textarea id="emergency-def" name="emergencyDef" rows="2" placeholder="“Wake me only if Acme’s production is down.”"></textarea>
          </label>
        </div>
        <div class="preview-row">
          <div id="cost-preview" class="preview" data-total-coins="0">
            <small class="muted-light">Pick a window to preview the cost.</small>
          </div>
          <button type="submit" class="btn btn-large" ${state.busy.postRequest ? 'disabled' : ''}>
            ${state.busy.postRequest ? 'Posting…' : 'Post bounty'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderCostPreview() {
  const previewEl = document.getElementById('cost-preview');
  if (!previewEl) return;
  const startEl = document.getElementById('start-date');
  const endEl = document.getElementById('end-date');
  const start = parseLocalDate(startEl?.value);
  const end = parseLocalDate(endEl?.value);
  const cost = computeCoverageCost(start, end);
  previewEl.dataset.totalCoins = String(cost.totalCoins);
  if (cost.days > 0) {
    previewEl.innerHTML = `
      <div class="cost">
        <strong>${cost.totalCoins}</strong>
        <span>doubloons</span>
      </div>
      <small>${cost.days} day${cost.days === 1 ? '' : 's'} · ${cost.weekdays} weekday · ${cost.weekendDays} weekend</small>
    `;
  } else {
    previewEl.innerHTML = `<small class="muted-light">Pick a window to preview the cost.</small>`;
  }
}

/* ============================================================
   Event delegation
   ============================================================ */

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'sign-in') {
    e.preventDefault();
    await signIn();
  } else if (action === 'sign-out') {
    e.preventDefault();
    await handleSignOut();
  } else if (action === 'create-team') {
    e.preventDefault();
    const input = document.getElementById('new-team-name');
    await createTeam(input.value.trim());
  } else if (action === 'join-team') {
    e.preventDefault();
    const input = document.getElementById('join-team-id');
    // Accept both raw IDs and invite links
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
  }
});

document.addEventListener('submit', async (e) => {
  if (e.target.id === 'create-form') {
    e.preventDefault();
    const form = e.target;
    const data = {
      startDate: form.startDate.value,
      endDate: form.endDate.value,
      timezone: form.timezone.value.trim(),
      reachability: form.reachability.value,
      sla: form.sla.value.trim(),
      emergencyDef: form.emergencyDef.value.trim(),
    };
    await postCoverageRequest(data);
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'start-date' || e.target.id === 'end-date') {
    renderCostPreview();
  }
});

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
