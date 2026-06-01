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
    const now = new Date();

    const snapshot = await db
      .collectionGroup('coverageRequests')
      .where('status', 'in', ['accepted', 'active'])
      .get();

    logger.info('dailyCoverageRelease tick', {
      activeRequests: snapshot.size,
      nowUtc: now.toISOString(),
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

      const selectedDayKeys =
        (data['selectedDayKeys'] as string[] | undefined) ?? null;

      // Determine "today" in the *bounty's* timezone, not UTC. Otherwise
      // PT coverers get credited Jan 7 at PT 16:05 Jan 6 (UTC midnight).
      const bountyTz = (data['timezone'] as string | undefined) || 'UTC';
      const todayInTz = startOfDayInTz(now, bountyTz);
      const windowEndInTz = startOfDayInTz((data['windowEnd'] as Timestamp).toDate(), bountyTz);

      try {
        await releaseDaysUpToLocal(
          db,
          teamId,
          requestId,
          fallbackCovererUid ?? null,
          dayCoverers,
          (data['windowStart'] as Timestamp).toDate(),
          (data['windowEnd'] as Timestamp).toDate(),
          now,
          selectedDayKeys,
          bountyTz,
        );
        // Mark completed once "today in TZ" has passed the window's last day.
        if (todayInTz > windowEndInTz) {
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

async function releaseDaysUpToLocal(
  db: Firestore,
  teamId: string,
  requestId: string,
  fallbackCovererUid: string | null,
  dayCoverers: Record<string, { uid: string }>,
  windowStart: Date,
  windowEnd: Date,
  now: Date,
  selectedDayKeys: string[] | null,
  timeZone: string,
): Promise<void> {
  // Work entirely in YYYY-MM-DD keys interpreted in the bounty's timezone.
  // String comparison on these keys is chronological, so we never have to
  // deal with UTC drift at day boundaries.
  const todayKey = startOfDayInTz(now, timeZone);
  const startKey = startOfDayInTz(windowStart, timeZone);
  const endKey = startOfDayInTz(windowEnd, timeZone);
  if (todayKey < startKey) return;
  const releaseUpToKey = todayKey < endKey ? todayKey : endKey;
  const selectedSet = selectedDayKeys ? new Set(selectedDayKeys) : null;

  // Iterate every key from windowStart through releaseUpTo (inclusive).
  // For days the requester removed, just skip.
  for (const dayKey of enumerateDayKeysInTz(windowStart, windowEnd, timeZone)) {
    if (dayKey > releaseUpToKey) break;
    const billable = !selectedSet || selectedSet.has(dayKey);
    if (!billable) continue;
    const dayUid = dayCoverers[dayKey]?.uid ?? fallbackCovererUid;
    if (!dayUid) continue;
    const amount = dailyReleaseAmountForKey(dayKey);
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

// Format a Date as YYYY-MM-DD in the given IANA timezone.
// Returns chronologically comparable strings ("2026-01-09" < "2026-01-10").
function startOfDayInTz(d: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${day}`;
  } catch {
    // Fallback to UTC if the supplied timezone is invalid.
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

// Walk every day-key between windowStart and windowEnd inclusive, in the
// given timezone. Caps at 400 iterations so a malformed window can't
// degrade the cron run.
function enumerateDayKeysInTz(
  windowStart: Date,
  windowEnd: Date,
  timeZone: string,
): string[] {
  const startKey = startOfDayInTz(windowStart, timeZone);
  const endKey = startOfDayInTz(windowEnd, timeZone);
  if (endKey < startKey) return [];
  const out: string[] = [];
  // Use the UTC date arithmetic underneath the day-key string. We over-
  // shoot by 1 in either direction and filter on the comparable key to
  // tolerate the off-by-one introduced by the TZ conversion.
  const probe = new Date(windowStart);
  probe.setUTCDate(probe.getUTCDate() - 2);
  for (let i = 0; i < 400; i++) {
    const key = startOfDayInTz(probe, timeZone);
    if (key >= startKey && key <= endKey && !out.includes(key)) {
      out.push(key);
    }
    if (key > endKey) break;
    probe.setUTCDate(probe.getUTCDate() + 1);
  }
  out.sort();
  return out;
}

function dailyReleaseAmountForKey(dayKey: string): number {
  // YYYY-MM-DD interpreted as UTC midnight — getUTCDay() correctly returns
  // the day-of-week for that calendar date (no timezone ambiguity).
  const [y, m, d] = dayKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6
    ? ECONOMY.COVERAGE_PRICE_PER_DAY * ECONOMY.WEEKEND_MULTIPLIER
    : ECONOMY.COVERAGE_PRICE_PER_DAY;
}
