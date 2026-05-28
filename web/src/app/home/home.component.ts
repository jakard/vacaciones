import { Component, inject } from '@angular/core';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-home',
  template: `
    @let u = user();
    @if (u) {
      <main class="home">
        <header>
          @if (u.photoURL) {
            <img [src]="u.photoURL" [alt]="u.displayName ?? ''" referrerpolicy="no-referrer" />
          }
          <div class="who">
            <strong>{{ u.displayName }}</strong>
            <small>{{ u.email }}</small>
          </div>
          <button type="button" (click)="signOut()">Sign out</button>
        </header>
        <section>
          <p>Signed in. Phase 1 milestones land here.</p>
        </section>
      </main>
    }
  `,
  styles: `
    .home { padding: 2rem; max-width: 960px; margin: 0 auto; }
    header { display: flex; align-items: center; gap: 1rem; }
    img { width: 48px; height: 48px; border-radius: 50%; }
    .who { display: flex; flex-direction: column; flex: 1; }
    small { color: #666; }
    button {
      padding: 0.5rem 1rem;
      cursor: pointer;
      border-radius: 4px;
      border: 1px solid #ccc;
      background: white;
    }
  `,
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.user;

  signOut(): Promise<void> {
    return this.auth.signOut();
  }
}
