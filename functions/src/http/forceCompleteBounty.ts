import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntry } from '../services/wallet';
import { ECONOMY } from '../_shared';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
});

interface ForceCompleteResult {
  completed: boolean;
}

export const forceCompleteBounty = onCall<unknown, Promise<ForceCompleteResult>>(
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

    await db.runTransaction(async (tx) => {
      const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
      const requestRef = db.doc(`teams/${teamId}/coverageRequests/${requestId}`);
      const [memberSnap, reqSnap] = await Promise.all([
        tx.get(memberRef),
        tx.get(requestRef),
      ]);
      if (!memberSnap.exists || (memberSnap.data() as { role?: string })?.role !== 'manager') {
        throw new HttpsError('permission-denied', 'Only managers can force-complete a bounty.');
      }
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Bounty not found.');
      }
      const req = reqSnap.data() as {
        status: string;
        covererUid?: string | null;
        requesterUid: string;
      };
      if (req.status === 'completed') {
        throw new HttpsError('failed-precondition', 'Already completed.');
      }
      if (req.status === 'cancelled') {
        throw new HttpsError('failed-precondition', 'Cancelled — use the appropriate action.');
      }

      const feeBurnUid = req.covererUid ?? req.requesterUid;
      await recordLedgerEntry({
        tx,
        db,
        teamId,
        uid: feeBurnUid,
        type: 'feeBurn',
        amountSigned: -ECONOMY.TRANSACTION_FEE,
        balanceBucket: 'earned',
        relatedRequestId: requestId,
        idempotencyKey: `${requestId}_feeBurn`,
      });

      tx.update(requestRef, {
        status: 'completed',
        forceCompletedByUid: uid,
        forceCompletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const auditRef = db.collection(`teams/${teamId}/auditLog`).doc();
      tx.set(auditRef, {
        action: 'forceCompleteBounty',
        actorUid: uid,
        target: requestId,
        details: { previousStatus: req.status },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { completed: true };
  },
);
