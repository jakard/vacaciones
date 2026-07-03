import {
  FieldValue,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import type { LedgerBucket, LedgerEntryType } from '../_shared';

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

export interface LedgerEntryInput {
  uid: string;
  type: LedgerEntryType;
  amountSigned: number;
  balanceBucket: LedgerBucket;
  relatedRequestId: string | null;
  idempotencyKey: string;
}

export interface RecordLedgerEntriesResult {
  /** Newly-applied entries (skipping idempotent no-ops), in input order. */
  applied: boolean[];
  appliedKeys: string[];
}

/**
 * Record MULTIPLE ledger entries in one Firestore transaction, doing every
 * read up front (via tx.getAll) before any write — Firestore forbids a read
 * after a write in the same transaction, so calling the single-entry
 * recordLedgerEntry twice in one transaction crashes. Use this whenever a
 * transaction touches the ledger more than once (escrow that spans both
 * wallet buckets, stipend expire+mint, force-complete's per-day releases +
 * fee burn). Deltas to the same wallet are aggregated into one write.
 */
export async function recordLedgerEntries(args: {
  tx: Transaction;
  db: Firestore;
  teamId: string;
  entries: LedgerEntryInput[];
}): Promise<RecordLedgerEntriesResult> {
  const { tx, db, teamId, entries } = args;
  if (entries.length === 0) return { applied: [], appliedKeys: [] };

  const entryRefs = entries.map((e) =>
    db.doc(`teams/${teamId}/ledgerEntries/${e.idempotencyKey}`),
  );
  const uniqueUids = [...new Set(entries.map((e) => e.uid))];
  const walletRefByUid = new Map(
    uniqueUids.map((uid) => [uid, db.doc(`teams/${teamId}/wallets/${uid}`)]),
  );

  // ---- ALL READS FIRST ----
  const snaps = await tx.getAll(
    ...entryRefs,
    ...uniqueUids.map((u) => walletRefByUid.get(u) as ReturnType<Firestore['doc']>),
  );
  const entrySnaps = snaps.slice(0, entryRefs.length);
  const walletSnapByUid = new Map(
    uniqueUids.map((uid, i) => [uid, snaps[entryRefs.length + i]]),
  );

  // Aggregate per-wallet deltas across only the NEW entries.
  const deltaByUid = new Map<string, { earned: number; stipend: number }>();
  const lastKeyByUid = new Map<string, string>();
  const applied: boolean[] = [];
  const appliedKeys: string[] = [];

  entries.forEach((e, i) => {
    if (entrySnaps[i].exists) {
      applied.push(false);
      return;
    }
    applied.push(true);
    appliedKeys.push(e.idempotencyKey);
    tx.create(entryRefs[i], {
      uid: e.uid,
      type: e.type,
      amountSigned: e.amountSigned,
      balanceBucket: e.balanceBucket,
      relatedRequestId: e.relatedRequestId,
      createdAt: FieldValue.serverTimestamp(),
    });
    const d = deltaByUid.get(e.uid) ?? { earned: 0, stipend: 0 };
    if (e.balanceBucket === 'earned') d.earned += e.amountSigned;
    else d.stipend += e.amountSigned;
    deltaByUid.set(e.uid, d);
    lastKeyByUid.set(e.uid, e.idempotencyKey);
  });

  // ---- WRITES: one wallet write per uid ----
  for (const [uid, d] of deltaByUid) {
    const walletRef = walletRefByUid.get(uid) as ReturnType<Firestore['doc']>;
    const walletSnap = walletSnapByUid.get(uid);
    const lastKey = lastKeyByUid.get(uid) as string;
    if (walletSnap?.exists) {
      const patch: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
        lastEntryId: lastKey,
      };
      if (d.earned !== 0) patch.earnedBalance = FieldValue.increment(d.earned);
      if (d.stipend !== 0) patch.stipendBalance = FieldValue.increment(d.stipend);
      tx.update(walletRef, patch);
    } else {
      tx.create(walletRef, {
        earnedBalance: d.earned,
        stipendBalance: d.stipend,
        stipendPeriodStart: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastEntryId: lastKey,
      });
    }
  }

  return { applied, appliedKeys };
}

/**
 * Append a ledger entry and update the wallet projection inside the
 * caller's Firestore transaction. Reads happen before writes within THIS
 * call — but do NOT call it twice in one transaction (the second call's
 * read runs after the first call's write, which Firestore rejects). For
 * multi-entry transactions use recordLedgerEntries instead.
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
