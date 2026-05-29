import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  photoURL: z.string().trim().url().nullable().optional(),
});

interface UpdateTeamResult {
  updated: boolean;
}

export const updateTeam = onCall<unknown, Promise<UpdateTeamResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, name, photoURL } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (
      !memberSnap.exists ||
      (memberSnap.data() as { role?: string } | undefined)?.role !== 'manager'
    ) {
      throw new HttpsError(
        'permission-denied',
        'Only the crew manager can edit the crew.',
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (name !== undefined) updates['name'] = name;
    if (photoURL !== undefined) updates['photoURL'] = photoURL;

    if (Object.keys(updates).length === 1) {
      throw new HttpsError('invalid-argument', 'Nothing to update.');
    }

    await db.doc(`teams/${teamId}`).update(updates);
    return { updated: true };
  },
);
