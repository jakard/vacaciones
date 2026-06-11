import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ECONOMY } from '../_shared';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntry } from '../services/wallet';

// Accepts an invite token (`tk_...`). The legacy `teamId` field is still
// parsed so old clients get a *helpful* error instead of a schema one —
// raw crew IDs are no longer a join credential (launch-gate item 6).
const JoinTeamSchema = z.object({
  token: z.string().trim().min(1).optional(),
  teamId: z.string().trim().min(1).optional(),
});

interface JoinTeamResult {
  teamId: string;
  alreadyMember: boolean;
}

export const joinTeam = onCall<unknown, Promise<JoinTeamResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const parsed = JoinTeamSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const raw = parsed.data.token ?? parsed.data.teamId;
    if (!raw) {
      throw new HttpsError('invalid-argument', 'An invite link is required.');
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    const result = await db.runTransaction(async (tx) => {
      // ---- Resolve the credential to a team -------------------------
      const tokenRef = db.doc(`inviteTokens/${raw}`);
      const tokenSnap = await tx.get(tokenRef);

      if (!tokenSnap.exists) {
        // Old links shared the raw team doc-id. Give those a clear,
        // actionable rejection rather than "not found".
        const legacyTeam = await tx.get(db.doc(`teams/${raw}`));
        if (legacyTeam.exists) {
          throw new HttpsError(
            'failed-precondition',
            'This invite link is outdated. Ask a crew manager for a fresh one (Crew tab → Share invite).',
          );
        }
        throw new HttpsError('not-found', 'Invalid invite link.');
      }

      const token = tokenSnap.data() as {
        teamId: string;
        expiresAt?: Timestamp;
        maxUses?: number;
        uses?: number;
        revoked?: boolean;
      };
      if (token.revoked) {
        throw new HttpsError(
          'failed-precondition',
          'This invite link was revoked. Ask a crew manager for a fresh one.',
        );
      }
      if (token.expiresAt && token.expiresAt.toMillis() < Date.now()) {
        throw new HttpsError(
          'failed-precondition',
          'This invite link expired. Ask a crew manager for a fresh one.',
        );
      }
      const maxUses = token.maxUses ?? 25;
      const uses = token.uses ?? 0;
      if (uses >= maxUses) {
        throw new HttpsError(
          'failed-precondition',
          'This invite link reached its use limit. Ask a crew manager for a fresh one.',
        );
      }

      const teamId = token.teamId;
      const teamRef = db.doc(`teams/${teamId}`);
      const memberRef = teamRef.collection('members').doc(uid);
      const userRef = db.doc(`users/${uid}`);

      // ---- Join ------------------------------------------------------
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists) {
        throw new HttpsError('not-found', 'Crew no longer exists.');
      }

      const memberSnap = await tx.get(memberRef);
      if (memberSnap.exists) return { teamId, alreadyMember: true };

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
        invitedVia: raw,
      });

      tx.update(tokenRef, { uses: FieldValue.increment(1) });

      return { teamId, alreadyMember: false };
    });

    return result;
  },
);
