import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

/**
 * GDPR / data-lifecycle trio — launch-gate item 5.
 *
 * - exportMyData: everything we hold about the caller, as JSON.
 * - deleteMyAccount: leave all crews, erase the profile, delete the
 *   Auth user. Ledger entries remain (pseudonymous uid) because they
 *   are the crew's financial record; the profile that maps uid → person
 *   is what gets erased.
 * - disbandCrew: manager tears down an entire team subtree.
 */

const ACTIVE_STATUSES = ['open', 'accepted', 'active'];

// ----------------------------------------------------------------------
// exportMyData
// ----------------------------------------------------------------------

export const exportMyData = onCall<unknown, Promise<{ data: unknown }>>(
  { ...CALLABLE_OPTS, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = request.auth.uid;
    const db = getFirestore();

    const userSnap = await db.doc(`users/${uid}`).get();
    const teamsSnap = await db
      .collection('teams')
      .where('memberUids', 'array-contains', uid)
      .get();

    const teams = [];
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const [memberSnap, walletSnap, ledgerSnap, scrollsTo, scrollsFrom, requested, covered] =
        await Promise.all([
          db.doc(`teams/${teamId}/members/${uid}`).get(),
          db.doc(`teams/${teamId}/wallets/${uid}`).get(),
          db.collection(`teams/${teamId}/ledgerEntries`).where('uid', '==', uid).get(),
          db.collection(`teams/${teamId}/scrolls`).where('toUid', '==', uid).get(),
          db.collection(`teams/${teamId}/scrolls`).where('fromUid', '==', uid).get(),
          db.collection(`teams/${teamId}/coverageRequests`).where('requesterUid', '==', uid).get(),
          db.collection(`teams/${teamId}/coverageRequests`).where('covererUid', '==', uid).get(),
        ]);
      teams.push({
        teamId,
        teamName: (teamDoc.data() as { name?: string }).name ?? null,
        membership: memberSnap.exists ? memberSnap.data() : null,
        wallet: walletSnap.exists ? walletSnap.data() : null,
        ledgerEntries: ledgerSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        scrollsReceived: scrollsTo.docs.map((d) => ({ id: d.id, ...d.data() })),
        scrollsSent: scrollsFrom.docs.map((d) => ({ id: d.id, ...d.data() })),
        bountiesRequested: requested.docs.map((d) => ({ id: d.id, ...d.data() })),
        bountiesCovered: covered.docs.map((d) => ({ id: d.id, ...d.data() })),
        note: 'Crew-mode day claims inside other requesters’ bounties are stored on those bounty documents (dayCoverers) and are not separately queryable; they appear in bountiesCovered only when you were the primary coverer.',
      });
    }

    return {
      data: {
        exportedAtMs: Date.now(),
        uid,
        profile: userSnap.exists ? userSnap.data() : null,
        teams,
      },
    };
  },
);

// ----------------------------------------------------------------------
// deleteMyAccount
// ----------------------------------------------------------------------

const DeleteSchema = z.object({
  // Typed confirmation keeps a stray click from destroying an account.
  confirm: z.literal('DELETE'),
});

export const deleteMyAccount = onCall<unknown, Promise<{ deleted: boolean }>>(
  { ...CALLABLE_OPTS, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = DeleteSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Type DELETE to confirm.');
    }
    const uid = request.auth.uid;
    const db = getFirestore();

    const teamsSnap = await db
      .collection('teams')
      .where('memberUids', 'array-contains', uid)
      .get();

    // ---- Guards first, so we never leave a half-deleted account ------
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const teamName = (teamDoc.data() as { name?: string }).name ?? teamId;
      const memberUids = (teamDoc.data() as { memberUids?: string[] }).memberUids ?? [];

      const [activeAsRequester, activeAsCoverer] = await Promise.all([
        db.collection(`teams/${teamId}/coverageRequests`)
          .where('requesterUid', '==', uid)
          .where('status', 'in', ACTIVE_STATUSES)
          .limit(1)
          .get(),
        db.collection(`teams/${teamId}/coverageRequests`)
          .where('covererUid', '==', uid)
          .where('status', 'in', ACTIVE_STATUSES)
          .limit(1)
          .get(),
      ]);
      if (!activeAsRequester.empty || !activeAsCoverer.empty) {
        throw new HttpsError(
          'failed-precondition',
          `You have active bounties in "${teamName}". Cancel or complete them first.`,
        );
      }

      if (memberUids.length > 1) {
        const memberSnap = await db.doc(`teams/${teamId}/members/${uid}`).get();
        const isManager = (memberSnap.data() as { role?: string })?.role === 'manager';
        if (isManager) {
          const managers = await db
            .collection(`teams/${teamId}/members`)
            .where('role', '==', 'manager')
            .get();
          if (managers.size <= 1) {
            throw new HttpsError(
              'failed-precondition',
              `You are the last manager of "${teamName}". Promote someone else (or disband the crew) first.`,
            );
          }
        }
      }
    }

    // ---- Execute ------------------------------------------------------
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const memberUids = (teamDoc.data() as { memberUids?: string[] }).memberUids ?? [];
      if (memberUids.length === 1 && memberUids[0] === uid) {
        // Solo crew: the whole subtree goes with the account.
        await db.recursiveDelete(teamDoc.ref);
        continue;
      }
      await db.doc(`teams/${teamId}/members/${uid}`).delete();
      await teamDoc.ref.update({ memberUids: FieldValue.arrayRemove(uid) });
      const auditRef = db.collection(`teams/${teamId}/auditLog`).doc();
      await auditRef.set({
        action: 'memberLeftViaAccountDeletion',
        actorUid: uid,
        target: uid,
        details: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Profile (incl. workspaceTokens subcollection), then the Auth user.
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await getAuth().deleteUser(uid);

    return { deleted: true };
  },
);

// ----------------------------------------------------------------------
// disbandCrew
// ----------------------------------------------------------------------

const DisbandSchema = z.object({
  teamId: z.string().trim().min(1),
  // Manager must retype the crew name — same pattern GitHub uses for
  // repo deletion.
  confirmName: z.string().min(1),
});

export const disbandCrew = onCall<unknown, Promise<{ disbanded: boolean }>>(
  { ...CALLABLE_OPTS, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = DisbandSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, confirmName } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const [teamSnap, memberSnap] = await Promise.all([
      db.doc(`teams/${teamId}`).get(),
      db.doc(`teams/${teamId}/members/${uid}`).get(),
    ]);
    if (!teamSnap.exists) {
      throw new HttpsError('not-found', 'Crew not found.');
    }
    if (
      !memberSnap.exists ||
      (memberSnap.data() as { role?: string })?.role !== 'manager'
    ) {
      throw new HttpsError('permission-denied', 'Only managers can disband a crew.');
    }
    const teamName = (teamSnap.data() as { name?: string }).name ?? '';
    if (confirmName.trim() !== teamName.trim()) {
      throw new HttpsError(
        'failed-precondition',
        'Crew name does not match. Type the exact crew name to confirm.',
      );
    }

    const active = await db
      .collection(`teams/${teamId}/coverageRequests`)
      .where('status', 'in', ACTIVE_STATUSES)
      .limit(1)
      .get();
    if (!active.empty) {
      throw new HttpsError(
        'failed-precondition',
        'There are open or active bounties. Cancel or complete them before disbanding.',
      );
    }

    // Revoke any live invite links, then tear down the subtree.
    const tokens = await db
      .collection('inviteTokens')
      .where('teamId', '==', teamId)
      .get();
    const batch = db.batch();
    tokens.docs.forEach((t) => batch.delete(t.ref));
    await batch.commit();

    await db.recursiveDelete(teamSnap.ref);

    return { disbanded: true };
  },
);
