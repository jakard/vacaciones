import { Injectable, inject } from '@angular/core';
import {
  collection,
  collectionData,
  Firestore,
  query,
  Timestamp,
  where,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';

export interface TeamRow {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  createdAt: Timestamp | null;
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);
  private readonly authService = inject(AuthService);

  private readonly myTeams$: Observable<TeamRow[]> = toObservable(
    this.authService.user,
  ).pipe(
    switchMap((u) => {
      if (!u) return of([] as TeamRow[]);
      const q = query(
        collection(this.firestore, 'teams'),
        where('memberUids', 'array-contains', u.uid),
      );
      return collectionData(q, { idField: 'id' }) as Observable<TeamRow[]>;
    }),
  );

  readonly myTeams = toSignal(this.myTeams$, { initialValue: [] });

  async createTeam(name: string): Promise<string> {
    const fn = httpsCallable<{ name: string }, { teamId: string }>(
      this.functions,
      'createTeam',
    );
    const result = await fn({ name });
    return result.data.teamId;
  }

  async joinTeam(teamId: string): Promise<{ alreadyMember: boolean }> {
    const fn = httpsCallable<
      { teamId: string },
      { teamId: string; alreadyMember: boolean }
    >(this.functions, 'joinTeam');
    const result = await fn({ teamId });
    return { alreadyMember: result.data.alreadyMember };
  }
}
