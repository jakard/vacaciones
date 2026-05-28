import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import {
  LedgerEntryRow,
  LedgerEntryType,
  WalletDoc,
  WalletService,
} from './wallet.service';

const TYPE_LABELS: Record<LedgerEntryType, string> = {
  grant: 'Onboarding grant',
  stipendMint: 'Monthly stipend',
  stipendExpire: 'Stipend expired',
  escrowIn: 'Posted coverage request',
  escrowOut: 'Refund from cancelled request',
  coverageRelease: 'Covered a teammate',
  feeBurn: 'Transaction fee',
  managerAdvance: 'Manager advance',
};

@Component({
  selector: 'app-wallet',
  imports: [DatePipe],
  template: `
    <section class="wallet">
      <h2>Your wallet</h2>
      @let w = wallet();
      @if (w) {
        <div class="balances">
          <div class="bucket">
            <strong>{{ w.earnedBalance }}</strong>
            <small>Earned</small>
          </div>
          <div class="bucket">
            <strong>{{ w.stipendBalance }}</strong>
            <small>Stipend</small>
            <em>expires monthly</em>
          </div>
          <div class="bucket total">
            <strong>{{ w.earnedBalance + w.stipendBalance }}</strong>
            <small>Total</small>
          </div>
        </div>
      } @else {
        <p class="muted">No wallet activity yet.</p>
      }

      <h3>Recent activity</h3>
      @let rows = entries();
      @if (rows.length === 0) {
        <p class="muted">No ledger entries yet.</p>
      } @else {
        <ul>
          @for (e of rows; track e.id) {
            <li
              [class.credit]="e.amountSigned > 0"
              [class.debit]="e.amountSigned < 0">
              <div>
                <strong>{{ labelFor(e.type) }}</strong>
                <small>{{ e.createdAt?.toDate() | date:'short' }}</small>
              </div>
              <span class="amount">
                {{ e.amountSigned > 0 ? '+' : '' }}{{ e.amountSigned }}
                <small>{{ e.balanceBucket }}</small>
              </span>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .wallet { margin: 1.5rem 0; padding: 1rem; border: 1px solid #eee; border-radius: 6px; background: #fafbfc; }
    h2 { margin: 0 0 0.6rem; font-size: 1.1rem; }
    h3 { margin: 1rem 0 0.5rem; font-size: 0.95rem; }
    .muted { color: #888; margin: 0; }
    .balances { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.8rem; margin-bottom: 0.6rem; }
    .bucket { padding: 0.7rem; border-radius: 4px; background: white; border: 1px solid #e8e8e8; text-align: center; }
    .bucket strong { font-size: 1.5rem; display: block; color: #1a73e8; }
    .bucket small { color: #666; }
    .bucket em { display: block; font-size: 0.75rem; color: #999; margin-top: 0.2rem; }
    .bucket.total { background: #1a73e8; }
    .bucket.total strong, .bucket.total small { color: white; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    li {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.5rem 0.8rem; background: white; border: 1px solid #eee; border-radius: 4px;
    }
    li small { color: #888; display: block; font-size: 0.75rem; }
    .amount { font-weight: 600; }
    .amount small { display: inline; color: #999; font-weight: normal; font-size: 0.7rem; margin-left: 0.3rem; }
    li.credit .amount { color: #137333; }
    li.debit .amount { color: #b00020; }
  `,
})
export class WalletComponent {
  private readonly walletService = inject(WalletService);
  private readonly authService = inject(AuthService);

  readonly teamId = input.required<string>();

  private readonly uid = computed(() => this.authService.user()?.uid ?? null);
  private readonly teamUid = computed(() => ({
    teamId: this.teamId(),
    uid: this.uid(),
  }));

  readonly wallet: ReturnType<typeof toSignal<WalletDoc | undefined>>;
  readonly entries: ReturnType<typeof toSignal<LedgerEntryRow[], LedgerEntryRow[]>>;

  constructor() {
    this.wallet = toSignal(
      toObservable(this.teamUid).pipe(
        switchMap(({ teamId, uid }) =>
          uid ? this.walletService.wallet(teamId, uid) : of(undefined),
        ),
      ),
    );

    this.entries = toSignal(
      toObservable(this.teamUid).pipe(
        switchMap(({ teamId, uid }) =>
          uid ? this.walletService.recentEntries(teamId, uid) : of([]),
        ),
      ),
      { initialValue: [] },
    );
  }

  labelFor(t: LedgerEntryType): string {
    return TYPE_LABELS[t] ?? t;
  }
}
