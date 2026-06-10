import { beforeEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';

import {
  completeRequest,
  releaseDaysUpToLocal,
} from '../../src/services/release';
import { HAS_EMULATOR, emulatorDb } from './helpers';

const d = HAS_EMULATOR ? describe : describe.skip;

d('coverage release engine (emulator)', () => {
  const db = emulatorDb('demo-release');
  const teamId = 'crew1';
  let seq = 0;
  let requestId = '';

  // Mon 2026-06-01 .. Fri 2026-06-05 (UTC) — a clean business week.
  const WINDOW_START = new Date('2026-06-01T00:00:00Z');
  const WINDOW_END = new Date('2026-06-05T00:00:00Z');
  const WEEK_KEYS = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];

  beforeEach(async () => {
    requestId = `req${++seq}`;
    await db.doc(`teams/${teamId}/coverageRequests/${requestId}`).set({
      status: 'accepted',
      requesterUid: 'requester',
      covererUid: 'coverer',
      windowStart: Timestamp.fromDate(WINDOW_START),
      windowEnd: Timestamp.fromDate(WINDOW_END),
      timezone: 'UTC',
      selectedDayKeys: WEEK_KEYS,
      coinsReleased: 0,
    });
  });

  async function release(args?: {
    now?: Date;
    selectedDayKeys?: string[] | null;
    dayCoverers?: Record<string, { uid: string }>;
    fallbackCovererUid?: string | null;
    timeZone?: string;
    windowStart?: Date;
    windowEnd?: Date;
  }) {
    await releaseDaysUpToLocal({
      db,
      teamId,
      requestId,
      fallbackCovererUid: args?.fallbackCovererUid === undefined ? 'coverer' : args.fallbackCovererUid,
      dayCoverers: args?.dayCoverers ?? {},
      windowStart: args?.windowStart ?? WINDOW_START,
      windowEnd: args?.windowEnd ?? WINDOW_END,
      now: args?.now ?? new Date('2026-06-08T12:00:00Z'), // after window end
      selectedDayKeys: args?.selectedDayKeys === undefined ? WEEK_KEYS : args.selectedDayKeys,
      timeZone: args?.timeZone ?? 'UTC',
    });
  }

  async function covererBalanceDelta(uid: string): Promise<number> {
    const entries = await db
      .collection(`teams/${teamId}/ledgerEntries`)
      .where('relatedRequestId', '==', requestId)
      .where('uid', '==', uid)
      .get();
    return entries.docs.reduce((sum, e) => sum + (e.data().amountSigned ?? 0), 0);
  }

  it('releases every billable day once the window has passed', async () => {
    await release();
    expect(await covererBalanceDelta('coverer')).toBe(25); // 5 weekdays × 5

    const req = await db.doc(`teams/${teamId}/coverageRequests/${requestId}`).get();
    expect(req.data()?.coinsReleased).toBe(25);
    expect(req.data()?.status).toBe('active');
  });

  it('is idempotent across re-runs (cron retries cannot double-pay)', async () => {
    await release();
    await release();
    await release();
    expect(await covererBalanceDelta('coverer')).toBe(25);

    const req = await db.doc(`teams/${teamId}/coverageRequests/${requestId}`).get();
    expect(req.data()?.coinsReleased).toBe(25);
  });

  it('releases nothing before the window starts', async () => {
    await release({ now: new Date('2026-05-20T12:00:00Z') });
    expect(await covererBalanceDelta('coverer')).toBe(0);
  });

  it('releases only days up to "today" mid-window', async () => {
    await release({ now: new Date('2026-06-03T09:00:00Z') }); // Wed
    expect(await covererBalanceDelta('coverer')).toBe(15); // Mon+Tue+Wed
  });

  it('skips days the requester removed from coverage', async () => {
    await release({ selectedDayKeys: ['2026-06-01', '2026-06-05'] });
    expect(await covererBalanceDelta('coverer')).toBe(10);
  });

  it('pays the weekend multiplier on weekend days', async () => {
    // Sat 2026-06-06 .. Sun 2026-06-07.
    await release({
      windowStart: new Date('2026-06-06T00:00:00Z'),
      windowEnd: new Date('2026-06-07T00:00:00Z'),
      selectedDayKeys: ['2026-06-06', '2026-06-07'],
      now: new Date('2026-06-09T12:00:00Z'),
    });
    expect(await covererBalanceDelta('coverer')).toBe(20); // 2 × 10
  });

  it('crew mode pays each day to whoever claimed it', async () => {
    await release({
      dayCoverers: {
        '2026-06-01': { uid: 'alice' },
        '2026-06-02': { uid: 'alice' },
        '2026-06-03': { uid: 'bob' },
      },
      fallbackCovererUid: null,
      selectedDayKeys: WEEK_KEYS,
    });
    expect(await covererBalanceDelta('alice')).toBe(10);
    expect(await covererBalanceDelta('bob')).toBe(5);
    // Unclaimed days with no fallback release nothing.
    expect(await covererBalanceDelta('coverer')).toBe(0);
  });

  it('uses the bounty timezone for "today" (Tokyo releases ahead of UTC)', async () => {
    // Window: Tokyo Mon 07-06 .. Fri 07-10 (starts 07-05T15:00Z).
    // now = 2026-07-06T20:00Z = Tokyo 07-07 05:00 → two days releasable.
    // A UTC-clocked walk would only release one.
    await release({
      windowStart: new Date('2026-07-05T15:00:00Z'),
      windowEnd: new Date('2026-07-10T14:59:00Z'),
      timeZone: 'Asia/Tokyo',
      selectedDayKeys: ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'],
      now: new Date('2026-07-06T20:00:00Z'),
    });
    expect(await covererBalanceDelta('coverer')).toBe(10); // 07-06 + 07-07
  });

  it('completeRequest burns the fee exactly once', async () => {
    await release();
    await completeRequest(db, teamId, requestId, 'coverer');
    await completeRequest(db, teamId, requestId, 'coverer'); // retry: no-op

    const req = await db.doc(`teams/${teamId}/coverageRequests/${requestId}`).get();
    expect(req.data()?.status).toBe('completed');

    // 25 released − 1 fee = 24 net for the coverer on this request.
    expect(await covererBalanceDelta('coverer')).toBe(24);

    const fees = await db
      .collection(`teams/${teamId}/ledgerEntries`)
      .where('relatedRequestId', '==', requestId)
      .where('type', '==', 'feeBurn')
      .get();
    expect(fees.size).toBe(1);
  });

  it('force-complete style: release-then-complete equals the cron outcome', async () => {
    // The forceCompleteBounty callable replays the same idempotency keys,
    // so a cron release followed by a force-complete must not double-pay.
    await release({ now: new Date('2026-06-03T09:00:00Z') }); // cron paid Mon-Wed
    await release(); // force pays the rest
    await completeRequest(db, teamId, requestId, 'coverer');
    expect(await covererBalanceDelta('coverer')).toBe(24); // 25 − 1 fee
  });
});
