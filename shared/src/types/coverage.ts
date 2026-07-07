import type { FirestoreTimestamp } from './user';

export type CoverageStatus =
  | 'draft'
  | 'open'
  | 'accepted'
  | 'active'
  | 'completed'
  | 'cancelled';

export type Reachability =
  | 'unreachable'
  | 'email-only-emergencies'
  | 'phone-emergencies'
  | 'daily-check-in';

export type CoverageMode = 'single' | 'crew';

/** A customer account a TAM owns (their "book of business"). */
export interface Account {
  id: string;
  name: string;
  archived?: boolean;
}

/**
 * The billable unit of coverage: one account on one calendar day.
 * `dayKey` is a YYYY-MM-DD calendar key. The map key used across the
 * ledger + coverer maps is `${accountId}__${dayKey}` (see cellKey()).
 */
export interface CoverageCell {
  accountId: string;
  dayKey: string;
}

/** Denormalized coverer identity stored on the request. */
export interface Coverer {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

/**
 * The real runtime shape of a coverage request. Coverage is split by
 * (account × day) `cells`; `cellCoverers` maps `${accountId}__${dayKey}`
 * to the crewmate who claimed it. Legacy bounties predate `accounts`/
 * `cells` and instead carry `selectedDayKeys` + `dayCoverers` — the
 * release/complete engines fall back to those when `cells` is absent.
 */
export interface CoverageRequestDoc {
  requesterUid: string;
  requesterDisplayName?: string;
  requesterPhotoURL?: string | null;
  /** Single-mode coverer; null in crew / multi-account mode. */
  covererUid: string | null;
  covererDisplayName?: string | null;
  covererPhotoURL?: string | null;
  windowStart: FirestoreTimestamp;
  windowEnd: FirestoreTimestamp;
  timezone: string;
  reachability: Reachability[];
  coverageKinds?: string[];
  coverageScope?: string | null;
  coverageMode?: CoverageMode;
  /** Accounts this bounty covers (snapshot at post time). */
  accounts?: Account[];
  /** Billable (account × day) cells needing coverage. */
  cells?: CoverageCell[];
  /** `${accountId}__${dayKey}` → coverer. Authoritative claim map. */
  cellCoverers?: Record<string, Coverer>;
  /** Legacy: distinct day keys; kept for back-compat readers. */
  selectedDayKeys?: string[];
  /** Legacy per-day claim map (pre-account bounties). */
  dayCoverers?: Record<string, Coverer>;
  coverers?: Coverer[];
  sla: string;
  emergencyDef: string | null;
  status: CoverageStatus;
  totalCoinsOffered: number;
  coinsEscrowed: number;
  coinsReleased: number;
  briefingId: string | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
