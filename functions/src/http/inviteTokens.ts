import { randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

/**
 * Invite tokens — launch-gate item 6. The shareable invite is a rotating,
 * expiring, capped-use token (`tk_...`) stored in the admin-only
 * top-level /inviteTokens collection. The Firestore doc-id of the team
 * is no longer accepted as a join credential: it is permanent, leaks in
 * URLs/screenshots, and grants a 125-doubloon onboarding mint to anyone
 * who learns it.
 */

const TOKEN_TTL_DAYS = 14;
const TOKEN_MAX_USES = 25;

const CreateSchema = z.object({
  teamId: z.string().trim().min(1),
});

interface CreateInviteTokenResult {
  token: string;
  expiresAtMs: number;
  maxUses: number;
}

export const createInviteToken = onCall<unknown, Promise<CreateInviteTokenResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = CreateSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (
      !memberSnap.exists ||
      (memberSnap.data() as { role?: string })?.role !== 'manager'
    ) {
      throw new HttpsError('permission-denied', 'Only managers can create invite links.');
    }

    // Single-active-link semantics: a new link revokes all prior ones for
    // this crew, so a leaked screenshot has a clear remediation (regenerate).
    const activeSnap = await db
      .collection('inviteTokens')
      .where('teamId', '==', teamId)
      .where('revoked', '==', false)
      .get();

    const token = `tk_${randomBytes(18).toString('base64url')}`;
    const expiresAt = Timestamp.fromMillis(
      Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const batch = db.batch();
    for (const doc of activeSnap.docs) {
      batch.update(doc.ref, { revoked: true, revokedAt: FieldValue.serverTimestamp() });
    }
    batch.set(db.doc(`inviteTokens/${token}`), {
      teamId,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      maxUses: TOKEN_MAX_USES,
      uses: 0,
      revoked: false,
    });
    const auditRef = db.collection(`teams/${teamId}/auditLog`).doc();
    batch.set(auditRef, {
      action: 'createInviteToken',
      actorUid: uid,
      target: null,
      details: { revokedPrior: activeSnap.size, ttlDays: TOKEN_TTL_DAYS, maxUses: TOKEN_MAX_USES },
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return {
      token,
      expiresAtMs: expiresAt.toMillis(),
      maxUses: TOKEN_MAX_USES,
    };
  },
);
