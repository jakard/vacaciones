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

const CreateCoverageRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  windowStartIso: z.string().datetime(),
  windowEndIso: z.string().datetime(),
  timezone: z.string().trim().min(1),
  reachability: z.array(z.enum(REACHABILITY)).min(1).max(REACHABILITY.length),
  coverageKinds: z.array(z.enum(COVERAGE_KIND)).max(COVERAGE_KIND.length).optional(),
  coverageScope: z.string().trim().max(500).nullable().optional(),
  sla: z.string().trim().min(1).max(200),
  emergencyDef: z.string().max(500).nullable().optional(),
  meetings: z.array(MeetingSchema).max(50).optional(),
});

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
  } = parsed.data;
  const token = request.auth.token;

  const start = new Date(windowStartIso);
  const end = new Date(windowEndIso);
  if (end <= start) {
    throw new HttpsError(
      'invalid-argument',
      'windowEnd must be after windowStart.',
    );
  }

  const { totalCoins: coinsOffered, days } = computeCoverageCost(start, end);
  if (days === 0) {
    throw new HttpsError('invalid-argument', 'Window must cover at least one day.');
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
