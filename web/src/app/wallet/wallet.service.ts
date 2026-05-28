import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  collection,
  doc,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Observable } from 'rxjs';

import { FirebaseService } from '../firebase/firebase.service';
import { collectionData$, docData$ } from '../firebase/firebase.helpers';

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
  private readonly fb = inject(FirebaseService);

  wallet(teamId: string, uid: string): Observable<WalletDoc | undefined> {
    const ref = doc(this.fb.firestore, `teams/${teamId}/wallets/${uid}`);
    return docData$<WalletDoc>(ref);
  }

  recentEntries(
    teamId: string,
    uid: string,
    max = 20,
  ): Observable<LedgerEntryRow[]> {
    const q = query(
      collection(this.fb.firestore, `teams/${teamId}/ledgerEntries`),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    return collectionData$<LedgerEntryRow>(q, 'id');
  }
}
