export const ECONOMY = {
  // 25 business days × 5 doubloons/day = 125 — covers a typical year of
  // PTO out of the chest right at sign-up. Monthly stipend on top is the
  // recurring budget that keeps the year-after-year math working.
  ONBOARDING_GRANT: 125,
  // 12 * 11 = 132 doubloons/year — covers 25 business days at 5/day
  // (125 doubloons) with margin for one or two weekend covers.
  MONTHLY_STIPEND: 11,
  COVERAGE_PRICE_PER_DAY: 5,
  // Price of covering ONE account for ONE weekday. Coverage is billed per
  // (account × day) cell, so a day covering N accounts costs N × this.
  // This is the single knob to lower if per-account-day budgets feel tight.
  COVERAGE_PRICE_PER_ACCOUNT_DAY: 5,
  COVERAGE_PRICE_HALF_DAY: 2,
  WEEKEND_MULTIPLIER: 2,
  HOLIDAY_MULTIPLIER: 2,
  TRANSACTION_FEE: 1,
  LEADERBOARD_WINDOW_DAYS: 90,
  MAX_GIFT_PER_WEEK: 5,
  MAX_MANAGER_ADVANCE_PER_QUARTER: 10,
  // Reference: default 25 business days of PTO per year per crewmate.
  DEFAULT_ANNUAL_PTO_DAYS: 25,
} as const;
