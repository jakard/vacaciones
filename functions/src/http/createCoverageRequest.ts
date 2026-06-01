import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { computeCoverageCost } from '../_shared';

import { CALLABLE_OPTS } from '../options';

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

const CreateCoverageRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  windowStartIso: z.string().datetime(),
  windowEndIso: z.string().datetime(),
  timezone: z.string().trim().min(1),
  // YYYY-MM-DD keys for the specific days the coverer needs to be on the
  // hook. Optional — if omitted, falls back to every day in the window.
  selectedDayKeys: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(366).optional(),
  // 'single' = one coverer takes all days. 'crew' = multiple coverers
  // can each claim a subset of days. Default 'single' for back-compat.
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

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dayCost(d: Date): number {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6 ? 10 : 5;
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

  // Determine which days are billable. Default = every day in the window.
  const allKeys = allDaysInWindow(start, end);
  const billableKeys =
    selectedDayKeys && selectedDayKeys.length > 0
      ? selectedDayKeys.filter((k) => allKeys.includes(k))
      : allKeys;

  if (billableKeys.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one day must be selected.');
  }

  const coinsOffered = billableKeys.reduce((sum, k) => sum + dayCost(parseDateKey(k)), 0);

  // Keep the shared helper around as a sanity check for "all-days" cases.
  if (!selectedDayKeys || selectedDayKeys.length === 0) {
    const fromHelper = computeCoverageCost(start, end);
    if (fromHelper.totalCoins !== coinsOffered) {
      // Should never happen; keeps the legacy contract intact.
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
      selectedDayKeys: billableKeys,
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
