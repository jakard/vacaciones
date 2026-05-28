import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ECONOMY } from '@vacaciones/shared';

import { recordLedgerEntry } from '../services/wallet';

const JoinTeamSchema = z.object({
  teamId: z.string().trim().min(1),
});

interface JoinTeamResult {
  teamId: string;
  alreadyMember: boolean;
}

export const joinTeam = onCall<unknown, Promise<JoinTeamResult>>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const parsed = JoinTeamSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }

    const uid = request.auth.uid;
    const teamId = parsed.data.teamId;
    const db = getFirestore();
    const teamRef = db.doc(`teams/${teamId}`);
    const memberRef = teamRef.collection('members').doc(uid);
    const userRef = db.doc(`users/${uid}`);

    const alreadyMember = await db.runTransaction(async (tx) => {
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists) {
        throw new HttpsError('not-found', 'Team not found.');
      }

      const memberSnap = await tx.get(memberRef);
      if (memberSnap.exists) return true;

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

      tx.update(teamRef, {
        memberUids: FieldValue.arrayUnion(uid),
      });

      tx.create(memberRef, {
        uid,
        role: 'member',
        joinedAt: FieldValue.serverTimestamp(),
        onboardingGrantReceivedAt: FieldValue.serverTimestamp(),
      });

      return false;
    });

    return { teamId, alreadyMember };
  },
);
