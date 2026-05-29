import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const REACHABILITY = [
  'unreachable',
  'email-only-emergencies',
  'phone-emergencies',
  'daily-check-in',
] as const;
const COVERAGE_KIND = [
  'inbox',
  'meetings',
  'escalations',
  'one-on-ones',
  'chat',
  'on-call',
] as const;

const Schema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
  sla: z.string().trim().min(1).max(200).optional(),
  coverageScope: z.string().trim().max(500).nullable().optional(),
  emergencyDef: z.string().max(500).nullable().optional(),
  reachability: z.array(z.enum(REACHABILITY)).min(1).max(REACHABILITY.length).optional(),
  coverageKinds: z.array(z.enum(COVERAGE_KIND)).max(COVERAGE_KIND.length).optional(),
});

interface UpdateResult {
  updated: boolean;
}

export const updateBountyDetails = onCall<unknown, Promise<UpdateResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, requestId, ...fields } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const requestRef = db.doc(`teams/${teamId}/coverageRequests/${requestId}`);
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);

    await db.runTransaction(async (tx) => {
      const [reqSnap, memberSnap] = await Promise.all([
        tx.get(requestRef),
        tx.get(memberRef),
      ]);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Bounty not found.');
      }
      if (!memberSnap.exists) {
        throw new HttpsError('permission-denied', 'Not a member of this crew.');
      }
      const req = reqSnap.data() as { status: string; requesterUid: string };
      const role = (memberSnap.data() as { role?: string } | undefined)?.role;
      const isRequester = req.requesterUid === uid;
      const isManager = role === 'manager';
      if (!isRequester && !isManager) {
        throw new HttpsError(
          'permission-denied',
          'Only the requester or a manager can edit a bounty.',
        );
      }
      if (req.status !== 'open') {
        throw new HttpsError(
          'failed-precondition',
          `Bounty is ${req.status}; only open bounties can be edited.`,
        );
      }

      const updates: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (fields.sla !== undefined) updates['sla'] = fields.sla;
      if (fields.coverageScope !== undefined) {
        updates['coverageScope'] = fields.coverageScope?.trim()
          ? fields.coverageScope.trim()
          : null;
      }
      if (fields.emergencyDef !== undefined) {
        updates['emergencyDef'] = fields.emergencyDef ?? null;
      }
      if (fields.reachability !== undefined) updates['reachability'] = fields.reachability;
      if (fields.coverageKinds !== undefined) updates['coverageKinds'] = fields.coverageKinds;

      if (Object.keys(updates).length === 1) {
        throw new HttpsError('invalid-argument', 'Nothing to update.');
      }

      tx.update(requestRef, updates);

      const auditRef = db.collection(`teams/${teamId}/auditLog`).doc();
      tx.set(auditRef, {
        action: 'updateBountyDetails',
        actorUid: uid,
        target: requestId,
        details: Object.keys(updates).filter((k) => k !== 'updatedAt'),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { updated: true };
  },
);
