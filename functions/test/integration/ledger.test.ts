import { describe, expect, it } from 'vitest';

import { recordLedgerEntries, recordLedgerEntry } from '../../src/services/wallet';
import { HAS_EMULATOR, emulatorDb } from './helpers';

const d = HAS_EMULATOR ? describe : describe.skip;

d('recordLedgerEntry (emulator)', () => {
  const db = emulatorDb('demo-ledger');
  const teamId = 'crew1';

  async function record(args: {
    uid: string;
    amountSigned: number;
    bucket: 'earned' | 'stipend';
    key: string;
  }) {
    return db.runTransaction(async (tx) =>
      recordLedgerEntry({
        tx,
        db,
        teamId,
        uid: args.uid,
        type: 'coverageRelease',
        amountSigned: args.amountSigned,
        balanceBucket: args.bucket,
        relatedRequestId: null,
        idempotencyKey: args.key,
      }),
    );
  }

  it('applies a first entry and projects the wallet', async () => {
    const res = await record({ uid: 'alice', amountSigned: 5, bucket: 'earned', key: 'k1' });
    expect(res.applied).toBe(true);

    const wallet = await db.doc(`teams/${teamId}/wallets/alice`).get();
    expect(wallet.data()?.earnedBalance).toBe(5);
    expect(wallet.data()?.stipendBalance).toBe(0);

    const entry = await db.doc(`teams/${teamId}/ledgerEntries/k1`).get();
    expect(entry.exists).toBe(true);
    expect(entry.data()?.amountSigned).toBe(5);
  });

  it('is idempotent: the same key never double-applies', async () => {
    const first = await record({ uid: 'bob', amountSigned: 10, bucket: 'earned', key: 'k2' });
    const second = await record({ uid: 'bob', amountSigned: 10, bucket: 'earned', key: 'k2' });
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);

    const wallet = await db.doc(`teams/${teamId}/wallets/bob`).get();
    expect(wallet.data()?.earnedBalance).toBe(10);

    const entries = await db
      .collection(`teams/${teamId}/ledgerEntries`)
      .where('uid', '==', 'bob')
      .get();
    expect(entries.size).toBe(1);
  });

  it('targets the stipend bucket independently of earned', async () => {
    await record({ uid: 'cara', amountSigned: 11, bucket: 'stipend', key: 'k3' });
    await record({ uid: 'cara', amountSigned: 5, bucket: 'earned', key: 'k4' });

    const wallet = await db.doc(`teams/${teamId}/wallets/cara`).get();
    expect(wallet.data()?.stipendBalance).toBe(11);
    expect(wallet.data()?.earnedBalance).toBe(5);
  });

  it('accumulates debits and credits in order', async () => {
    await record({ uid: 'dave', amountSigned: 25, bucket: 'earned', key: 'k5' });
    await record({ uid: 'dave', amountSigned: -1, bucket: 'earned', key: 'k6' });

    const wallet = await db.doc(`teams/${teamId}/wallets/dave`).get();
    expect(wallet.data()?.earnedBalance).toBe(24);
  });
});

describe('recordLedgerEntries — multiple entries in one transaction (emulator)', () => {
  const db = emulatorDb('demo-ledger-batch');
  const teamId = 'crew1';

  it('writes both wallet buckets in one transaction (the escrow-spans-buckets crash)', async () => {
    // Seed a split wallet: 20 stipend + 10 earned.
    await db.runTransaction((tx) =>
      Promise.resolve(
        recordLedgerEntries({
          tx, db, teamId,
          entries: [
            { uid: 'eve', type: 'stipendMint', amountSigned: 20, balanceBucket: 'stipend', relatedRequestId: null, idempotencyKey: 'seed_s' },
            { uid: 'eve', type: 'grant', amountSigned: 10, balanceBucket: 'earned', relatedRequestId: null, idempotencyKey: 'seed_e' },
          ],
        }),
      ),
    );
    // Escrow a 25-cost bounty: 20 from stipend + 5 from earned, in ONE txn.
    // The old code (two sequential recordLedgerEntry calls) throws
    // "Firestore transactions require all reads before all writes" here.
    await db.runTransaction((tx) =>
      Promise.resolve(
        recordLedgerEntries({
          tx, db, teamId,
          entries: [
            { uid: 'eve', type: 'escrowIn', amountSigned: -20, balanceBucket: 'stipend', relatedRequestId: 'rb', idempotencyKey: 'rb_escrow_stipend' },
            { uid: 'eve', type: 'escrowIn', amountSigned: -5, balanceBucket: 'earned', relatedRequestId: 'rb', idempotencyKey: 'rb_escrow_earned' },
          ],
        }),
      ),
    );
    const wallet = await db.doc(`teams/${teamId}/wallets/eve`).get();
    expect(wallet.data()?.stipendBalance).toBe(0);
    expect(wallet.data()?.earnedBalance).toBe(5);
  });

  it('is idempotent per-entry and reports applied flags in order', async () => {
    const run = () =>
      db.runTransaction((tx) =>
        recordLedgerEntries({
          tx, db, teamId,
          entries: [
            { uid: 'fay', type: 'coverageRelease', amountSigned: 5, balanceBucket: 'earned', relatedRequestId: 'r', idempotencyKey: 'fay_a' },
            { uid: 'fay', type: 'coverageRelease', amountSigned: 10, balanceBucket: 'earned', relatedRequestId: 'r', idempotencyKey: 'fay_b' },
            { uid: 'fay', type: 'feeBurn', amountSigned: -1, balanceBucket: 'earned', relatedRequestId: 'r', idempotencyKey: 'fay_fee' },
          ],
        }),
      );
    const first = await run();
    expect(first.applied).toEqual([true, true, true]);
    const second = await run();
    expect(second.applied).toEqual([false, false, false]);

    const wallet = await db.doc(`teams/${teamId}/wallets/fay`).get();
    expect(wallet.data()?.earnedBalance).toBe(14); // 5 + 10 − 1, once only
  });

  it('splits deltas across distinct wallets (force-complete releases + fee)', async () => {
    await db.runTransaction((tx) =>
      recordLedgerEntries({
        tx, db, teamId,
        entries: [
          { uid: 'alice', type: 'coverageRelease', amountSigned: 5, balanceBucket: 'earned', relatedRequestId: 'r2', idempotencyKey: 'r2_alice_d1' },
          { uid: 'alice', type: 'coverageRelease', amountSigned: 5, balanceBucket: 'earned', relatedRequestId: 'r2', idempotencyKey: 'r2_alice_d2' },
          { uid: 'bob', type: 'coverageRelease', amountSigned: 10, balanceBucket: 'earned', relatedRequestId: 'r2', idempotencyKey: 'r2_bob_d1' },
          { uid: 'bob', type: 'feeBurn', amountSigned: -1, balanceBucket: 'earned', relatedRequestId: 'r2', idempotencyKey: 'r2_feeBurn' },
        ],
      }),
    );
    const a = await db.doc(`teams/${teamId}/wallets/alice`).get();
    const b = await db.doc(`teams/${teamId}/wallets/bob`).get();
    expect(a.data()?.earnedBalance).toBe(10);
    expect(b.data()?.earnedBalance).toBe(9); // 10 − 1
  });
});
