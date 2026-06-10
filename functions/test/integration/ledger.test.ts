import { describe, expect, it } from 'vitest';

import { recordLedgerEntry } from '../../src/services/wallet';
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
