import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

interface AuditEntry {
  id: string;
  action: string;
  actorUid: string;
  actorName: string;
  actorPhotoURL: string | null;
  target: string | null;
  targetName: string | null;
  details: unknown;
  createdAtMs: number;
}

interface AuditResult {
  entries: AuditEntry[];
}

export const getAuditLog = onCall<unknown, Promise<AuditResult>>(
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
    const limit = parsed.data.limit ?? 50;
    const uid = request.auth.uid;
    const db = getFirestore();

    const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
    if (
      !memberSnap.exists ||
      (memberSnap.data() as { role?: string })?.role !== 'manager'
    ) {
      throw new HttpsError('permission-denied', 'Manager only.');
    }

    const snap = await db
      .collection(`teams/${teamId}/auditLog`)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    if (snap.empty) return { entries: [] };

    // Resolve actor + target user docs in parallel
    const actorUids = new Set<string>();
    const targetUids = new Set<string>();
    for (const d of snap.docs) {
      const data = d.data() as { actorUid?: string; target?: string; action?: string };
      if (data.actorUid) actorUids.add(data.actorUid);
      if (data.target && data.action && !data.action.includes('Bounty') && data.action !== 'updateTeam') {
        targetUids.add(data.target);
      }
    }
    const allUids = Array.from(new Set([...actorUids, ...targetUids]));
    const userSnaps = allUids.length > 0
      ? await db.getAll(...allUids.map((u) => db.doc(`users/${u}`)))
      : [];
    const nameByUid = new Map<string, { displayName: string; photoURL: string | null }>();
    for (let i = 0; i < allUids.length; i++) {
      const u = userSnaps[i];
      const data = u?.exists ? (u.data() as { displayName?: string; photoURL?: string | null }) : null;
      nameByUid.set(allUids[i], {
        displayName: data?.displayName ?? 'Crewmate',
        photoURL: data?.photoURL ?? null,
      });
    }

    const entries: AuditEntry[] = snap.docs.map((d) => {
      const data = d.data() as {
        action: string;
        actorUid: string;
        target?: string;
        details?: unknown;
        createdAt?: Timestamp;
      };
      const actor = nameByUid.get(data.actorUid);
      const target = data.target ? nameByUid.get(data.target) : null;
      return {
        id: d.id,
        action: data.action,
        actorUid: data.actorUid,
        actorName: actor?.displayName ?? 'Unknown',
        actorPhotoURL: actor?.photoURL ?? null,
        target: data.target ?? null,
        targetName: target?.displayName ?? null,
        details: data.details ?? null,
        createdAtMs: data.createdAt?.toDate().getTime() ?? 0,
      };
    });

    return { entries };
  },
);
