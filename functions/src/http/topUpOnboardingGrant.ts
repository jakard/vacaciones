import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntry } from '../services/wallet';
import { ECONOMY } from '../_shared';

const Schema = z.object({
  teamId: z.string().trim().min(1),
});

interface TopUpResult {
  toppedUpCount: number;
  totalToppedUp: number;
  perUser: number;
}

const ORIGINAL_GRANT = 20;
const TOP_UP_AMOUNT = ECONOMY.ONBOARDING_GRANT - ORIGINAL_GRANT;

export const topUpOnboardingGrant = onCall<unknown, Promise<TopUpResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (
      !memberSnap.exists ||
      (memberSnap.data() as { role?: string } | undefined)?.role !== 'manager'
    ) {
      throw new HttpsError(
        'permission-denied',
        'Only the crew manager can top up the onboarding grant.',
      );
    }

    if (TOP_UP_AMOUNT <= 0) {
      return { toppedUpCount: 0, totalToppedUp: 0, perUser: 0 };
    }

    const membersSnap = await db.collection(`teams/${teamId}/members`).get();
    let toppedUpCount = 0;

    for (const m of membersSnap.docs) {
      const memberData = m.data() as { onboardingGrantReceivedAt?: unknown };
      if (!memberData.onboardingGrantReceivedAt) continue;
      const memberUid = m.id;
      const supplementKey = `onboardingGrantSupplement_${memberUid}`;
      const result = await db.runTransaction(async (tx) => {
        return recordLedgerEntry({
          tx,
          db,
          teamId,
          uid: memberUid,
          type: 'grant',
          amountSigned: TOP_UP_AMOUNT,
          balanceBucket: 'earned',
          relatedRequestId: null,
          idempotencyKey: supplementKey,
        });
      });
      if (result.applied) toppedUpCount++;
    }

    // Write audit log entry (best-effort, non-blocking semantics)
    await db.collection(`teams/${teamId}/auditLog`).add({
      action: 'topUpOnboardingGrant',
      actorUid: uid,
      target: teamId,
      details: { perUser: TOP_UP_AMOUNT, toppedUpCount },
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      toppedUpCount,
      totalToppedUp: toppedUpCount * TOP_UP_AMOUNT,
      perUser: TOP_UP_AMOUNT,
    };
  },
);
