import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  windowDays: z.number().int().min(1).max(365).optional(),
});

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  earnedInWindow: number;
  voyages: number;
}

interface LeaderboardResult {
  generatedAtMs: number;
  windowStartMs: number;
  windowEndMs: number;
  windowDays: number;
  entries: LeaderboardEntry[];
}

export const getLeaderboard = onCall<unknown, Promise<LeaderboardResult>>(
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
    const windowDays = parsed.data.windowDays ?? 90;
    const uid = request.auth.uid;
    const db = getFirestore();

    const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (!memberSnap.exists) {
      throw new HttpsError('permission-denied', 'Not a member of this team.');
    }

    const now = Date.now();
    const windowStartMs = now - windowDays * 24 * 60 * 60 * 1000;
    const windowStart = Timestamp.fromMillis(windowStartMs);

    const snap = await db
      .collection(`teams/${teamId}/ledgerEntries`)
      .where('type', '==', 'coverageRelease')
      .where('createdAt', '>=', windowStart)
      .get();

    const sums = new Map<string, { earned: number; voyages: Set<string> }>();
    for (const doc of snap.docs) {
      const data = doc.data() as {
        uid: string;
        amountSigned: number;
        relatedRequestId: string | null;
      };
      const entry = sums.get(data.uid) ?? { earned: 0, voyages: new Set<string>() };
      entry.earned += data.amountSigned;
      if (data.relatedRequestId) entry.voyages.add(data.relatedRequestId);
      sums.set(data.uid, entry);
    }

    const entries: LeaderboardEntry[] = [];
    const uids = Array.from(sums.keys());
    if (uids.length > 0) {
      const userSnaps = await db.getAll(...uids.map((u) => db.doc(`users/${u}`)));
      for (let i = 0; i < uids.length; i++) {
        const u = uids[i];
        const userData = userSnaps[i].exists ? userSnaps[i].data() : null;
        const agg = sums.get(u)!;
        entries.push({
          uid: u,
          displayName: userData?.['displayName'] ?? 'Crewmate',
          photoURL: userData?.['photoURL'] ?? null,
          earnedInWindow: agg.earned,
          voyages: agg.voyages.size,
        });
      }
    }

    entries.sort((a, b) => b.earnedInWindow - a.earnedInWindow);

    return {
      generatedAtMs: now,
      windowStartMs,
      windowEndMs: now,
      windowDays,
      entries: entries.slice(0, 10),
    };
  },
);
