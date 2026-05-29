import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  // null clears the key; undefined leaves it untouched; string sets it
  geminiApiKey: z.string().trim().min(8).max(500).nullable().optional(),
});

interface UpdateSettingsResult {
  updated: boolean;
}

export const updateCrewSettings = onCall<unknown, Promise<UpdateSettingsResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, geminiApiKey } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (
      !memberSnap.exists ||
      (memberSnap.data() as { role?: string } | undefined)?.role !== 'manager'
    ) {
      throw new HttpsError(
        'permission-denied',
        'Only the crew manager can edit settings.',
      );
    }

    const settingsRef = db.doc(`teams/${teamId}/private/settings`);
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (geminiApiKey === null) {
      updates['geminiApiKey'] = FieldValue.delete();
      updates['geminiKeyLast4'] = FieldValue.delete();
      updates['geminiKeySetAt'] = FieldValue.delete();
      updates['geminiKeySetByUid'] = FieldValue.delete();
    } else if (geminiApiKey !== undefined) {
      updates['geminiApiKey'] = geminiApiKey;
      updates['geminiKeyLast4'] = geminiApiKey.slice(-4);
      updates['geminiKeySetAt'] = FieldValue.serverTimestamp();
      updates['geminiKeySetByUid'] = uid;
    }

    await settingsRef.set(updates, { merge: true });
    return { updated: true };
  },
);
