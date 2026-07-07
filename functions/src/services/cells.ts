import { ECONOMY } from '../_shared';

/**
 * Account-day "cell" helpers. A cell is one account covered on one calendar
 * day — the billable unit of coverage. Everything (cost, escrow keys, release
 * keys, coverer maps) is keyed by the composite `${accountId}__${dayKey}`,
 * which is a strict generalization of the old per-day model (one implicit
 * account degenerates to today's behaviour).
 */

export interface Cell {
  accountId: string;
  dayKey: string;
}

/** Used for legacy / single-account bounties that carry no explicit account. */
export const IMPLICIT_ACCOUNT_ID = '_general';

/** Composite map/idempotency key for a cell. accountId + dayKey are both
 * constrained to `[A-Za-z0-9_-]` / `YYYY-MM-DD`, so this is a safe doc-id
 * fragment (no slashes) and unambiguous. */
export function cellKey(accountId: string, dayKey: string): string {
  return `${accountId}__${dayKey}`;
}

/**
 * Doubloons to cover ONE account for ONE day. Weekends (Sat/Sun) pay the
 * multiplier. `dayKey` is YYYY-MM-DD interpreted as UTC midnight, so the
 * day-of-week has no timezone ambiguity. This is THE canonical cost/price
 * function — create, accept, release, and force-complete all use it.
 */
export function dayCostForKey(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6
    ? ECONOMY.COVERAGE_PRICE_PER_ACCOUNT_DAY * ECONOMY.WEEKEND_MULTIPLIER
    : ECONOMY.COVERAGE_PRICE_PER_ACCOUNT_DAY;
}

/** Total cost of a set of cells. */
export function cellsCost(cells: Cell[]): number {
  return cells.reduce((sum, c) => sum + dayCostForKey(c.dayKey), 0);
}

/**
 * Stable short id for the set of cells claimed in one accept call. Scopes the
 * escrow idempotency key so two different claims by the same coverer never
 * collide, while re-submitting the identical claim stays idempotent.
 * FNV-1a → base36.
 */
export function claimIdFromCellKeys(cellKeys: string[]): string {
  const joined = cellKeys.slice().sort().join('|');
  let h = 2166136261;
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
