import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const ALLOWED_EMOJIS = ['🪙', '🍻', '🏴‍☠️', '⚓', '🦜'] as const;

const Schema = z.object({
  teamId: z.string().trim().min(1),
  scrollId: z.string().trim().min(1),
  emoji: z.enum(ALLOWED_EMOJIS).nullable(),
});

interface ReactResult {
  applied: boolean;
}

export const reactToScroll = onCall<unknown, Promise<ReactResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, scrollId, emoji } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (!memberSnap.exists) {
      throw new HttpsError('permission-denied', 'Not a member of this crew.');
    }

    const scrollRef = db.doc(`teams/${teamId}/scrolls/${scrollId}`);
    const update: Record<string, unknown> = {
      [`reactions.${uid}`]: emoji ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await scrollRef.set(update, { merge: true });
    return { applied: true };
  },
);
