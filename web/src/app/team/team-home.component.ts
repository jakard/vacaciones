import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { computeCoverageCost, ECONOMY } from '@vacaciones/shared';

import { AuthService } from '../auth/auth.service';
import {
  CoverageRequestRow,
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
        <div class="card">
          <h2>Team not found</h2>
          <p>You may not be a member, or the team ID is invalid.</p>
          <a routerLink="/" class="link">← Back to your teams</a>
        </div>
      </main>
    } @else {
      <main class="team-home">
        <nav class="breadcrumb">
          <a routerLink="/">Teams</a>
          <span class="sep">/</span>
          <span class="current">{{ team.name }}</span>
        </nav>

        <header class="team-header">
          <div>
            <h1>{{ team.name }}</h1>
            <small>
              {{ team.memberUids.length }} member{{ team.memberUids.length === 1 ? '' : 's' }} ·
              ID: <code>{{ team.id }}</code>
            </small>
          </div>
        </header>

        <app-wallet [teamId]="teamId()" />

        <section>
          <div class="section-head">
            <h2>Open coverage requests</h2>
          </div>
          @let reqs = openRequests();
          @if (reqs.length === 0) {
            <div class="empty-inline">
              <p>No open requests in this team yet.</p>
              <small>Post one below — your teammates earn coins by covering you.</small>
            </div>
          } @else {
            <ul class="requests">
              @for (r of reqs; track r.id) {
                <li>
                  <div class="dates">
                    <strong>{{ formatDate(r.windowStart.toDate()) }} → {{ formatDate(r.windowEnd.toDate()) }}</strong>
                    <small>{{ r.timezone }} · {{ reachabilityLabel(r.reachability) }}</small>
                  </div>
                  <div class="sla" title="{{ r.sla }}">{{ r.sla }}</div>
                  <div class="price">
                    <strong>{{ r.totalCoinsOffered }}</strong>
                    <small>coins</small>
                  </div>
                  @if (r.requesterUid !== currentUid()) {
                    <button type="button"
                      class="accept primary"
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
          <div class="section-head">
            <h2>Post a coverage request</h2>
            <small>{{ weekendMultiplier }}x multiplier on Saturdays and Sundays</small>
          </div>
          <div class="form-grid">
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
              <input type="text" [(ngModel)]="formSla" placeholder="e.g. P1 within 2h, P2 next business day" />
            </label>
            <label class="wide">
              <span>Emergency definition (optional)</span>
              <textarea [(ngModel)]="formEmergencyDef" rows="2"
                placeholder="What counts as actually waking me up"></textarea>
            </label>
          </div>

          <div class="preview-row">
            <div class="preview">
              @let cost = costPreview();
              @if (cost.days > 0) {
                <div class="cost">
                  <strong>{{ cost.totalCoins }}</strong>
                  <span>coins</span>
                </div>
                <small>
                  {{ cost.days }} day{{ cost.days === 1 ? '' : 's' }}
                  · {{ cost.weekdays }} weekday, {{ cost.weekendDays }} weekend
                </small>
              } @else {
                <small class="muted">Pick a window to preview the cost.</small>
              }
            </div>
            <button type="button"
              class="primary large"
              [disabled]="busy() || !canSubmit()"
              (click)="submit()">
              @if (busy()) { Posting… } @else { Post request }
            </button>
          </div>

          @if (message()) { <p class="toast success" role="status">{{ message() }}</p> }
          @if (error()) { <p class="toast error" role="alert">{{ error() }}</p> }
        </section>
      </main>
    }
  `,
  styles: `
    main { max-width: 960px; margin: 0 auto; padding: 1.5rem 1.5rem 4rem; }
    .empty { padding: 4rem 1rem; display: flex; justify-content: center; }
    .empty .card {
      max-width: 400px; text-align: center;
      padding: 2rem; background: var(--color-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius);
    }
    .breadcrumb {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.85rem; color: var(--color-muted);
      margin-bottom: 0.5rem;
    }
    .sep { opacity: 0.5; }
    .current { color: var(--color-text); }

    .team-header {
      margin-bottom: 1.5rem;
    }
    .team-header h1 { margin: 0; font-size: 1.6rem; }
    .team-header small { color: var(--color-muted); }
    .team-header code {
      background: var(--color-bg);
      padding: 0.15rem 0.4rem; border-radius: 3px;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.78rem;
    }

    section { margin-bottom: 2rem; }
    .section-head {
      display: flex; align-items: baseline;
      justify-content: space-between; gap: 1rem;
      margin-bottom: 0.7rem;
    }
    .section-head h2 { font-size: 1.05rem; margin: 0; }
    .section-head small { color: var(--color-muted); font-size: 0.8rem; }

    .empty-inline {
      padding: 1.2rem;
      background: var(--color-surface);
      border: 1px dashed var(--color-border);
      border-radius: var(--radius);
      text-align: center;
    }
    .empty-inline p { margin: 0 0 0.2rem; }
    .empty-inline small { color: var(--color-muted); }

    .requests { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.6rem; }
    .requests li {
      display: grid;
      grid-template-columns: 2fr 2fr auto auto;
      align-items: center; gap: 1rem;
      padding: 0.9rem 1.1rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
    }
    .dates strong { display: block; font-weight: 500; }
    .dates small { color: var(--color-muted); }
    .sla {
      color: var(--color-text-soft);
      font-size: 0.875rem;
      overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap;
    }
    .price { text-align: right; }
    .price strong { font-size: 1.2rem; color: var(--color-primary); }
    .price small { display: block; color: var(--color-muted); font-size: 0.75rem; }

    .accept {
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
    }
    .own { color: var(--color-muted); font-size: 0.85rem; }

    .create { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 1.25rem; }

    .form-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 0.6rem 1rem; margin-bottom: 1rem;
    }
    .form-grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: var(--color-text-soft); }
    .form-grid label.wide { grid-column: 1 / -1; }
    .form-grid input, .form-grid select, .form-grid textarea {
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      font-family: inherit;
      background: white;
    }
    .form-grid input:focus, .form-grid select:focus, .form-grid textarea:focus {
      outline: none; border-color: var(--color-primary);
    }

    .preview-row {
      display: flex; align-items: center; gap: 1rem;
      margin-bottom: 0.8rem;
    }
    .preview {
      flex: 1; padding: 0.8rem 1rem;
      background: var(--color-primary-soft);
      border-radius: var(--radius-sm);
    }
    .preview .cost { display: flex; align-items: baseline; gap: 0.4rem; }
    .preview .cost strong { font-size: 1.4rem; color: var(--color-primary); }
    .preview .cost span { color: var(--color-text-soft); font-size: 0.875rem; }
    .preview small { color: var(--color-muted); display: block; }
    .preview small.muted { color: var(--color-muted); }

    button.primary {
      padding: 0.55rem 1.1rem;
      background: var(--color-primary);
      color: white;
      border: 1px solid var(--color-primary);
      border-radius: var(--radius-sm);
    }
    button.primary:hover:not([disabled]) { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
    button.primary[disabled] { opacity: 0.5; cursor: not-allowed; }
    button.primary.large { padding: 0.75rem 1.5rem; font-size: 0.95rem; }

    .toast {
      padding: 0.7rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      margin: 0.8rem 0 0;
    }
    .toast.success { color: var(--color-success); background: var(--color-success-soft); }
    .toast.error { color: var(--color-error); background: var(--color-error-soft); }

    @media (max-width: 700px) {
      .form-grid { grid-template-columns: 1fr; }
      .requests li { grid-template-columns: 1fr; }
      .price { text-align: left; }
    }
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

  readonly openRequests: ReturnType<typeof toSignal<CoverageRequestRow[], CoverageRequestRow[]>>;

  constructor() {
    this.openRequests = toSignal(
      toObservable(this.teamId).pipe(
        switchMap((id) =>
          id ? this.coverageService.openRequestsForTeam(id) : of([]),
        ),
      ),
      { initialValue: [] },
    );
  }

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

  reachabilityLabel(value: string): string {
    return REACHABILITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
  }

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
        `Posted for ${result.coinsOffered} coins (id: ${result.requestId}).`,
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
