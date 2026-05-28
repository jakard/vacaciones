import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  template: `
    <main class="login">
      <section class="card">
        <div class="logo">V</div>
        <h1>Vacaciones</h1>
        <p class="tagline">Coverage marketplace for Google TAMs.</p>
        <p class="explainer">
          Post your time off. Earn coins by covering teammates. Spend coins on
          your own coverage. The most helpful person each quarter wins.
        </p>
        <button type="button" class="google" (click)="signIn()" [disabled]="busy()">
          @if (busy()) {
            <span class="spinner" aria-hidden="true"></span>
            Signing in&hellip;
          } @else {
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Sign in with Google
          }
        </button>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </section>
    </main>
  `,
  styles: `
    .login {
      min-height: calc(100vh - 60px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .logo {
      width: 56px; height: 56px;
      margin: 0 auto 1rem;
      border-radius: 14px;
      background: var(--color-primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.5rem;
    }
    h1 { margin: 0 0 0.3rem; font-size: 1.5rem; }
    .tagline { color: var(--color-muted); margin: 0 0 1.5rem; }
    .explainer {
      color: var(--color-text-soft);
      font-size: 0.875rem;
      margin: 0 0 2rem;
      line-height: 1.6;
    }
    .google {
      display: inline-flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.65rem 1.4rem;
      border: 1px solid var(--color-border-strong);
      background: white;
      color: var(--color-text);
      border-radius: var(--radius-sm);
      font-weight: 500;
    }
    .google:hover { background: var(--color-bg); box-shadow: var(--shadow-sm); }
    .google[disabled] { opacity: 0.6; cursor: wait; }
    .error {
      color: var(--color-error);
      background: var(--color-error-soft);
      padding: 0.6rem 0.9rem;
      border-radius: var(--radius-sm);
      margin: 1rem 0 0;
      font-size: 0.875rem;
    }
    .spinner {
      width: 14px; height: 14px;
      border: 2px solid var(--color-border-strong);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
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
