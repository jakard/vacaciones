import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { TeamService } from '../team/team.service';

@Component({
  selector: 'app-home',
  imports: [FormsModule, RouterLink],
  template: `
    @let u = user();
    @if (u) {
      <main class="home">
        <section class="hero">
          <h1>Welcome, {{ firstName(u.displayName) }}</h1>
          <p>Pick a team to manage requests, or start a new one.</p>
        </section>

        <section class="teams-section">
          <h2>Your teams</h2>
          @let teams = myTeams();
          @if (teams.length === 0) {
            <div class="empty">
              <p>You haven't joined a team yet.</p>
              <p class="muted">Use the cards below to create your own or join an existing one.</p>
            </div>
          } @else {
            <ul class="teams">
              @for (t of teams; track t.id) {
                <li>
                  <a [routerLink]="['/team', t.id]" class="team-card">
                    <div class="team-main">
                      <strong>{{ t.name }}</strong>
                      <small>{{ t.memberUids.length }} member{{ t.memberUids.length === 1 ? '' : 's' }}</small>
                    </div>
                    <code class="team-id" title="Team ID — share to invite">{{ t.id }}</code>
                    <span class="arrow" aria-hidden="true">→</span>
                  </a>
                </li>
              }
            </ul>
          }
        </section>

        <section class="actions">
          <div class="card">
            <h3>Create a team</h3>
            <p class="muted">You become the manager. Members you invite each get 20 coins to start.</p>
            <div class="row">
              <input
                type="text"
                [(ngModel)]="newTeamName"
                placeholder="Team name"
                [disabled]="busy()"
                maxlength="100" />
              <button type="button" class="primary" (click)="createTeam()" [disabled]="busy() || !newTeamName().trim()">
                Create
              </button>
            </div>
          </div>

          <div class="card">
            <h3>Join an existing team</h3>
            <p class="muted">Paste the team ID a teammate shared with you.</p>
            <div class="row">
              <input
                type="text"
                [(ngModel)]="joinTeamId"
                placeholder="Team ID"
                [disabled]="busy()" />
              <button type="button" class="primary" (click)="joinTeam()" [disabled]="busy() || !joinTeamId().trim()">
                Join
              </button>
            </div>
          </div>
        </section>

        @if (message()) {
          <p class="toast success" role="status">{{ message() }}</p>
        }
        @if (error()) {
          <p class="toast error" role="alert">{{ error() }}</p>
        }
      </main>
    }
  `,
  styles: `
    .home {
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }
    .hero { margin-bottom: 2rem; }
    .hero h1 { font-size: 1.75rem; margin: 0 0 0.3rem; }
    .hero p { color: var(--color-muted); margin: 0; }

    section { margin-bottom: 2rem; }
    h2 { font-size: 1.1rem; margin: 0 0 0.8rem; }
    h3 { font-size: 1rem; margin: 0 0 0.4rem; }
    .muted { color: var(--color-muted); margin: 0; }

    .empty {
      padding: 1.5rem;
      background: var(--color-surface);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius);
      text-align: center;
    }
    .empty p { margin: 0.2rem 0; }

    .teams { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.7rem; }
    .team-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.2rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      color: var(--color-text);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .team-card:hover {
      text-decoration: none;
      border-color: var(--color-primary);
      box-shadow: var(--shadow-sm);
    }
    .team-main { flex: 1; display: flex; flex-direction: column; }
    .team-main strong { font-size: 1.05rem; font-weight: 500; }
    .team-main small { color: var(--color-muted); }
    .team-id {
      background: var(--color-bg);
      padding: 0.25rem 0.55rem;
      border-radius: var(--radius-sm);
      font-size: 0.78rem;
      font-family: 'Roboto Mono', monospace, monospace;
      color: var(--color-text-soft);
    }
    .arrow { color: var(--color-muted); font-size: 1.1rem; }

    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .card {
      padding: 1.25rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
    }
    .card .muted { margin-bottom: 0.8rem; font-size: 0.85rem; }
    .row { display: flex; gap: 0.5rem; }
    .row input { flex: 1; padding: 0.55rem 0.7rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); }
    .row input:focus { outline: none; border-color: var(--color-primary); }

    button.primary {
      padding: 0.55rem 1.1rem;
      background: var(--color-primary);
      color: white;
      border: 1px solid var(--color-primary);
      border-radius: var(--radius-sm);
    }
    button.primary:hover:not([disabled]) { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
    button.primary[disabled] { opacity: 0.5; cursor: not-allowed; }

    .toast {
      padding: 0.7rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      margin: 0;
    }
    .toast.success { color: var(--color-success); background: var(--color-success-soft); }
    .toast.error { color: var(--color-error); background: var(--color-error-soft); }

    @media (max-width: 700px) {
      .actions { grid-template-columns: 1fr; }
    }
  `,
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  private readonly teamService = inject(TeamService);

  readonly user = this.auth.user;
  readonly myTeams = this.teamService.myTeams;

  readonly newTeamName = signal('');
  readonly joinTeamId = signal('');
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  firstName(displayName: string | null): string {
    if (!displayName) return 'there';
    return displayName.split(' ')[0] ?? displayName;
  }

  async createTeam(): Promise<void> {
    const name = this.newTeamName().trim();
    if (!name) return;
    this.busy.set(true);
    this.message.set(null);
    this.error.set(null);
    try {
      const teamId = await this.teamService.createTeam(name);
      this.newTeamName.set('');
      this.message.set(`Team "${name}" created (id: ${teamId}).`);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  async joinTeam(): Promise<void> {
    const teamId = this.joinTeamId().trim();
    if (!teamId) return;
    this.busy.set(true);
    this.message.set(null);
    this.error.set(null);
    try {
      const { alreadyMember } = await this.teamService.joinTeam(teamId);
      this.joinTeamId.set('');
      this.message.set(
        alreadyMember
          ? 'You are already a member of that team.'
          : 'Joined the team. Onboarding grant applied.',
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
