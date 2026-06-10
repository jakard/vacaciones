import { describe, expect, it } from 'vitest';

import { ECONOMY, computeCoverageCost } from '../../src/_shared';

describe('economy constants', () => {
  it('keeps the launch pricing contract', () => {
    expect(ECONOMY.COVERAGE_PRICE_PER_DAY).toBe(5);
    expect(ECONOMY.WEEKEND_MULTIPLIER).toBe(2);
    expect(ECONOMY.ONBOARDING_GRANT).toBe(125);
    expect(ECONOMY.MONTHLY_STIPEND).toBe(11);
    expect(ECONOMY.TRANSACTION_FEE).toBe(1);
  });

  it('onboarding grant covers 25 business days', () => {
    expect(ECONOMY.ONBOARDING_GRANT).toBe(
      ECONOMY.DEFAULT_ANNUAL_PTO_DAYS * ECONOMY.COVERAGE_PRICE_PER_DAY,
    );
  });
});

describe('computeCoverageCost', () => {
  it('prices a Mon-Fri business week at 25', () => {
    // 2026-06-01 is a Monday.
    const r = computeCoverageCost(
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-05T00:00:00Z'),
    );
    expect(r).toEqual({ totalCoins: 25, weekdays: 5, weekendDays: 0, days: 5 });
  });

  it('prices a full week with the weekend multiplier', () => {
    // Mon 06-01 .. Sun 06-07 → 5×5 + 2×10 = 45.
    const r = computeCoverageCost(
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-07T00:00:00Z'),
    );
    expect(r.totalCoins).toBe(45);
    expect(r.weekdays).toBe(5);
    expect(r.weekendDays).toBe(2);
    expect(r.days).toBe(7);
  });

  it('prices a single Saturday at the multiplier', () => {
    // 2026-06-06 is a Saturday.
    const r = computeCoverageCost(
      new Date('2026-06-06T09:00:00Z'),
      new Date('2026-06-06T18:00:00Z'),
    );
    expect(r.totalCoins).toBe(10);
    expect(r.days).toBe(1);
  });

  it('returns zeros for an inverted window', () => {
    const r = computeCoverageCost(
      new Date('2026-06-05T00:00:00Z'),
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(r).toEqual({ totalCoins: 0, weekdays: 0, weekendDays: 0, days: 0 });
  });

  it('counts partial days at the endpoints as full days', () => {
    // Tue 14:00 → Wed 10:00 still bills both calendar days.
    const r = computeCoverageCost(
      new Date('2026-06-02T14:00:00Z'),
      new Date('2026-06-03T10:00:00Z'),
    );
    expect(r.days).toBe(2);
    expect(r.totalCoins).toBe(10);
  });
});
