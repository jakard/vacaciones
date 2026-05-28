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
  httpsCallable,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js';

// ============================================================
// Configuration
// ============================================================

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
  { value: 'unreachable', label: 'Unreachable' },
  { value: 'email-only-emergencies', label: 'Email only — emergencies' },
  { value: 'phone-emergencies', label: 'Phone for emergencies' },
  { value: 'daily-check-in', label: 'Daily check-in' },
];

const LEDGER_TYPE_LABELS = {
  grant: 'Onboarding grant',
  stipendMint: 'Monthly stipend',
  stipendExpire: 'Stipend expired',
  escrowIn: 'Posted coverage request',
  escrowOut: 'Refund from cancelled request',
  coverageRelease: 'Covered a teammate',
  feeBurn: 'Transaction fee',
  managerAdvance: 'Manager advance',
};

// ============================================================
// Firebase init
// ============================================================

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const functions = getFunctions(fbApp, 'us-central1');

const callInitUser = httpsCallable(functions, 'initUser');
const callCreateTeam = httpsCallable(functions, 'createTeam');
const callJoinTeam = httpsCallable(functions, 'joinTeam');
const callCreateCoverageRequest = httpsCallable(functions, 'createCoverageRequest');
const callAcceptCoverageRequest = httpsCallable(functions, 'acceptCoverageRequest');

// ============================================================
// State
// ============================================================

const state = {
  authReady: false,
  user: null,
  view: 'login', // 'login' | 'home' | 'team'
  teamId: null,
  myTeams: [],
  walletDoc: null,
  ledger: [],
  openRequests: [],
  busy: { signIn: false, createTeam: false, joinTeam: false, postRequest: false, acceptId: null },
};

let unsubTeams = null;
let unsubWallet = null;
let unsubLedger = null;
let unsubRequests = null;

// ============================================================
// Utilities
// ============================================================

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
  return d.toLocaleString(undefined, { dateString: 'medium', timeStyle: 'short' });
}

function firstName(name) {
  if (!name) return 'there';
  return name.split(' ')[0] ?? name;
}

function showToast(message, kind = 'info', ttl = 3000) {
  const toastEl = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  toastEl.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s';
    setTimeout(() => el.remove(), 220);
  }, ttl);
}

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
  target.innerHTML = `
    ${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="${esc(u.displayName ?? '')}" referrerpolicy="no-referrer" />` : ''}
    <div class="who">
      <span class="name">${esc(u.displayName ?? '')}</span>
      <span class="email">${esc(u.email ?? '')}</span>
    </div>
    <button class="btn-secondary" data-action="sign-out">Sign out</button>
  `;
}

// ============================================================
// Routing
// ============================================================

function parseHash() {
  const h = location.hash || '#/';
  if (h.startsWith('#/team/')) {
    return { view: 'team', teamId: h.slice('#/team/'.length) };
  }
  return { view: 'home', teamId: null };
}

function navigate(view, teamId) {
  if (view === 'team' && teamId) location.hash = `#/team/${teamId}`;
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

// ============================================================
// Auth lifecycle
// ============================================================

onAuthStateChanged(auth, async (user) => {
  state.authReady = true;
  state.user = user;
  setHeaderVisible(!!user);
  renderUserInfo();
  if (user) {
    try {
      await callInitUser();
    } catch (err) {
      console.error('initUser failed', err);
      showToast(`initUser failed: ${err.message}`, 'error', 5000);
    }
    subscribeMyTeams();
    applyRoute();
  } else {
    teardownAllSubs();
    state.view = 'login';
    state.teamId = null;
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

// ============================================================
// Subscriptions
// ============================================================

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
      showToast(`Could not load teams: ${err.message}`, 'error', 5000);
    },
  );
}

function subscribeTeam(teamId) {
  if (!state.user || !teamId) return;
  state.walletDoc = null;
  state.ledger = [];
  state.openRequests = [];

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
      state.ledger = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

// ============================================================
// Actions
// ============================================================

async function createTeam(name) {
  if (state.busy.createTeam || !name) return;
  state.busy.createTeam = true;
  render();
  try {
    const result = await callCreateTeam({ name });
    showToast(`Team "${name}" created.`, 'success');
    document.getElementById('new-team-name').value = '';
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
      showToast('You are already a member of that team.', 'info');
    } else {
      showToast('Joined the team. Onboarding grant applied.', 'success');
    }
    document.getElementById('join-team-id').value = '';
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
    showToast(`Posted for ${result.data.coinsOffered} coins.`, 'success');
    // Reset form
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('emergency-def').value = '';
    document.getElementById('cost-preview').dataset.totalCoins = '0';
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
    showToast(`Accepted. ${result.data.coinsEscrowed} coins in escrow.`, 'success');
  } catch (err) {
    showToast(err.message, 'error', 6000);
  } finally {
    state.busy.acceptId = null;
    render();
  }
}

// ============================================================
// Rendering
// ============================================================

function render() {
  const app = document.getElementById('app');
  if (!state.authReady) {
    app.innerHTML = '<div class="loading">Loading&hellip;</div>';
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
    <div class="login">
      <section class="login-card">
        <div class="logo">V</div>
        <h1>Vacaciones</h1>
        <p class="tagline">Coverage marketplace for Google TAMs.</p>
        <p class="explainer">
          Post your time off. Earn coins by covering teammates.
          Spend coins on your own coverage. The most helpful person
          each quarter wins.
        </p>
        <button class="btn-google" data-action="sign-in" ${busy ? 'disabled' : ''}>
          ${busy ? '<span class="spinner"></span> Signing in…' : `
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Sign in with Google
          `}
        </button>
      </section>
    </div>
  `;
}

function renderHome() {
  const teams = state.myTeams;
  return `
    <section class="hero">
      <h1>Welcome, ${esc(firstName(state.user?.displayName))}</h1>
      <p>Pick a team to manage requests, or start a new one.</p>
    </section>

    <section>
      <h2>Your teams</h2>
      ${teams.length === 0 ? `
        <div class="empty-card">
          <p>You haven't joined a team yet.</p>
          <p class="muted">Use the cards below to create your own or join an existing one.</p>
        </div>
      ` : `
        <ul class="team-list">
          ${teams.map((t) => `
            <li>
              <a href="#/team/${esc(t.id)}" class="team-card">
                <div class="team-main">
                  <strong>${esc(t.name)}</strong>
                  <small>${(t.memberUids?.length || 0)} member${(t.memberUids?.length === 1 ? '' : 's')}</small>
                </div>
                <code class="team-id" title="Team ID — share to invite">${esc(t.id)}</code>
                <span class="arrow">→</span>
              </a>
            </li>
          `).join('')}
        </ul>
      `}
    </section>

    <section class="actions">
      <div class="card">
        <h3>Create a team</h3>
        <p class="muted">You become the manager. Members you invite each get 20 coins to start.</p>
        <div class="row">
          <input id="new-team-name" type="text" placeholder="Team name" maxlength="100" ${state.busy.createTeam ? 'disabled' : ''} />
          <button class="btn-primary" data-action="create-team" ${state.busy.createTeam ? 'disabled' : ''}>
            ${state.busy.createTeam ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      <div class="card">
        <h3>Join an existing team</h3>
        <p class="muted">Paste the team ID a teammate shared with you.</p>
        <div class="row">
          <input id="join-team-id" type="text" placeholder="Team ID" ${state.busy.joinTeam ? 'disabled' : ''} />
          <button class="btn-primary" data-action="join-team" ${state.busy.joinTeam ? 'disabled' : ''}>
            ${state.busy.joinTeam ? 'Joining…' : 'Join'}
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
      <div class="empty-card" style="margin-top: 3rem;">
        <h2>Team not found</h2>
        <p class="muted">You may not be a member, or the team ID is invalid.</p>
        <p><a href="#/">← Back to your teams</a></p>
      </div>
    `;
  }
  return `
    <nav class="breadcrumb">
      <a href="#/">Teams</a>
      <span class="sep">/</span>
      <span class="current">${esc(team.name)}</span>
    </nav>

    <header class="team-header">
      <h1>${esc(team.name)}</h1>
      <small>
        ${(team.memberUids?.length || 0)} member${team.memberUids?.length === 1 ? '' : 's'} ·
        ID: <code>${esc(team.id)}</code>
      </small>
    </header>

    ${renderWallet()}
    ${renderRequests()}
    ${renderCreateForm()}
  `;
}

function renderWallet() {
  const w = state.walletDoc;
  return `
    <section class="wallet-panel">
      <h2 style="margin-bottom: 0.6rem;">Your wallet</h2>
      ${w ? `
        <div class="balances">
          <div class="bucket">
            <strong>${w.earnedBalance ?? 0}</strong>
            <small>Earned</small>
          </div>
          <div class="bucket">
            <strong>${w.stipendBalance ?? 0}</strong>
            <small>Stipend</small>
            <em>expires monthly</em>
          </div>
          <div class="bucket total">
            <strong>${(w.earnedBalance ?? 0) + (w.stipendBalance ?? 0)}</strong>
            <small>Total</small>
          </div>
        </div>
      ` : `<p class="muted" style="margin: 0 0 0.6rem;">No wallet activity yet.</p>`}

      <h3 style="margin: 1rem 0 0.5rem; font-size: 0.95rem;">Recent activity</h3>
      ${state.ledger.length === 0 ? `
        <p class="muted">No ledger entries yet.</p>
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
    </section>
  `;
}

function renderRequests() {
  const reqs = state.openRequests;
  return `
    <section>
      <div class="section-head">
        <h2>Open coverage requests</h2>
      </div>
      ${reqs.length === 0 ? `
        <div class="empty-card">
          <p>No open requests in this team yet.</p>
          <small class="muted">Post one below — your teammates earn coins by covering you.</small>
        </div>
      ` : `
        <ul class="requests">
          ${reqs.map((r) => {
            const mine = r.requesterUid === state.user.uid;
            const reachLabel = REACHABILITY_OPTIONS.find((o) => o.value === r.reachability)?.label ?? r.reachability;
            return `
              <li>
                <div class="dates">
                  <strong>${esc(formatDate(r.windowStart?.toDate()))} → ${esc(formatDate(r.windowEnd?.toDate()))}</strong>
                  <small>${esc(r.timezone)} · ${esc(reachLabel)}</small>
                </div>
                <div class="sla" title="${esc(r.sla)}">${esc(r.sla)}</div>
                <div class="price">
                  <strong>${r.totalCoinsOffered}</strong>
                  <small>coins</small>
                </div>
                ${mine
                  ? `<span class="own">Your request</span>`
                  : `<button class="btn-outline" data-action="accept" data-id="${esc(r.id)}" ${state.busy.acceptId === r.id ? 'disabled' : ''}>
                       ${state.busy.acceptId === r.id ? 'Accepting…' : 'Cover this'}
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
    <section class="create-card">
      <div class="section-head">
        <h2>Post a coverage request</h2>
        <small>${ECONOMY.WEEKEND_MULTIPLIER}x multiplier on Saturdays and Sundays</small>
      </div>
      <form id="create-form" autocomplete="off">
        <div class="form-grid">
          <label>
            <span>Window start (date)</span>
            <input type="date" id="start-date" name="startDate" />
          </label>
          <label>
            <span>Window end (date)</span>
            <input type="date" id="end-date" name="endDate" />
          </label>
          <label>
            <span>Timezone</span>
            <input type="text" id="timezone" name="timezone" value="${esc(tz)}" />
          </label>
          <label>
            <span>Reachability</span>
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
            <span>Emergency definition (optional)</span>
            <textarea id="emergency-def" name="emergencyDef" rows="2" placeholder="What counts as actually waking me up"></textarea>
          </label>
        </div>
        <div class="preview-row">
          <div id="cost-preview" class="preview" data-total-coins="0">
            <small class="muted">Pick a window to preview the cost.</small>
          </div>
          <button type="submit" class="btn-primary btn-large" ${state.busy.postRequest ? 'disabled' : ''}>
            ${state.busy.postRequest ? 'Posting…' : 'Post request'}
          </button>
        </div>
      </form>
    </section>
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
        <span>coins</span>
      </div>
      <small>
        ${cost.days} day${cost.days === 1 ? '' : 's'} ·
        ${cost.weekdays} weekday, ${cost.weekendDays} weekend
      </small>
    `;
  } else {
    previewEl.innerHTML = `<small class="muted">Pick a window to preview the cost.</small>`;
  }
}

// ============================================================
// Event delegation
// ============================================================

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
    await joinTeam(input.value.trim());
  } else if (action === 'accept') {
    e.preventDefault();
    await acceptRequest(t.dataset.id);
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

// ============================================================
// Bootstrap
// ============================================================

render();
