import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  targetUid: z.string().trim().min(1),
  role: z.enum(['manager', 'member']),
});

interface UpdateRoleResult {
  updated: boolean;
}

export const updateMemberRole = onCall<unknown, Promise<UpdateRoleResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, targetUid, role } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    await db.runTransaction(async (tx) => {
      const callerMemberRef = db.doc(`teams/${teamId}/members/${uid}`);
      const targetMemberRef = db.doc(`teams/${teamId}/members/${targetUid}`);

      const [callerSnap, targetSnap] = await Promise.all([
        tx.get(callerMemberRef),
        tx.get(targetMemberRef),
      ]);

      if (!callerSnap.exists) {
        throw new HttpsError('permission-denied', 'Not in this crew.');
      }
      if ((callerSnap.data() as { role?: string } | undefined)?.role !== 'manager') {
        throw new HttpsError(
          'permission-denied',
          'Only managers can change roles.',
        );
      }
      if (!targetSnap.exists) {
        throw new HttpsError('not-found', 'Target crewmate not found.');
      }

      const currentRole = (targetSnap.data() as { role?: string })?.role ?? 'member';
      if (currentRole === role) {
        return; // no-op
      }

      // Protect against locking out the crew — if demoting the last manager
      if (role === 'member') {
        const managersSnap = await tx.get(
          db.collection(`teams/${teamId}/members`).where('role', '==', 'manager'),
        );
        if (managersSnap.size <= 1 && currentRole === 'manager') {
          throw new HttpsError(
            'failed-precondition',
            'Cannot demote the last manager.',
          );
        }
      }

      tx.update(targetMemberRef, {
        role,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Audit
      const auditRef = db.collection(`teams/${teamId}/auditLog`).doc();
      tx.set(auditRef, {
        action: 'updateMemberRole',
        actorUid: uid,
        target: targetUid,
        details: { from: currentRole, to: role },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { updated: true };
  },
);
