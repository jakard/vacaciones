import { describe, expect, it } from 'vitest';

import {
  cellKey,
  cellsCost,
  dayCostForKey,
  claimIdFromCellKeys,
} from '../../src/services/cells';

describe('account × day cell helpers', () => {
  it('weekday costs 5, weekend costs 10 (weekend = 2×)', () => {
    // 2026-07-06 = Monday, 2026-07-04 = Saturday, 2026-07-05 = Sunday.
    expect(new Date('2026-07-06T00:00:00Z').getUTCDay()).toBe(1);
    expect(new Date('2026-07-04T00:00:00Z').getUTCDay()).toBe(6);
    expect(dayCostForKey('2026-07-06')).toBe(5);
    expect(dayCostForKey('2026-07-04')).toBe(10);
    expect(dayCostForKey('2026-07-05')).toBe(10);
  });

  it('cellsCost sums the per-day cost across every cell (per account-day)', () => {
    const cells = [
      { accountId: 'acme', dayKey: '2026-07-06' }, // Mon 5
      { accountId: 'globex', dayKey: '2026-07-06' }, // Mon 5 (2nd account, same day)
      { accountId: 'acme', dayKey: '2026-07-04' }, // Sat 10
    ];
    expect(cellsCost(cells)).toBe(20);
  });

  it('cellKey is a stable composite of account + day', () => {
    expect(cellKey('acme', '2026-07-06')).toBe('acme__2026-07-06');
  });

  it('claimId is deterministic + order-independent, and scopes distinct claims apart', () => {
    const a = claimIdFromCellKeys(['x__2026-07-06', 'y__2026-07-07']);
    const b = claimIdFromCellKeys(['y__2026-07-07', 'x__2026-07-06']);
    expect(a).toBe(b); // order-independent
    expect(claimIdFromCellKeys(['x__2026-07-06'])).not.toBe(a); // different set → different id
  });
});
