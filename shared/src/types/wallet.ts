import type { FirestoreTimestamp } from './user';

export interface WalletDoc {
  earnedBalance: number;
  stipendBalance: number;
  stipendPeriodStart: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  lastEntryId: string | null;
}

export type LedgerEntryType =
  | 'grant'
  | 'stipendMint'
  | 'stipendExpire'
  | 'escrowIn'
  | 'escrowOut'
  | 'coverageRelease'
  | 'feeBurn'
  | 'managerAdvance';

export type LedgerBucket = 'earned' | 'stipend';

export interface LedgerEntryDoc {
  uid: string;
  type: LedgerEntryType;
  amountSigned: number;
  balanceBucket: LedgerBucket;
  relatedRequestId: string | null;
  createdAt: FirestoreTimestamp;
}
