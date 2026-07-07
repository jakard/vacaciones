import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

/**
 * A TAM's "book of business" — the customer accounts they own. Stored on the
 * member doc (`teams/{teamId}/members/{uid}.accounts`) and prefilled into the
 * post form so coverage can be split by account. Written server-side only
 * (Firestore rules deny direct client writes to member docs).
 */

const ACCOUNT_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const Schema = z.object({
  teamId: z.string().trim().min(1),
  accounts: z
    .array(
      z.object({
        id: z.string().regex(ACCOUNT_ID_RE),
        name: z.string().trim().min(1).max(80),
        archived: z.boolean().optional(),
      }),
    )
    .max(50),
});

interface Account {
  id: string;
  name: string;
  archived: boolean;
}

interface UpdateMyAccountsResult {
  accounts: Account[];
}

export const updateMyAccounts = onCall<unknown, Promise<UpdateMyAccountsResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, accounts } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const seen = new Set<string>();
    const clean: Account[] = [];
    for (const a of accounts) {
      if (seen.has(a.id)) {
        throw new HttpsError('invalid-argument', `Duplicate account id ${a.id}.`);
      }
      seen.add(a.id);
      clean.push({ id: a.id, name: a.name.trim(), archived: a.archived ?? false });
    }

    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
    const snap = await memberRef.get();
    if (!snap.exists) {
      throw new HttpsError('permission-denied', 'Not a member of this team.');
    }

    await memberRef.update({
      accounts: clean,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { accounts: clean };
  },
);
