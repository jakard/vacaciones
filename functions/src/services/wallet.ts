import {
  FieldValue,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import type { LedgerBucket, LedgerEntryType } from '@vacaciones/shared';

export interface RecordLedgerEntryArgs {
  tx: Transaction;
  db: Firestore;
  teamId: string;
  uid: string;
  type: LedgerEntryType;
  /** Positive for credits, negative for debits. */
  amountSigned: number;
  balanceBucket: LedgerBucket;
  relatedRequestId: string | null;
  /**
   * Deterministic ID for this ledger entry, derived from the operation
   * (e.g. `${requestId}_release_${YYYY-MM-DD}`). Re-running with the same
   * key is a no-op — that is how every wallet operation gets idempotency.
   */
  idempotencyKey: string;
}

export interface RecordLedgerEntryResult {
  applied: boolean;
}

/**
 * Append a ledger entry and update the wallet projection inside the
 * caller's Firestore transaction. ALL reads happen before any writes,
 * which is required by Firestore's transaction model.
 */
export async function recordLedgerEntry(
  args: RecordLedgerEntryArgs,
): Promise<RecordLedgerEntryResult> {
  const {
    tx,
    db,
    teamId,
    uid,
    type,
    amountSigned,
    balanceBucket,
    relatedRequestId,
    idempotencyKey,
  } = args;

  const entryRef = db.doc(`teams/${teamId}/ledgerEntries/${idempotencyKey}`);
  const walletRef = db.doc(`teams/${teamId}/wallets/${uid}`);

  const [entrySnap, walletSnap] = await Promise.all([
    tx.get(entryRef),
    tx.get(walletRef),
  ]);

  if (entrySnap.exists) {
    return { applied: false };
  }

  tx.create(entryRef, {
    uid,
    type,
    amountSigned,
    balanceBucket,
    relatedRequestId,
    createdAt: FieldValue.serverTimestamp(),
  });

  const balanceField =
    balanceBucket === 'earned' ? 'earnedBalance' : 'stipendBalance';

  if (walletSnap.exists) {
    tx.update(walletRef, {
      [balanceField]: FieldValue.increment(amountSigned),
      updatedAt: FieldValue.serverTimestamp(),
      lastEntryId: idempotencyKey,
    });
  } else {
    tx.create(walletRef, {
      earnedBalance: balanceBucket === 'earned' ? amountSigned : 0,
      stipendBalance: balanceBucket === 'stipend' ? amountSigned : 0,
      stipendPeriodStart: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastEntryId: idempotencyKey,
    });
  }

  return { applied: true };
}
