import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntry } from '../services/wallet';
import { queueMail, wrapTemplate, BRAND_URL } from '../services/mail';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
});

interface CancelResult {
  cancelled: boolean;
  refunded: number;
}

export const cancelBounty = onCall<unknown, Promise<CancelResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, requestId } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const requestRef = db.doc(`teams/${teamId}/coverageRequests/${requestId}`);
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const [reqSnap, memberSnap] = await Promise.all([
        tx.get(requestRef),
        tx.get(memberRef),
      ]);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Bounty not found.');
      }
      if (!memberSnap.exists) {
        throw new HttpsError('permission-denied', 'Not in this crew.');
      }
      const req = reqSnap.data() as {
        status: string;
        requesterUid: string;
        requesterDisplayName?: string;
        coinsEscrowed?: number;
        coinsReleased?: number;
        coverers?: Array<{ uid: string; displayName: string }>;
      };
      const role = (memberSnap.data() as { role?: string } | undefined)?.role;

      if (req.status === 'cancelled') {
        throw new HttpsError('failed-precondition', 'Already cancelled.');
      }
      if (req.status === 'completed') {
        throw new HttpsError(
          'failed-precondition',
          'Cannot cancel a completed bounty.',
        );
      }

      const isRequester = req.requesterUid === uid;
      const isManager = role === 'manager';
      if (!isRequester && !isManager) {
        throw new HttpsError(
          'permission-denied',
          'Only the requester or a manager can cancel a bounty.',
        );
      }

      const escrowed = req.coinsEscrowed ?? 0;
      const released = req.coinsReleased ?? 0;
      const remaining = Math.max(0, escrowed - released);

      if (remaining > 0) {
        await recordLedgerEntry({
          tx,
          db,
          teamId,
          uid: req.requesterUid,
          type: 'escrowOut',
          amountSigned: remaining,
          balanceBucket: 'earned',
          relatedRequestId: requestId,
          idempotencyKey: `${requestId}_cancel_refund`,
        });
      }

      tx.update(requestRef, {
        status: 'cancelled',
        cancelledByUid: uid,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        refunded: remaining,
        requesterUid: req.requesterUid,
        requesterName: req.requesterDisplayName ?? '',
        coverers: req.coverers ?? [],
        cancelledByRequester: isRequester,
      };
    });

    // Post-commit: notify the coverer(s) that the bounty was cancelled.
    try {
      const recipients = new Set<string>();
      for (const c of result.coverers) {
        if (c.uid && c.uid !== uid) recipients.add(c.uid);
      }
      if (recipients.size > 0) {
        const userDocs = await db.getAll(
          ...Array.from(recipients).map((u) => db.doc(`users/${u}`)),
        );
        const cancellerName = result.cancelledByRequester
          ? (result.requesterName || 'The requester')
          : 'A manager';
        for (const docSnap of userDocs) {
          const email = (docSnap.data() as { email?: string })?.email;
          if (!email) continue;
          const html = wrapTemplate({
            preheader: 'The bounty you were covering was cancelled.',
            title: 'A bounty you claimed was cancelled',
            bodyHtml: `
              <p style="margin:0 0 12px;"><strong>${esc(cancellerName)}</strong> cancelled a bounty you had claimed.</p>
              <p style="margin:0 0 12px;">Any unreleased doubloons have been refunded to the requester. The days you already covered remain in your earned balance.</p>
              <p style="margin:0;color:#7E7B73;font-size:13px;">Open the app to see what else is available in the crew.</p>`,
            ctaLabel: 'Open Time Off',
            ctaUrl: `${BRAND_URL}/#/team/${encodeURIComponent(teamId)}`,
          });
          await queueMail(db, {
            to: email,
            subject: 'A bounty you claimed was cancelled',
            html,
            idempotencyKey: `${requestId}_cancelled_${docSnap.id}`,
            category: 'bounty-cancelled',
          });
        }
      }
    } catch (err) {
      console.error('Failed to queue cancelled-bounty mail', err);
    }

    return { cancelled: true, refunded: result.refunded };
  },
);

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
