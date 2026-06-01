import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const AVATAR_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'f1', 'f2', 'f3', 'f4', 'f5'] as const;

const Schema = z.object({
  avatarId: z.enum(AVATAR_IDS).nullable().optional(),
  digestEnabled: z.boolean().optional(),
});

interface SetProfileResult {
  ok: boolean;
}

export const setProfile = onCall<unknown, Promise<SetProfileResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const uid = request.auth.uid;
    const db = getFirestore();
    const patch: Record<string, unknown> = {};
    if ('avatarId' in parsed.data) patch.avatarId = parsed.data.avatarId;
    if ('digestEnabled' in parsed.data) patch.digestEnabled = parsed.data.digestEnabled;
    if (Object.keys(patch).length === 0) return { ok: true };
    await db.doc(`users/${uid}`).set(patch, { merge: true });
    return { ok: true };
  },
);
