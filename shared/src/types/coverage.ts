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

export interface CoverageRequestDoc {
  requesterUid: string;
  covererUid: string | null;
  windowStart: FirestoreTimestamp;
  windowEnd: FirestoreTimestamp;
  timezone: string;
  reachability: Reachability;
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
