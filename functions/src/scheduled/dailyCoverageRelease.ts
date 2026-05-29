import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import {
  FieldValue,
  Firestore,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';
import { ECONOMY } from '../_shared';

import { recordLedgerEntry } from '../services/wallet';

export const dailyCoverageRelease = onSchedule(
  {
    schedule: '5 0 * * *',
    timeZone: 'UTC',
    memory: '256MiB',
    retryCount: 3,
  },
  async () => {
    const db = getFirestore();
    const today = startOfDayUtc(new Date());

    const snapshot = await db
      .collectionGroup('coverageRequests')
      .where('status', 'in', ['accepted', 'active'])
      .get();

    logger.info('dailyCoverageRelease tick', {
      activeRequests: snapshot.size,
      today: today.toISOString(),
    });

    for (const docSnap of snapshot.docs) {
      const teamId = docSnap.ref.parent.parent?.id;
      if (!teamId) continue;
      const requestId = docSnap.id;
      const data = docSnap.data();
      const fallbackCovererUid = data['covererUid'] as string | null | undefined;
      const dayCoverers =
        (data['dayCoverers'] as Record<string, { uid: string }> | undefined) ?? {};
      const hasAnyCoverer = !!fallbackCovererUid || Object.keys(dayCoverers).length > 0;
      if (!hasAnyCoverer) continue;

      const windowStart = startOfDayUtc(
        (data['windowStart'] as Timestamp).toDate(),
      );
      const windowEnd = startOfDayUtc(
        (data['windowEnd'] as Timestamp).toDate(),
      );
      const selectedDayKeys =
        (data['selectedDayKeys'] as string[] | undefined) ?? null;

      try {
        await releaseDaysUpTo(
          db,
          teamId,
          requestId,
          fallbackCovererUid ?? null,
          dayCoverers,
          windowStart,
          windowEnd,
          today,
          selectedDayKeys,
        );
        if (today.getTime() > windowEnd.getTime()) {
          // For crew bounties, pick someone (anyone) for the fee burn.
          // Default to the requester so no single coverer eats it twice.
          const feeBurnUid = fallbackCovererUid ?? (data['requesterUid'] as string);
          await completeRequest(db, teamId, requestId, feeBurnUid);
        }
      } catch (err) {
        logger.error('Failed to process coverage request', {
          teamId,
          requestId,
          error: (err as Error).message,
        });
      }
    }
  },
);

async function releaseDaysUpTo(
  db: Firestore,
  teamId: string,
  requestId: string,
  fallbackCovererUid: string | null,
  dayCoverers: Record<string, { uid: string }>,
  windowStart: Date,
  windowEnd: Date,
  today: Date,
  selectedDayKeys: string[] | null,
): Promise<void> {
  if (today.getTime() < windowStart.getTime()) return;

  const releaseUpTo =
    today.getTime() < windowEnd.getTime() ? today : windowEnd;
  const cursor = new Date(windowStart);
  const selectedSet = selectedDayKeys ? new Set(selectedDayKeys) : null;

  while (cursor.getTime() <= releaseUpTo.getTime()) {
    const day = new Date(cursor);
    const dayKey = formatDateKey(day);
    // Skip days that the requester explicitly removed from coverage.
    const billable = !selectedSet || selectedSet.has(dayKey);
    if (billable) {
      // Crew mode: pay whoever claimed this specific day.
      // Single mode: fall back to top-level covererUid.
      const dayUid = dayCoverers[dayKey]?.uid ?? fallbackCovererUid;
      if (dayUid) {
        const amount = dailyReleaseAmount(day);
        await db.runTransaction(async (tx) => {
          const result = await recordLedgerEntry({
            tx,
            db,
            teamId,
            uid: dayUid,
            type: 'coverageRelease',
            amountSigned: amount,
            balanceBucket: 'earned',
            relatedRequestId: requestId,
            idempotencyKey: `${requestId}_release_${dayKey}`,
          });
          if (result.applied) {
            const requestRef = db.doc(
              `teams/${teamId}/coverageRequests/${requestId}`,
            );
            tx.update(requestRef, {
              coinsReleased: FieldValue.increment(amount),
              status: 'active',
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

async function completeRequest(
  db: Firestore,
  teamId: string,
  requestId: string,
  covererUid: string,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const requestRef = db.doc(
      `teams/${teamId}/coverageRequests/${requestId}`,
    );
    const reqSnap = await tx.get(requestRef);
    if (!reqSnap.exists) return;
    if ((reqSnap.data()?.['status'] as string) === 'completed') return;

    await recordLedgerEntry({
      tx,
      db,
      teamId,
      uid: covererUid,
      type: 'feeBurn',
      amountSigned: -ECONOMY.TRANSACTION_FEE,
      balanceBucket: 'earned',
      relatedRequestId: requestId,
      idempotencyKey: `${requestId}_feeBurn`,
    });

    tx.update(requestRef, {
      status: 'completed',
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

function startOfDayUtc(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function dailyReleaseAmount(date: Date): number {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6
    ? ECONOMY.COVERAGE_PRICE_PER_DAY * ECONOMY.WEEKEND_MULTIPLIER
    : ECONOMY.COVERAGE_PRICE_PER_DAY;
}

function formatDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
