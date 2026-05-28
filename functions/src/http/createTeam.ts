import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ECONOMY } from '../_shared';

import { recordLedgerEntry } from '../services/wallet';

const CreateTeamSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

interface CreateTeamResult {
  teamId: string;
}

export const createTeam = onCall<unknown, Promise<CreateTeamResult>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const parsed = CreateTeamSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }

    const uid = request.auth.uid;
    const db = getFirestore();
    const teamRef = db.collection('teams').doc();
    const teamId = teamRef.id;
    const memberRef = teamRef.collection('members').doc(uid);
    const userRef = db.doc(`users/${uid}`);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError(
          'failed-precondition',
          'User profile not initialized.',
        );
      }

      await recordLedgerEntry({
        tx,
        db,
        teamId,
        uid,
        type: 'grant',
        amountSigned: ECONOMY.ONBOARDING_GRANT,
        balanceBucket: 'earned',
        relatedRequestId: null,
        idempotencyKey: `onboardingGrant_${uid}`,
      });

      tx.create(teamRef, {
        name: parsed.data.name,
        ownerUid: uid,
        memberUids: [uid],
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.create(memberRef, {
        uid,
        role: 'manager',
        joinedAt: FieldValue.serverTimestamp(),
        onboardingGrantReceivedAt: FieldValue.serverTimestamp(),
      });
    });

    return { teamId };
  },
);
