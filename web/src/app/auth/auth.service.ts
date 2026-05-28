import { Injectable, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  user,
  User,
} from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { toSignal } from '@angular/core/rxjs-interop';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly functions = inject(Functions);

  readonly user = toSignal(user(this.auth), { initialValue: null });

  isSignedIn(): boolean {
    return this.user() !== null;
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    if (environment.authDomainRestriction) {
      provider.setCustomParameters({ hd: environment.authDomainRestriction });
    }
    const result = await signInWithPopup(this.auth, provider);
    await this.initUser();
    return result.user;
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  private async initUser(): Promise<void> {
    const initUser = httpsCallable<unknown, { initialized: boolean; uid: string }>(
      this.functions,
      'initUser',
    );
    await initUser();
  }
}
