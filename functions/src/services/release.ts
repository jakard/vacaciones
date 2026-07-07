import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { ECONOMY } from '../_shared';

import { recordLedgerEntry } from './wallet';
import { cellKey, dayCostForKey, type Cell } from './cells';

/**
 * Coverage-release engine — extracted from the dailyCoverageRelease
 * scheduler so the economy invariants are unit/integration testable
 * without invoking the Functions runtime.
 *
 * All day math runs on YYYY-MM-DD keys interpreted in the bounty's IANA
 * timezone. The keys compare chronologically as strings, which removes
 * every UTC-midnight drift class of bug.
 */

/** Format a Date as YYYY-MM-DD in the given IANA timezone. */
export function startOfDayInTz(d: Date, timeZone: string): string {
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

/**
 * Every day-key between windowStart and windowEnd inclusive, in the given
 * timezone, sorted ascending. Caps at 400 iterations so a malformed
 * window can't degrade a cron run.
 */
export function enumerateDayKeysInTz(
  windowStart: Date,
  windowEnd: Date,
  timeZone: string,
): string[] {
  const startKey = startOfDayInTz(windowStart, timeZone);
  const endKey = startOfDayInTz(windowEnd, timeZone);
  if (endKey < startKey) return [];
  const out: string[] = [];
  // Walk UTC days underneath the TZ-rendered key; overshoot by a day on
  // each side and filter on the comparable key to tolerate the offset
  // introduced by the timezone conversion (incl. DST edges).
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

/** Doubloons released for one covered account-day (weekend pays the
 * multiplier). Delegates to the canonical cost function so create / accept /
 * release / force-complete can never disagree on price. */
export function dailyReleaseAmountForKey(dayKey: string): number {
  return dayCostForKey(dayKey);
}

export interface ReleaseArgs {
  db: Firestore;
  teamId: string;
  requestId: string;
  /** Single-mode coverer; crew mode uses dayCoverers and falls back here. */
  fallbackCovererUid: string | null;
  dayCoverers: Record<string, { uid: string }>;
  windowStart: Date;
  windowEnd: Date;
  /** The clock — injected so tests are deterministic. */
  now: Date;
  /** Days the requester kept billable; null = every day in the window. */
  selectedDayKeys: string[] | null;
  timeZone: string;
  /** Account × day cells needing coverage. When present, coverage is
   * released per cell and `cellCoverers` maps the claimant; `dayCoverers`/
   * `selectedDayKeys` are the pre-account fallback for legacy bounties. */
  cells?: Cell[] | null;
  cellCoverers?: Record<string, { uid: string }> | null;
}

/**
 * Release earned doubloons for every billable day up to "today" in the
 * bounty's timezone. Idempotent: each day writes under the deterministic
 * key `${requestId}_release_${dayKey}`, so re-runs are no-ops.
 */
export async function releaseDaysUpToLocal(args: ReleaseArgs): Promise<void> {
  const {
    db, teamId, requestId, fallbackCovererUid, dayCoverers,
    windowStart, windowEnd, now, selectedDayKeys, timeZone, cells, cellCoverers,
  } = args;

  const todayKey = startOfDayInTz(now, timeZone);
  const startKey = startOfDayInTz(windowStart, timeZone);
  const endKey = startOfDayInTz(windowEnd, timeZone);
  if (todayKey < startKey) return;
  const releaseUpToKey = todayKey < endKey ? todayKey : endKey;

  // ---- Account × day cell path (new bounties) -------------------------
  // Each cell releases independently under `${requestId}_release_${accountId}_${dayKey}`.
  if (cells && cells.length > 0) {
    const coverers = cellCoverers ?? {};
    for (const c of cells) {
      if (c.dayKey < startKey || c.dayKey > releaseUpToKey) continue;
      const dayUid = coverers[cellKey(c.accountId, c.dayKey)]?.uid ?? fallbackCovererUid;
      if (!dayUid) continue;
      const amount = dayCostForKey(c.dayKey);
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
          idempotencyKey: `${requestId}_release_${c.accountId}_${c.dayKey}`,
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
    return;
  }

  // ---- Legacy per-day path (pre-account bounties) --------------------
  const selectedSet = selectedDayKeys ? new Set(selectedDayKeys) : null;

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

/**
 * Mark a request completed and burn the transaction fee exactly once
 * (the fee uses the deterministic `${requestId}_feeBurn` key).
 */
export async function completeRequest(
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
