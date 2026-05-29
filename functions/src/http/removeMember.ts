import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  targetUid: z.string().trim().min(1),
});

interface RemoveResult {
  removed: boolean;
}

export const removeMember = onCall<unknown, Promise<RemoveResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, targetUid } = parsed.data;
    const uid = request.auth.uid;
    if (uid === targetUid) {
      throw new HttpsError(
        'failed-precondition',
        'Use the leave flow instead of removing yourself.',
      );
    }
    const db = getFirestore();

    await db.runTransaction(async (tx) => {
      const callerMemberRef = db.doc(`teams/${teamId}/members/${uid}`);
      const targetMemberRef = db.doc(`teams/${teamId}/members/${targetUid}`);
      const teamRef = db.doc(`teams/${teamId}`);

      const [callerSnap, targetSnap, teamSnap] = await Promise.all([
        tx.get(callerMemberRef),
        tx.get(targetMemberRef),
        tx.get(teamRef),
      ]);

      if (!callerSnap.exists) {
        throw new HttpsError('permission-denied', 'Not in this crew.');
      }
      if ((callerSnap.data() as { role?: string } | undefined)?.role !== 'manager') {
        throw new HttpsError(
          'permission-denied',
          'Only managers can remove crewmates.',
        );
      }
      if (!targetSnap.exists) {
        throw new HttpsError('not-found', 'Crewmate not in this crew.');
      }
      const team = teamSnap.data() as { ownerUid?: string; memberUids?: string[] };
      if (team.ownerUid === targetUid) {
        throw new HttpsError(
          'failed-precondition',
          'Cannot remove the crew owner.',
        );
      }

      // If the target is a manager, make sure they aren't the last one
      const targetRole = (targetSnap.data() as { role?: string })?.role;
      if (targetRole === 'manager') {
        const managersSnap = await tx.get(
          db.collection(`teams/${teamId}/members`).where('role', '==', 'manager'),
        );
        if (managersSnap.size <= 1) {
          throw new HttpsError(
            'failed-precondition',
            'Cannot remove the last manager.',
          );
        }
      }

      tx.delete(targetMemberRef);
      tx.update(teamRef, {
        memberUids: FieldValue.arrayRemove(targetUid),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const auditRef = db.collection(`teams/${teamId}/auditLog`).doc();
      tx.set(auditRef, {
        action: 'removeMember',
        actorUid: uid,
        target: targetUid,
        details: { previousRole: targetRole ?? 'member' },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { removed: true };
  },
);
