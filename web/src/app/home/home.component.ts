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

        <section class="teams">
          <h2>Your teams</h2>
          @let teams = myTeams();
          @if (teams.length === 0) {
            <p class="muted">You haven't joined a team yet.</p>
          } @else {
            <ul>
              @for (t of teams; track t.id) {
                <li>
                  <a [routerLink]="['/team', t.id]">
                    <strong>{{ t.name }}</strong>
                  </a>
                  <code class="team-id" title="Share this ID to invite others">{{ t.id }}</code>
                  <small>{{ t.memberUids.length }} member{{ t.memberUids.length === 1 ? '' : 's' }}</small>
                </li>
              }
            </ul>
          }
        </section>

        <section class="actions">
          <div class="card">
            <h3>Create a team</h3>
            <input
              type="text"
              [(ngModel)]="newTeamName"
              placeholder="Team name"
              [disabled]="busy()"
              maxlength="100" />
            <button type="button" (click)="createTeam()" [disabled]="busy() || !newTeamName().trim()">
              Create
            </button>
          </div>

          <div class="card">
            <h3>Join a team</h3>
            <input
              type="text"
              [(ngModel)]="joinTeamId"
              placeholder="Team ID"
              [disabled]="busy()" />
            <button type="button" (click)="joinTeam()" [disabled]="busy() || !joinTeamId().trim()">
              Join
            </button>
          </div>
        </section>

        @if (message()) {
          <p class="message" role="status">{{ message() }}</p>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </main>
    }
  `,
  styles: `
    .home { padding: 2rem; max-width: 960px; margin: 0 auto; }
    header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
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
    button[disabled] { opacity: 0.5; cursor: not-allowed; }
    section { margin: 1.5rem 0; }
    h2 { font-size: 1.2rem; margin: 0 0 0.5rem; }
    .muted { color: #888; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    li { display: flex; align-items: center; gap: 1rem; padding: 0.6rem 1rem; border: 1px solid #eee; border-radius: 4px; }
    .team-id { background: #f4f4f4; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.85rem; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .card { padding: 1rem; border: 1px solid #eee; border-radius: 4px; }
    .card h3 { margin: 0 0 0.6rem; font-size: 1rem; }
    .card input { width: 100%; padding: 0.5rem; box-sizing: border-box; margin-bottom: 0.6rem; }
    .message { color: #1a73e8; }
    .error { color: #b00020; }
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

  async signOut(): Promise<void> {
    await this.auth.signOut();
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
      this.message.set(`Team "${name}" created (${teamId}).`);
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
          : 'Joined the team.',
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
