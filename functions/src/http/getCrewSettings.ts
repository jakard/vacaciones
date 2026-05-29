import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
});

interface CrewSettingsResult {
  hasGeminiKey: boolean;
  geminiKeyLast4: string | null;
  geminiKeySetAtMs: number | null;
  geminiKeySetByUid: string | null;
}

export const getCrewSettings = onCall<unknown, Promise<CrewSettingsResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (
      !memberSnap.exists ||
      (memberSnap.data() as { role?: string } | undefined)?.role !== 'manager'
    ) {
      throw new HttpsError(
        'permission-denied',
        'Only the crew manager can read settings.',
      );
    }

    const snap = await db.doc(`teams/${teamId}/private/settings`).get();
    const data = snap.exists ? snap.data() : null;

    return {
      hasGeminiKey: !!(data as { geminiApiKey?: string } | null)?.geminiApiKey,
      geminiKeyLast4: (data as { geminiKeyLast4?: string } | null)?.geminiKeyLast4 ?? null,
      geminiKeySetAtMs:
        ((data as { geminiKeySetAt?: Timestamp } | null)?.geminiKeySetAt?.toDate()?.getTime()) ?? null,
      geminiKeySetByUid: (data as { geminiKeySetByUid?: string } | null)?.geminiKeySetByUid ?? null,
    };
  },
);
