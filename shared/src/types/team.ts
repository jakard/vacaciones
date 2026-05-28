import type { FirestoreTimestamp } from './user';

export interface TeamDoc {
  name: string;
  ownerUid: string;
  memberUids: string[];
  createdAt: FirestoreTimestamp;
}

export type TeamMemberRole = 'member' | 'manager';

export interface TeamMemberDoc {
  uid: string;
  role: TeamMemberRole;
  joinedAt: FirestoreTimestamp;
  onboardingGrantReceivedAt: FirestoreTimestamp | null;
}
