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
      const covererUid = data['covererUid'] as string | null | undefined;
      if (!covererUid) continue;

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
          covererUid,
          windowStart,
          windowEnd,
          today,
          selectedDayKeys,
        );
        if (today.getTime() > windowEnd.getTime()) {
          await completeRequest(db, teamId, requestId, covererUid);
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
  covererUid: string,
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
      const amount = dailyReleaseAmount(day);
      await db.runTransaction(async (tx) => {
        const result = await recordLedgerEntry({
          tx,
          db,
          teamId,
          uid: covererUid,
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
