import { Injectable, Signal, inject } from '@angular/core';
import {
  Timestamp,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase/firebase.service';
import { collectionData$ } from '../firebase/firebase.helpers';

export interface TeamRow {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  createdAt: Timestamp | null;
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly fb = inject(FirebaseService);
  private readonly authService = inject(AuthService);

  readonly myTeams: Signal<TeamRow[]>;

  constructor() {
    const myTeams$ = toObservable(this.authService.user).pipe(
      switchMap((u) => {
        if (!u) return of([] as TeamRow[]);
        const q = query(
          collection(this.fb.firestore, 'teams'),
          where('memberUids', 'array-contains', u.uid),
        );
        return collectionData$<TeamRow>(q, 'id');
      }),
    );
    this.myTeams = toSignal(myTeams$, { initialValue: [] });
  }

  async createTeam(name: string): Promise<string> {
    const fn = httpsCallable<{ name: string }, { teamId: string }>(
      this.fb.functions,
      'createTeam',
    );
    const result = await fn({ name });
    return result.data.teamId;
  }

  async joinTeam(teamId: string): Promise<{ alreadyMember: boolean }> {
    const fn = httpsCallable<
      { teamId: string },
      { teamId: string; alreadyMember: boolean }
    >(this.fb.functions, 'joinTeam');
    const result = await fn({ teamId });
    return { alreadyMember: result.data.alreadyMember };
  }
}
