import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <main class="login">
      <h1>Vacaciones</h1>
      <p>Coverage marketplace for Google TAMs.</p>
      <button type="button" (click)="signIn()" [disabled]="busy()">
        @if (busy()) {
          Signing in&hellip;
        } @else {
          Sign in with Google
        }
      </button>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </main>
  `,
  styles: `
    .login {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 4rem 2rem;
      max-width: 480px;
      margin: 0 auto;
    }
    h1 { margin: 0; font-size: 2rem; }
    p { color: #555; margin: 0; }
    button {
      padding: 0.7rem 1.4rem;
      font-size: 1rem;
      cursor: pointer;
      border-radius: 4px;
      border: 1px solid #1a73e8;
      background: #1a73e8;
      color: white;
    }
    button[disabled] { opacity: 0.6; cursor: wait; }
    .error { color: #b00020; }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async signIn(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.signInWithGoogle();
      this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
