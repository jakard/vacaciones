import { Injectable, inject } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { toSignal } from '@angular/core/rxjs-interop';

import { environment } from '../../environments/environment';
import { FirebaseService } from '../firebase/firebase.service';
import { authUser$ } from '../firebase/firebase.helpers';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly fb = inject(FirebaseService);

  readonly user = toSignal(authUser$(this.fb.auth), { initialValue: null });

  isSignedIn(): boolean {
    return this.user() !== null;
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    if (environment.authDomainRestriction) {
      provider.setCustomParameters({ hd: environment.authDomainRestriction });
    }
    const result = await signInWithPopup(this.fb.auth, provider);
    await this.initUser();
    return result.user;
  }

  async signOut(): Promise<void> {
    await signOut(this.fb.auth);
  }

  private async initUser(): Promise<void> {
    const fn = httpsCallable<unknown, { initialized: boolean; uid: string }>(
      this.fb.functions,
      'initUser',
    );
    await fn();
  }
}
