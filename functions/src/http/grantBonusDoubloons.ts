import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntry } from '../services/wallet';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  targetUid: z.string().trim().min(1),
  amount: z.number().int().min(1).max(500),
  reason: z.string().trim().min(3).max(280),
});

interface GrantResult {
  granted: boolean;
  amount: number;
}

export const grantBonusDoubloons = onCall<unknown, Promise<GrantResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, targetUid, amount, reason } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const callerMemberSnap = await db
      .doc(`teams/${teamId}/members/${uid}`)
      .get();
    if (
      !callerMemberSnap.exists ||
      (callerMemberSnap.data() as { role?: string } | undefined)?.role !== 'manager'
    ) {
      throw new HttpsError(
        'permission-denied',
        'Only managers can grant bonus doubloons.',
      );
    }
    const targetMemberSnap = await db
      .doc(`teams/${teamId}/members/${targetUid}`)
      .get();
    if (!targetMemberSnap.exists) {
      throw new HttpsError('not-found', 'Target crewmate not in this crew.');
    }

    // Deterministic-enough idempotency key — manager could repeat a grant
    // intentionally for a different reason, so we include reason hash + ms.
    const stamp = Date.now();
    const idempotencyKey = `bonus_${uid}_${targetUid}_${stamp}`;

    await db.runTransaction(async (tx) => {
      await recordLedgerEntry({
        tx,
        db,
        teamId,
        uid: targetUid,
        type: 'managerAdvance',
        amountSigned: amount,
        balanceBucket: 'earned',
        relatedRequestId: null,
        idempotencyKey,
      });

      const auditRef = db.collection(`teams/${teamId}/auditLog`).doc();
      tx.set(auditRef, {
        action: 'grantBonusDoubloons',
        actorUid: uid,
        target: targetUid,
        details: { amount, reason: reason.slice(0, 280) },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { granted: true, amount };
  },
);
