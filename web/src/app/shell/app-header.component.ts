import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  template: `
    @let u = user();
    @if (u) {
      <header class="app-header">
        <a routerLink="/" class="brand">
          <span class="logo">V</span>
          <span class="brand-name">Vacaciones</span>
        </a>
        <div class="user">
          @if (u.photoURL) {
            <img [src]="u.photoURL" [alt]="u.displayName ?? ''" referrerpolicy="no-referrer" />
          }
          <div class="who">
            <span class="name">{{ u.displayName }}</span>
            <span class="email">{{ u.email }}</span>
          </div>
          <button type="button" (click)="signOut()">Sign out</button>
        </div>
      </header>
    }
  `,
  styles: `
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 1.5rem;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-weight: 500;
      color: var(--color-text);
    }
    .brand:hover { text-decoration: none; }
    .brand-name { font-size: 1.05rem; }
    .logo {
      width: 32px; height: 32px;
      border-radius: 8px;
      background: var(--color-primary);
      color: white;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1rem;
    }
    .user { display: flex; align-items: center; gap: 0.8rem; }
    .user img {
      width: 34px; height: 34px;
      border-radius: 50%;
      border: 1px solid var(--color-border);
    }
    .who { display: flex; flex-direction: column; line-height: 1.2; }
    .name { font-weight: 500; }
    .email { font-size: 0.75rem; color: var(--color-muted); }
    button {
      padding: 0.45rem 0.9rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border-strong);
      background: white;
      color: var(--color-text);
    }
    button:hover { background: var(--color-bg); border-color: var(--color-muted); }
    @media (max-width: 540px) {
      .who { display: none; }
      .app-header { padding: 0.6rem 1rem; }
    }
  `,
})
export class AppHeaderComponent {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.user;
  signOut(): Promise<void> {
    return this.auth.signOut();
  }
}
