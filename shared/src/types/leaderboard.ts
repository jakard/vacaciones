import type { FirestoreTimestamp } from './user';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  earnedInWindow: number;
}

export interface LeaderboardDoc {
  windowStart: FirestoreTimestamp;
  windowEnd: FirestoreTimestamp;
  generatedAt: FirestoreTimestamp;
  rankings: LeaderboardEntry[];
}
