import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { recordLedgerEntry } from '../services/wallet';

const AcceptSchema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
});

interface AcceptResult {
  accepted: boolean;
  coinsEscrowed: number;
}

export const acceptCoverageRequest = onCall<unknown, Promise<AcceptResult>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = AcceptSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }

    const { teamId, requestId } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const requestRef = db.doc(`teams/${teamId}/coverageRequests/${requestId}`);
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);

    const coinsEscrowed = await db.runTransaction(async (tx) => {
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
      };

      if (req.status !== 'open') {
        throw new HttpsError(
          'failed-precondition',
          `Request is ${req.status}, cannot accept.`,
        );
      }
      if (req.requesterUid === uid) {
        throw new HttpsError(
          'failed-precondition',
          'You cannot cover your own request.',
        );
      }

      const requesterUid = req.requesterUid;
      const amount = req.totalCoinsOffered;
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

      // Spend stipend first (use-it-or-lose-it), then earned.
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

      tx.update(requestRef, {
        covererUid: uid,
        status: 'accepted',
        coinsEscrowed: amount,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return amount;
    });

    return { accepted: true, coinsEscrowed };
  },
);
