import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntry } from '../services/wallet';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
});

interface CancelResult {
  cancelled: boolean;
  refunded: number;
}

export const cancelBounty = onCall<unknown, Promise<CancelResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, requestId } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const requestRef = db.doc(`teams/${teamId}/coverageRequests/${requestId}`);
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);

    const refunded = await db.runTransaction(async (tx) => {
      const [reqSnap, memberSnap] = await Promise.all([
        tx.get(requestRef),
        tx.get(memberRef),
      ]);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Bounty not found.');
      }
      if (!memberSnap.exists) {
        throw new HttpsError('permission-denied', 'Not in this crew.');
      }
      const req = reqSnap.data() as {
        status: string;
        requesterUid: string;
        coinsEscrowed?: number;
        coinsReleased?: number;
      };
      const role = (memberSnap.data() as { role?: string } | undefined)?.role;

      if (req.status === 'cancelled') {
        throw new HttpsError('failed-precondition', 'Already cancelled.');
      }
      if (req.status === 'completed') {
        throw new HttpsError(
          'failed-precondition',
          'Cannot cancel a completed bounty.',
        );
      }

      const isRequester = req.requesterUid === uid;
      const isManager = role === 'manager';
      if (!isRequester && !isManager) {
        throw new HttpsError(
          'permission-denied',
          'Only the requester or a manager can cancel a bounty.',
        );
      }

      const escrowed = req.coinsEscrowed ?? 0;
      const released = req.coinsReleased ?? 0;
      const remaining = Math.max(0, escrowed - released);

      if (remaining > 0) {
        await recordLedgerEntry({
          tx,
          db,
          teamId,
          uid: req.requesterUid,
          type: 'escrowOut',
          amountSigned: remaining,
          balanceBucket: 'earned',
          relatedRequestId: requestId,
          idempotencyKey: `${requestId}_cancel_refund`,
        });
      }

      tx.update(requestRef, {
        status: 'cancelled',
        cancelledByUid: uid,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return remaining;
    });

    return { cancelled: true, refunded };
  },
);
