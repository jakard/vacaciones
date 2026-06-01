import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import { CALLABLE_OPTS } from '../options';

interface InitUserResult {
  initialized: boolean;
  uid: string;
}

export const initUser = onCall<unknown, Promise<InitUserResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const uid = request.auth.uid;
    const token = request.auth.token;
    const identities = (
      token.firebase as { identities?: Record<string, string[]> } | undefined
    )?.identities;
    const googleProviderUid = identities?.['google.com']?.[0];

    const db = getFirestore();
    const userRef = db.doc(`users/${uid}`);

    const initialized = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (snap.exists) return false;

      tx.create(userRef, {
        email: token.email ?? '',
        displayName: token.name ?? token.email ?? '',
        photoURL: token.picture ?? null,
        googleUserId: googleProviderUid ?? '',
        // Daily email digest on by default — users can opt out from settings.
        digestEnabled: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    return { initialized, uid };
  },
);
