import { ECONOMY } from './constants';

export interface CoverageCostBreakdown {
  totalCoins: number;
  weekdays: number;
  weekendDays: number;
  days: number;
}

/**
 * Compute the coin cost of covering a date window. Phase 1 uses UTC
 * calendar days and a flat weekend multiplier. Holidays and timezone-
 * aware day boundaries are Phase 2.
 *
 * Both endpoints are inclusive on calendar-day boundaries: any portion
 * of a day inside the window counts as a full day.
 */
export function computeCoverageCost(
  windowStart: Date,
  windowEnd: Date,
): CoverageCostBreakdown {
  if (windowEnd < windowStart) {
    return { totalCoins: 0, weekdays: 0, weekendDays: 0, days: 0 };
  }

  const cursor = startOfUtcDay(windowStart);
  const last = startOfUtcDay(windowEnd);
  let totalCoins = 0;
  let weekdays = 0;
  let weekendDays = 0;
  let days = 0;

  while (cursor.getTime() <= last.getTime()) {
    const dow = cursor.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const multiplier = isWeekend ? ECONOMY.WEEKEND_MULTIPLIER : 1;
    totalCoins += ECONOMY.COVERAGE_PRICE_PER_DAY * multiplier;
    if (isWeekend) weekendDays++;
    else weekdays++;
    days++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { totalCoins, weekdays, weekendDays, days };
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}
