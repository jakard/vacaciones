import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { computeCoverageCost, ECONOMY } from '@vacaciones/shared';

import { AuthService } from '../auth/auth.service';
import {
  CoverageService,
  Reachability,
} from '../coverage/coverage.service';
import { WalletComponent } from '../wallet/wallet.component';
import { TeamService } from './team.service';

const REACHABILITY_OPTIONS: { value: Reachability; label: string }[] = [
  { value: 'unreachable', label: 'Unreachable' },
  { value: 'email-only-emergencies', label: 'Email only — emergencies' },
  { value: 'phone-emergencies', label: 'Phone for emergencies' },
  { value: 'daily-check-in', label: 'Daily check-in' },
];

@Component({
  selector: 'app-team-home',
  imports: [FormsModule, RouterLink, WalletComponent],
  template: `
    @let teams = myTeams();
    @let team = teams.find(t => t.id === teamId());
    @if (!team) {
      <main class="empty">
        <p>Team not found, or you are not a member.</p>
        <a routerLink="/">Back home</a>
      </main>
    } @else {
      <main class="team-home">
        <header>
          <a routerLink="/" class="back">← Back</a>
          <h1>{{ team.name }}</h1>
          <code class="team-id" title="Share to invite">{{ team.id }}</code>
        </header>

        <app-wallet [teamId]="teamId()" />

        <section>
          <h2>Open coverage requests</h2>
          @let reqs = openRequests();
          @if (reqs.length === 0) {
            <p class="muted">No open requests in this team yet.</p>
          } @else {
            <ul>
              @for (r of reqs; track r.id) {
                <li>
                  <div class="dates">
                    <strong>{{ formatDate(r.windowStart.toDate()) }} → {{ formatDate(r.windowEnd.toDate()) }}</strong>
                    <small>{{ r.timezone }} · {{ r.reachability }}</small>
                  </div>
                  <div class="price">
                    <strong>{{ r.totalCoinsOffered }}</strong>
                    <small>coins</small>
                  </div>
                  @if (r.requesterUid !== currentUid()) {
                    <button type="button"
                      class="accept"
                      [disabled]="acceptBusy() === r.id"
                      (click)="accept(r.id)">
                      @if (acceptBusy() === r.id) {
                        Accepting…
                      } @else {
                        Cover this
                      }
                    </button>
                  } @else {
                    <span class="own">Your request</span>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <section class="create">
          <h2>Post a new coverage request</h2>
          <div class="form">
            <label>
              <span>Window start (date)</span>
              <input type="date" [(ngModel)]="formStartDate" />
            </label>
            <label>
              <span>Window end (date)</span>
              <input type="date" [(ngModel)]="formEndDate" />
            </label>
            <label>
              <span>Timezone</span>
              <input type="text" [(ngModel)]="formTimezone" />
            </label>
            <label>
              <span>Reachability</span>
              <select [(ngModel)]="formReachability">
                @for (opt of reachabilityOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </label>
            <label class="wide">
              <span>SLA the coverer should hold</span>
              <input type="text" [(ngModel)]="formSla" placeholder="P1 within 2h, P2 next business day" />
            </label>
            <label class="wide">
              <span>Emergency definition (optional)</span>
              <textarea [(ngModel)]="formEmergencyDef" rows="2"
                placeholder="What counts as actually waking me up"></textarea>
            </label>
          </div>

          <div class="preview">
            @let cost = costPreview();
            @if (cost.days > 0) {
              <p>
                <strong>{{ cost.totalCoins }}</strong> coins
                · {{ cost.days }} day{{ cost.days === 1 ? '' : 's' }}
                ({{ cost.weekdays }} weekday, {{ cost.weekendDays }} weekend
                at {{ weekendMultiplier }}x)
              </p>
            } @else {
              <p class="muted">Pick a window to see the cost.</p>
            }
          </div>

          <button type="button"
            [disabled]="busy() || !canSubmit()"
            (click)="submit()">
            @if (busy()) { Posting… } @else { Post request }
          </button>

          @if (message()) { <p class="message" role="status">{{ message() }}</p> }
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        </section>
      </main>
    }
  `,
  styles: `
    main { padding: 2rem; max-width: 960px; margin: 0 auto; }
    .empty { text-align: center; }
    header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .back { color: #1a73e8; text-decoration: none; }
    h1 { margin: 0; font-size: 1.5rem; flex: 1; }
    .team-id { background: #f4f4f4; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.85rem; }
    section { margin: 1.5rem 0; }
    h2 { font-size: 1.1rem; margin: 0 0 0.6rem; }
    .muted { color: #888; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    li {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.7rem 1rem; border: 1px solid #eee; border-radius: 4px;
    }
    .dates strong { display: block; }
    .dates small { color: #666; }
    .price { text-align: right; }
    .price strong { font-size: 1.2rem; color: #1a73e8; }
    .price small { display: block; color: #666; }
    .accept {
      padding: 0.4rem 0.9rem;
      border-radius: 4px;
      border: 1px solid #1a73e8;
      background: white;
      color: #1a73e8;
      cursor: pointer;
    }
    .accept[disabled] { opacity: 0.5; cursor: wait; }
    .own { color: #999; font-size: 0.85rem; }
    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem 1rem; margin-bottom: 1rem; }
    .form label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.9rem; }
    .form label.wide { grid-column: 1 / -1; }
    .form input, .form select, .form textarea {
      padding: 0.45rem; border: 1px solid #ccc; border-radius: 3px;
      font-family: inherit; font-size: 1rem;
    }
    .preview { padding: 0.7rem 1rem; background: #f6f9ff; border-radius: 4px; margin-bottom: 1rem; }
    .preview p { margin: 0; }
    button {
      padding: 0.6rem 1.3rem; cursor: pointer; border-radius: 4px;
      border: 1px solid #1a73e8; background: #1a73e8; color: white;
    }
    button[disabled] { opacity: 0.5; cursor: not-allowed; }
    .message { color: #1a73e8; }
    .error { color: #b00020; }
  `,
})
export class TeamHomeComponent {
  private readonly teamService = inject(TeamService);
  private readonly coverageService = inject(CoverageService);
  private readonly authService = inject(AuthService);

  readonly teamId = input.required<string>();
  readonly myTeams = this.teamService.myTeams;
  readonly currentUid = computed(() => this.authService.user()?.uid ?? null);
  readonly reachabilityOptions = REACHABILITY_OPTIONS;
  readonly weekendMultiplier = ECONOMY.WEEKEND_MULTIPLIER;

  readonly openRequests = toSignal(
    toObservable(this.teamId).pipe(
      switchMap((id) =>
        id ? this.coverageService.openRequestsForTeam(id) : of([]),
      ),
    ),
    { initialValue: [] },
  );

  readonly formStartDate = signal('');
  readonly formEndDate = signal('');
  readonly formTimezone = signal(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  readonly formReachability = signal<Reachability>('email-only-emergencies');
  readonly formSla = signal('P1 within 2h, P2 next business day');
  readonly formEmergencyDef = signal('');

  readonly costPreview = computed(() => {
    const start = parseLocalDate(this.formStartDate());
    const end = parseLocalDate(this.formEndDate());
    if (!start || !end) {
      return { totalCoins: 0, days: 0, weekdays: 0, weekendDays: 0 };
    }
    return computeCoverageCost(start, end);
  });

  readonly canSubmit = computed(() => {
    const cost = this.costPreview();
    return cost.days > 0 && this.formSla().trim().length > 0;
  });

  readonly busy = signal(false);
  readonly acceptBusy = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  async accept(requestId: string): Promise<void> {
    this.acceptBusy.set(requestId);
    this.message.set(null);
    this.error.set(null);
    try {
      const result = await this.coverageService.acceptRequest(
        this.teamId(),
        requestId,
      );
      this.message.set(
        `Accepted. ${result.coinsEscrowed} coins held in escrow until release.`,
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.acceptBusy.set(null);
    }
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const start = parseLocalDate(this.formStartDate());
    const end = parseLocalDate(this.formEndDate());
    if (!start || !end) return;

    this.busy.set(true);
    this.message.set(null);
    this.error.set(null);
    try {
      const result = await this.coverageService.createRequest({
        teamId: this.teamId(),
        windowStartIso: start.toISOString(),
        windowEndIso: end.toISOString(),
        timezone: this.formTimezone(),
        reachability: this.formReachability(),
        sla: this.formSla().trim(),
        emergencyDef: this.formEmergencyDef().trim() || null,
      });
      this.message.set(
        `Request posted for ${result.coinsOffered} coins (id: ${result.requestId}).`,
      );
      this.formStartDate.set('');
      this.formEndDate.set('');
      this.formEmergencyDef.set('');
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}

function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map((s) => Number(s));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}
