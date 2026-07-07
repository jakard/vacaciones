import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { computeCoverageCost } from '../_shared';

import { CALLABLE_OPTS } from '../options';
import { IMPLICIT_ACCOUNT_ID, cellsCost, type Cell } from '../services/cells';

const REACHABILITY = [
  'unreachable',
  'email-only-emergencies',
  'phone-emergencies',
  'daily-check-in',
] as const;

const COVERAGE_KIND = [
  'inbox',
  'meetings',
  'escalations',
  'one-on-ones',
  'chat',
  'on-call',
] as const;

const MeetingSchema = z.object({
  googleEventId: z.string().min(1).max(200),
  summary: z.string().max(300),
  description: z.string().max(2000).optional(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  location: z.string().max(500).optional(),
  hangoutLink: z.string().max(500).optional(),
  htmlLink: z.string().max(500).optional(),
  conferenceLinks: z.array(z.string().max(500)).max(10).optional(),
  attendees: z
    .array(z.object({ email: z.string().max(200), displayName: z.string().max(200).optional() }))
    .max(50)
    .optional(),
});

const COVERAGE_MODE = ['single', 'crew'] as const;

const ACCOUNT_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const AccountSchema = z.object({
  id: z.string().regex(ACCOUNT_ID_RE),
  name: z.string().trim().min(1).max(80),
});

const CellSchema = z.object({
  accountId: z.string().regex(ACCOUNT_ID_RE),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const CreateCoverageRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  windowStartIso: z.string().datetime(),
  windowEndIso: z.string().datetime(),
  timezone: z.string().trim().min(1),
  // Accounts this OOO needs covered (the poster's book of business snapshot)
  // and the billable (account × day) cells. New clients always send these.
  accounts: z.array(AccountSchema).min(1).max(50).optional(),
  cells: z.array(CellSchema).min(1).max(2000).optional(),
  // Legacy: YYYY-MM-DD keys for the specific days the coverer needs to be on
  // the hook. Used only when accounts/cells are absent (old clients).
  selectedDayKeys: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(366).optional(),
  // 'single' = one coverer takes everything. 'crew' = multiple coverers
  // can each claim a subset of cells. Default 'single' for back-compat.
  coverageMode: z.enum(COVERAGE_MODE).optional(),
  reachability: z.array(z.enum(REACHABILITY)).min(1).max(REACHABILITY.length),
  coverageKinds: z.array(z.enum(COVERAGE_KIND)).max(COVERAGE_KIND.length).optional(),
  coverageScope: z.string().trim().max(500).nullable().optional(),
  sla: z.string().trim().min(1).max(200),
  emergencyDef: z.string().max(500).nullable().optional(),
  meetings: z.array(MeetingSchema).max(50).optional(),
});

function formatDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function allDaysInWindow(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor.getTime() <= last.getTime()) {
    out.push(formatDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

interface CreateCoverageRequestResult {
  requestId: string;
  coinsOffered: number;
}

export const createCoverageRequest = onCall<
  unknown,
  Promise<CreateCoverageRequestResult>
>(CALLABLE_OPTS, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const parsed = CreateCoverageRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }

  const {
    teamId,
    windowStartIso,
    windowEndIso,
    timezone,
    reachability,
    coverageKinds,
    coverageScope,
    sla,
    emergencyDef,
    meetings,
    accounts,
    cells,
    selectedDayKeys,
    coverageMode,
  } = parsed.data;
  const token = request.auth.token;
  const mode = coverageMode ?? 'single';

  const start = new Date(windowStartIso);
  const end = new Date(windowEndIso);
  if (end <= start) {
    throw new HttpsError(
      'invalid-argument',
      'windowEnd must be after windowStart.',
    );
  }
  // Validate IANA timezone — Intl throws on unknown zones.
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    throw new HttpsError('invalid-argument', `Invalid timezone: ${timezone}`);
  }

  // Resolve the billable (account × day) cells. New clients send explicit
  // accounts + cells; legacy clients send selectedDayKeys (or nothing), which
  // maps to a single implicit account covering those days.
  const allKeys = allDaysInWindow(start, end);
  const inWindow = new Set(allKeys);
  const usingAccounts = !!(accounts && accounts.length && cells && cells.length);

  let finalAccounts: Array<{ id: string; name: string }>;
  let finalCells: Cell[];

  if (usingAccounts) {
    const accountIds = new Set(accounts!.map((a) => a.id));
    if (accountIds.size !== accounts!.length) {
      throw new HttpsError('invalid-argument', 'Duplicate account ids.');
    }
    const seen = new Set<string>();
    finalCells = [];
    for (const c of cells!) {
      if (!accountIds.has(c.accountId)) {
        throw new HttpsError(
          'invalid-argument',
          `Cell references unknown account ${c.accountId}.`,
        );
      }
      if (!inWindow.has(c.dayKey)) continue; // drop out-of-window cells
      const k = `${c.accountId}__${c.dayKey}`;
      if (seen.has(k)) continue; // de-dupe
      seen.add(k);
      finalCells.push({ accountId: c.accountId, dayKey: c.dayKey });
    }
    finalAccounts = accounts!.map((a) => ({ id: a.id, name: a.name.trim() }));
  } else {
    const billableKeys =
      selectedDayKeys && selectedDayKeys.length > 0
        ? selectedDayKeys.filter((k) => inWindow.has(k))
        : allKeys;
    finalAccounts = [{ id: IMPLICIT_ACCOUNT_ID, name: '' }];
    finalCells = billableKeys.map((dayKey) => ({
      accountId: IMPLICIT_ACCOUNT_ID,
      dayKey,
    }));
  }

  if (finalCells.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one account-day must be selected.');
  }

  const coinsOffered = cellsCost(finalCells);
  const distinctDayKeys = [...new Set(finalCells.map((c) => c.dayKey))].sort();

  // Legacy sanity check: for a plain "all days, one implicit account" bounty
  // the shared helper must agree with the per-cell sum.
  if (!usingAccounts && (!selectedDayKeys || selectedDayKeys.length === 0)) {
    const fromHelper = computeCoverageCost(start, end);
    if (fromHelper.totalCoins !== coinsOffered) {
      throw new HttpsError('internal', 'Cost calc mismatch.');
    }
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const teamRef = db.doc(`teams/${teamId}`);
  const memberRef = teamRef.collection('members').doc(uid);
  const walletRef = teamRef.collection('wallets').doc(uid);
  const requestRef = teamRef.collection('coverageRequests').doc();

  await db.runTransaction(async (tx) => {
    const [memberSnap, walletSnap] = await Promise.all([
      tx.get(memberRef),
      tx.get(walletRef),
    ]);

    if (!memberSnap.exists) {
      throw new HttpsError('permission-denied', 'Not a member of this team.');
    }

    const wallet = walletSnap.exists ? walletSnap.data() : null;
    const total =
      (wallet?.['earnedBalance'] ?? 0) + (wallet?.['stipendBalance'] ?? 0);
    if (total < coinsOffered) {
      throw new HttpsError(
        'failed-precondition',
        `Insufficient coins (need ${coinsOffered}, have ${total}).`,
      );
    }

    tx.create(requestRef, {
      requesterUid: uid,
      requesterDisplayName: token.name ?? token.email ?? '',
      requesterPhotoURL: token.picture ?? null,
      covererUid: null,
      covererDisplayName: null,
      covererPhotoURL: null,
      windowStart: Timestamp.fromDate(start),
      windowEnd: Timestamp.fromDate(end),
      timezone,
      reachability,
      coverageKinds: coverageKinds ?? [],
      coverageScope: coverageScope?.trim() ? coverageScope.trim() : null,
      coverageMode: mode,
      accounts: finalAccounts,
      cells: finalCells,
      cellCoverers: {},
      selectedDayKeys: distinctDayKeys,
      dayCoverers: {},
      coverers: [],
      meetings: meetings ?? [],
      sla,
      emergencyDef: emergencyDef ?? null,
      status: 'open',
      totalCoinsOffered: coinsOffered,
      coinsEscrowed: 0,
      coinsReleased: 0,
      briefingId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { requestId: requestRef.id, coinsOffered };
});
