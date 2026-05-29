import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
});

interface MemberEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  avatarId: string | null;
  role: 'manager' | 'member';
  joinedAtMs: number | null;
  lifetimeEarned: number;
  voyages: number;
  earnedLast90d: number;
}

interface CrewMembersResult {
  members: MemberEntry[];
}

export const getCrewMembers = onCall<unknown, Promise<CrewMembersResult>>(
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

    const myMemberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (!myMemberSnap.exists) {
      throw new HttpsError('permission-denied', 'Not a member of this crew.');
    }

    const memberDocs = await db
      .collection(`teams/${teamId}/members`)
      .get();
    const uids = memberDocs.docs.map((d) => d.id);
    if (uids.length === 0) return { members: [] };

    const userRefs = uids.map((u) => db.doc(`users/${u}`));
    const userSnaps = await db.getAll(...userRefs);

    const since90d = Timestamp.fromMillis(Date.now() - 90 * 86400000);
    const releases = await db
      .collection(`teams/${teamId}/ledgerEntries`)
      .where('type', '==', 'coverageRelease')
      .where('createdAt', '>=', since90d)
      .get();

    const lifetimeReleases = await db
      .collection(`teams/${teamId}/ledgerEntries`)
      .where('type', '==', 'coverageRelease')
      .get();

    const earned90 = new Map<string, number>();
    const voyageSet = new Map<string, Set<string>>();
    const lifetime = new Map<string, number>();

    for (const d of releases.docs) {
      const data = d.data() as {
        uid: string;
        amountSigned: number;
        relatedRequestId: string | null;
      };
      earned90.set(data.uid, (earned90.get(data.uid) ?? 0) + data.amountSigned);
    }
    for (const d of lifetimeReleases.docs) {
      const data = d.data() as {
        uid: string;
        amountSigned: number;
        relatedRequestId: string | null;
      };
      lifetime.set(data.uid, (lifetime.get(data.uid) ?? 0) + data.amountSigned);
      const set = voyageSet.get(data.uid) ?? new Set<string>();
      if (data.relatedRequestId) set.add(data.relatedRequestId);
      voyageSet.set(data.uid, set);
    }

    const members: MemberEntry[] = memberDocs.docs.map((m, i) => {
      const memberData = m.data() as {
        role?: 'manager' | 'member';
        joinedAt?: Timestamp;
      };
      const userData = userSnaps[i].exists
        ? (userSnaps[i].data() as {
            displayName?: string;
            photoURL?: string | null;
            avatarId?: string | null;
          })
        : null;
      return {
        uid: m.id,
        displayName: userData?.displayName ?? 'Crewmate',
        photoURL: userData?.photoURL ?? null,
        avatarId: userData?.avatarId ?? null,
        role: memberData.role ?? 'member',
        joinedAtMs: memberData.joinedAt?.toDate()?.getTime() ?? null,
        lifetimeEarned: lifetime.get(m.id) ?? 0,
        voyages: voyageSet.get(m.id)?.size ?? 0,
        earnedLast90d: earned90.get(m.id) ?? 0,
      };
    });

    members.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'manager' ? -1 : 1;
      return b.lifetimeEarned - a.lifetimeEarned;
    });

    return { members };
  },
);
