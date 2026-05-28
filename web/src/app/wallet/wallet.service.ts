import { Injectable, inject } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  docData,
  Firestore,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

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

export interface WalletDoc {
  earnedBalance: number;
  stipendBalance: number;
  updatedAt: Timestamp | null;
  lastEntryId: string | null;
  stipendPeriodStart: Timestamp | null;
}

export interface LedgerEntryRow {
  id: string;
  uid: string;
  type: LedgerEntryType;
  amountSigned: number;
  balanceBucket: LedgerBucket;
  relatedRequestId: string | null;
  createdAt: Timestamp | null;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly firestore = inject(Firestore);

  wallet(teamId: string, uid: string): Observable<WalletDoc | undefined> {
    const ref = doc(this.firestore, `teams/${teamId}/wallets/${uid}`);
    return docData(ref) as Observable<WalletDoc | undefined>;
  }

  recentEntries(
    teamId: string,
    uid: string,
    max = 20,
  ): Observable<LedgerEntryRow[]> {
    const q = query(
      collection(this.firestore, `teams/${teamId}/ledgerEntries`),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    return collectionData(q, { idField: 'id' }) as Observable<
      LedgerEntryRow[]
    >;
  }
}
