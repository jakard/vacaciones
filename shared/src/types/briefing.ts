import type { FirestoreTimestamp } from './user';

export interface ContactRef {
  name: string;
  email: string;
}

export interface BriefingDoc {
  coverageRequestId: string;
  managerEscalation: ContactRef | null;
  skipLevel: ContactRef | null;
  recurringMeetingsAttend: string[];
  recurringMeetingsDecline: string[];
  autoResponderText: string | null;
  ackAt: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export type AccountTier = 'strategic' | 'enterprise' | 'growth';
export type RelationshipTemp = 'healthy' | 'watch' | 'at-risk' | 'escalated';

export interface Stakeholder {
  name: string;
  role: string;
  email: string;
  preferredChannel?: string;
  toneNotes?: string;
}

export interface Escalation {
  title: string;
  severity: string;
  openedAt: FirestoreTimestamp;
  owner: string;
  lastUpdate: string;
  link?: string;
}

export interface ActionItem {
  description: string;
  promisedBy: FirestoreTimestamp | null;
}

export interface HardDeadline {
  description: string;
  dueDate: FirestoreTimestamp;
}

export interface ChatSpaceRef {
  name: string;
  link: string;
}

export interface ClientCardDoc {
  accountName: string;
  tier: AccountTier;
  arrBucket: string | null;
  renewalDate: FirestoreTimestamp | null;
  identity: {
    stakeholders: Stakeholder[];
    region: string | null;
    relationshipTemp: RelationshipTemp | null;
    googleProducts: string[];
    internalTeam: Stakeholder[];
  };
  actOnNow: {
    openEscalations: Escalation[];
    outstandingActionItems: ActionItem[];
    hardDeadlines: HardDeadline[];
  };
  awareness: {
    activitySummary30d: string | null;
    strategicNarrative: string | null;
    chatSpaces: ChatSpaceRef[];
  };
  gotchas: {
    sensitiveTopics: string | null;
    communicationPrefs: string | null;
    knownIssues: string | null;
  };
}
