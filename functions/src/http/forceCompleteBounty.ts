import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntries, type LedgerEntryInput } from '../services/wallet';
import {
  dailyReleaseAmountForKey,
  enumerateDayKeysInTz,
} from '../services/release';
import { cellKey, dayCostForKey } from '../services/cells';
import { ECONOMY } from '../_shared';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
});

interface ForceCompleteResult {
  completed: boolean;
  daysReleased: number;
  coinsReleased: number;
}

export const forceCompleteBounty = onCall<unknown, Promise<ForceCompleteResult>>(
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

    const result = await db.runTransaction(async (tx) => {
      const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
      const requestRef = db.doc(`teams/${teamId}/coverageRequests/${requestId}`);
      const [memberSnap, reqSnap] = await Promise.all([
        tx.get(memberRef),
        tx.get(requestRef),
      ]);
      if (!memberSnap.exists || (memberSnap.data() as { role?: string })?.role !== 'manager') {
        throw new HttpsError('permission-denied', 'Only managers can force-complete a bounty.');
      }
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Bounty not found.');
      }
      const req = reqSnap.data() as {
        status: string;
        covererUid?: string | null;
        requesterUid: string;
        timezone?: string;
        windowStart?: Timestamp;
        windowEnd?: Timestamp;
        selectedDayKeys?: string[];
        dayCoverers?: Record<string, { uid: string }>;
        cells?: Array<{ accountId: string; dayKey: string }>;
        cellCoverers?: Record<string, { uid: string }>;
      };
      if (req.status === 'completed') {
        throw new HttpsError('failed-precondition', 'Already completed.');
      }
      if (req.status === 'cancelled') {
        throw new HttpsError('failed-precondition', 'Cancelled — use the appropriate action.');
      }

      // ----------------------------------------------------------------
      // Release every billable day in the window to its coverer.
      // Uses the same idempotency key as dailyCoverageRelease so re-running
      // can never double-pay even if the scheduler already touched a day.
      // ----------------------------------------------------------------
      const fallbackCovererUid = req.covererUid ?? null;
      const dayCoverers = req.dayCoverers ?? {};
      const billableSet = req.selectedDayKeys ? new Set(req.selectedDayKeys) : null;

      // Each release carries its own idempotency key so re-running (or racing
      // the daily cron) can never double-pay.
      const releases: Array<{ uid: string; amount: number; key: string }> = [];
      if (req.cells && req.cells.length > 0) {
        // Account × day cell path — mirror releaseDaysUpToLocal's keys.
        const coverers = req.cellCoverers ?? {};
        for (const c of req.cells) {
          const dayUid = coverers[cellKey(c.accountId, c.dayKey)]?.uid ?? fallbackCovererUid;
          if (!dayUid) continue;
          releases.push({
            uid: dayUid,
            amount: dayCostForKey(c.dayKey),
            key: `${requestId}_release_${c.accountId}_${c.dayKey}`,
          });
        }
      } else if (req.windowStart && req.windowEnd) {
        // Legacy per-day path. Enumerate day keys in the bounty's own timezone
        // so they line up with selectedDayKeys / dayCoverers like the cron.
        const tz = req.timezone || 'UTC';
        for (const dayKey of enumerateDayKeysInTz(
          req.windowStart.toDate(),
          req.windowEnd.toDate(),
          tz,
        )) {
          const billable = !billableSet || billableSet.has(dayKey);
          if (!billable) continue;
          const dayUid = dayCoverers[dayKey]?.uid ?? fallbackCovererUid;
          if (!dayUid) continue;
          releases.push({
            uid: dayUid,
            amount: dailyReleaseAmountForKey(dayKey),
            key: `${requestId}_release_${dayKey}`,
          });
        }
      }

      // Burn the transaction fee. Match dailyCoverageRelease's convention:
      // for crew bounties no single coverer should eat it, so fall back to
      // the requester when there is no top-level covererUid.
      const feeBurnUid = fallbackCovererUid ?? req.requesterUid;

      // All per-day releases + the fee burn go through ONE batched write —
      // the previous per-entry loop read after a write and crashed the
      // transaction the moment a second entry applied.
      const entries: LedgerEntryInput[] = releases.map((r) => ({
        uid: r.uid,
        type: 'coverageRelease' as const,
        amountSigned: r.amount,
        balanceBucket: 'earned' as const,
        relatedRequestId: requestId,
        idempotencyKey: r.key,
      }));
      entries.push({
        uid: feeBurnUid,
        type: 'feeBurn',
        amountSigned: -ECONOMY.TRANSACTION_FEE,
        balanceBucket: 'earned',
        relatedRequestId: requestId,
        idempotencyKey: `${requestId}_feeBurn`,
      });
      const { applied } = await recordLedgerEntries({ tx, db, teamId, entries });

      // applied[] is in entries order — the first `releases.length` flags
      // correspond to the day releases; the last is the fee burn.
      let coinsReleased = 0;
      let daysReleased = 0;
      releases.forEach((r, i) => {
        if (applied[i]) {
          coinsReleased += r.amount;
          daysReleased += 1;
        }
      });

      tx.update(requestRef, {
        status: 'completed',
        coinsReleased: FieldValue.increment(coinsReleased),
        forceCompletedByUid: uid,
        forceCompletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const auditRef = db.collection(`teams/${teamId}/auditLog`).doc();
      tx.set(auditRef, {
        action: 'forceCompleteBounty',
        actorUid: uid,
        target: requestId,
        details: {
          previousStatus: req.status,
          daysReleased,
          coinsReleased,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return { coinsReleased, daysReleased };
    });

    return {
      completed: true,
      daysReleased: result.daysReleased,
      coinsReleased: result.coinsReleased,
    };
  },
);
