import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  toUid: z.string().trim().min(1),
  message: z.string().trim().min(1).max(240),
  bountyId: z.string().trim().min(1).nullable().optional(),
});

interface SendScrollResult {
  scrollId: string;
}

export const sendScroll = onCall<unknown, Promise<SendScrollResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }

    const { teamId, toUid, message, bountyId } = parsed.data;
    const fromUid = request.auth.uid;
    const token = request.auth.token;

    if (fromUid === toUid) {
      throw new HttpsError(
        'failed-precondition',
        'You cannot send a thank-you scroll to yourself.',
      );
    }

    const db = getFirestore();
    const [fromMemberSnap, toMemberSnap, toUserSnap] = await Promise.all([
      db.doc(`teams/${teamId}/members/${fromUid}`).get(),
      db.doc(`teams/${teamId}/members/${toUid}`).get(),
      db.doc(`users/${toUid}`).get(),
    ]);

    if (!fromMemberSnap.exists) {
      throw new HttpsError('permission-denied', 'Not in this crew.');
    }
    if (!toMemberSnap.exists) {
      throw new HttpsError('not-found', 'Target is not in this crew.');
    }

    const toUser = toUserSnap.exists ? toUserSnap.data() : null;

    const scrollRef = db.collection(`teams/${teamId}/scrolls`).doc();
    await scrollRef.set({
      fromUid,
      fromDisplayName: token.name ?? token.email ?? 'Crewmate',
      fromPhotoURL: token.picture ?? null,
      toUid,
      toDisplayName: toUser?.['displayName'] ?? 'Crewmate',
      toPhotoURL: toUser?.['photoURL'] ?? null,
      message: message.trim(),
      bountyId: bountyId ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { scrollId: scrollRef.id };
  },
);
