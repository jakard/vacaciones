import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntry } from '../services/wallet';

const AcceptSchema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
  // Optional — crew-mode coverers can claim a subset of days. If omitted,
  // claim everything that's still unclaimed (single-mode behaviour).
  dayKeysToClaim: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(366)
    .optional(),
});

interface AcceptResult {
  accepted: boolean;
  coinsEscrowed: number;
  claimedDayKeys: string[];
  allClaimed: boolean;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function dayCost(d: Date): number {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6 ? 10 : 5;
}

export const acceptCoverageRequest = onCall<unknown, Promise<AcceptResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = AcceptSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }

    const { teamId, requestId, dayKeysToClaim } = parsed.data;
    const uid = request.auth.uid;
    const token = request.auth.token;
    const db = getFirestore();

    const requestRef = db.doc(`teams/${teamId}/coverageRequests/${requestId}`);
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const [reqSnap, memberSnap] = await Promise.all([
        tx.get(requestRef),
        tx.get(memberRef),
      ]);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Coverage request not found.');
      }
      if (!memberSnap.exists) {
        throw new HttpsError('permission-denied', 'Not a member of this team.');
      }

      const req = reqSnap.data() as {
        status: string;
        requesterUid: string;
        totalCoinsOffered: number;
        coverageMode?: 'single' | 'crew';
        selectedDayKeys?: string[];
        dayCoverers?: Record<string, {
          uid: string;
          displayName: string;
          photoURL: string | null;
        }>;
        coverers?: Array<{
          uid: string;
          displayName: string;
          photoURL: string | null;
        }>;
        coinsEscrowed?: number;
      };

      if (req.status === 'cancelled') {
        throw new HttpsError('failed-precondition', 'Bounty was cancelled.');
      }
      if (req.status === 'completed') {
        throw new HttpsError('failed-precondition', 'Bounty already completed.');
      }
      if (req.requesterUid === uid) {
        throw new HttpsError(
          'failed-precondition',
          'You cannot cover your own bounty.',
        );
      }

      const mode = req.coverageMode ?? 'single';
      const allDayKeys = req.selectedDayKeys ?? [];
      const dayCoverers = req.dayCoverers ?? {};

      if (mode === 'single') {
        // Existing behaviour — single coverer claims everything
        if (req.status !== 'open') {
          throw new HttpsError(
            'failed-precondition',
            `Bounty is ${req.status}, cannot accept.`,
          );
        }

        const amount = req.totalCoinsOffered;
        const requesterUid = req.requesterUid;
        const requesterWalletRef = db.doc(
          `teams/${teamId}/wallets/${requesterUid}`,
        );
        const requesterWalletSnap = await tx.get(requesterWalletRef);
        const requesterWallet = requesterWalletSnap.exists
          ? (requesterWalletSnap.data() as {
              earnedBalance: number;
              stipendBalance: number;
            })
          : { earnedBalance: 0, stipendBalance: 0 };

        const totalBalance =
          requesterWallet.earnedBalance + requesterWallet.stipendBalance;
        if (totalBalance < amount) {
          throw new HttpsError(
            'failed-precondition',
            `Requester has insufficient coins (have ${totalBalance}, need ${amount}).`,
          );
        }

        const fromStipend = Math.min(requesterWallet.stipendBalance, amount);
        const fromEarned = amount - fromStipend;

        if (fromStipend > 0) {
          await recordLedgerEntry({
            tx,
            db,
            teamId,
            uid: requesterUid,
            type: 'escrowIn',
            amountSigned: -fromStipend,
            balanceBucket: 'stipend',
            relatedRequestId: requestId,
            idempotencyKey: `${requestId}_escrow_stipend`,
          });
        }
        if (fromEarned > 0) {
          await recordLedgerEntry({
            tx,
            db,
            teamId,
            uid: requesterUid,
            type: 'escrowIn',
            amountSigned: -fromEarned,
            balanceBucket: 'earned',
            relatedRequestId: requestId,
            idempotencyKey: `${requestId}_escrow_earned`,
          });
        }

        const coverer = {
          uid,
          displayName: token.name ?? token.email ?? '',
          photoURL: token.picture ?? null,
        };
        const allCoverersMap: Record<string, typeof coverer> = {};
        for (const k of allDayKeys) allCoverersMap[k] = coverer;

        tx.update(requestRef, {
          covererUid: uid,
          covererDisplayName: coverer.displayName,
          covererPhotoURL: coverer.photoURL,
          coverers: [coverer],
          dayCoverers: allCoverersMap,
          status: 'accepted',
          coinsEscrowed: amount,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return {
          accepted: true,
          coinsEscrowed: amount,
          claimedDayKeys: allDayKeys,
          allClaimed: true,
        };
      }

      // CREW MODE
      // Determine which days this coverer is claiming
      const remainingDays = allDayKeys.filter((k) => !dayCoverers[k]);
      if (remainingDays.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          'All days are already claimed.',
        );
      }
      const dayKeysToTake =
        dayKeysToClaim && dayKeysToClaim.length > 0
          ? dayKeysToClaim
          : remainingDays;
      // Validate every requested day is in the bounty and unclaimed
      for (const k of dayKeysToTake) {
        if (!allDayKeys.includes(k)) {
          throw new HttpsError(
            'invalid-argument',
            `Day ${k} is not part of this bounty.`,
          );
        }
        if (dayCoverers[k]) {
          throw new HttpsError(
            'failed-precondition',
            `Day ${k} is already claimed by another crewmate.`,
          );
        }
      }

      // Compute the claim's portion of the total cost
      const claimCost = dayKeysToTake.reduce(
        (sum, k) => sum + dayCost(parseDateKey(k)),
        0,
      );

      // Debit requester for this claim's portion
      const requesterUid = req.requesterUid;
      const requesterWalletRef = db.doc(
        `teams/${teamId}/wallets/${requesterUid}`,
      );
      const requesterWalletSnap = await tx.get(requesterWalletRef);
      const requesterWallet = requesterWalletSnap.exists
        ? (requesterWalletSnap.data() as {
            earnedBalance: number;
            stipendBalance: number;
          })
        : { earnedBalance: 0, stipendBalance: 0 };

      const totalBalance =
        requesterWallet.earnedBalance + requesterWallet.stipendBalance;
      if (totalBalance < claimCost) {
        throw new HttpsError(
          'failed-precondition',
          `Requester is out of doubloons for this claim (have ${totalBalance}, need ${claimCost}).`,
        );
      }

      const fromStipend = Math.min(requesterWallet.stipendBalance, claimCost);
      const fromEarned = claimCost - fromStipend;
      const sortedFirstDay = dayKeysToTake.slice().sort()[0];

      if (fromStipend > 0) {
        await recordLedgerEntry({
          tx,
          db,
          teamId,
          uid: requesterUid,
          type: 'escrowIn',
          amountSigned: -fromStipend,
          balanceBucket: 'stipend',
          relatedRequestId: requestId,
          idempotencyKey: `${requestId}_escrow_${uid}_${sortedFirstDay}_stipend`,
        });
      }
      if (fromEarned > 0) {
        await recordLedgerEntry({
          tx,
          db,
          teamId,
          uid: requesterUid,
          type: 'escrowIn',
          amountSigned: -fromEarned,
          balanceBucket: 'earned',
          relatedRequestId: requestId,
          idempotencyKey: `${requestId}_escrow_${uid}_${sortedFirstDay}_earned`,
        });
      }

      // Build updated dayCoverers map and coverers list
      const coverer = {
        uid,
        displayName: token.name ?? token.email ?? '',
        photoURL: token.picture ?? null,
      };
      const nextDayCoverers: Record<string, typeof coverer> = { ...dayCoverers };
      for (const k of dayKeysToTake) nextDayCoverers[k] = coverer;

      const existingCoverers = req.coverers ?? [];
      const hasAlready = existingCoverers.some((c) => c.uid === uid);
      const nextCoverers = hasAlready
        ? existingCoverers
        : [...existingCoverers, coverer];

      const allClaimed = allDayKeys.every((k) => nextDayCoverers[k]);
      const nextEscrowed = (req.coinsEscrowed ?? 0) + claimCost;

      tx.update(requestRef, {
        coverers: nextCoverers,
        dayCoverers: nextDayCoverers,
        coinsEscrowed: nextEscrowed,
        status: allClaimed ? 'accepted' : 'open',
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        accepted: true,
        coinsEscrowed: claimCost,
        claimedDayKeys: dayKeysToTake,
        allClaimed,
      };
    });

    return result;
  },
);
