export interface UserDoc {
  email: string;
  displayName: string;
  photoURL: string | null;
  googleUserId: string;
  createdAt: FirestoreTimestamp;
}

export interface WorkspaceTokenDoc {
  provider: 'google';
  scopes: string[];
  updatedAt: FirestoreTimestamp;
}

export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}
