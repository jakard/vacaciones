import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { ECONOMY } from '../_shared';

import { recordLedgerEntries, type LedgerEntryInput } from '../services/wallet';

export const monthlyStipendMint = onSchedule(
  {
    schedule: '0 0 1 * *',
    timeZone: 'UTC',
    memory: '256MiB',
    retryCount: 3,
  },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}`;

    const members = await db.collectionGroup('members').get();

    logger.info('monthlyStipendMint tick', {
      members: members.size,
      yearMonth,
    });

    for (const memberSnap of members.docs) {
      const teamId = memberSnap.ref.parent.parent?.id;
      if (!teamId) continue;
      const uid = memberSnap.id;

      try {
        await processStipend(db, teamId, uid, yearMonth);
      } catch (err) {
        logger.error('Stipend processing failed', {
          teamId,
          uid,
          error: (err as Error).message,
        });
      }
    }
  },
);

async function processStipend(
  db: Firestore,
  teamId: string,
  uid: string,
  yearMonth: string,
): Promise<void> {
  await db.runTransaction(async (tx) => {
    const walletRef = db.doc(`teams/${teamId}/wallets/${uid}`);
    const walletSnap = await tx.get(walletRef);
    const existingStipend = walletSnap.exists
      ? ((walletSnap.data()?.['stipendBalance'] as number | undefined) ?? 0)
      : 0;

    // Expire the old stipend and mint the new one in ONE batched write —
    // two sequential recordLedgerEntry calls would read after a write and
    // crash the transaction (which the per-member try/catch silently
    // swallowed, so stipends never minted for anyone holding a balance).
    const entries: LedgerEntryInput[] = [];
    if (existingStipend > 0) {
      entries.push({
        uid,
        type: 'stipendExpire',
        amountSigned: -existingStipend,
        balanceBucket: 'stipend',
        relatedRequestId: null,
        idempotencyKey: `${uid}_stipendExpire_${yearMonth}`,
      });
    }
    entries.push({
      uid,
      type: 'stipendMint',
      amountSigned: ECONOMY.MONTHLY_STIPEND,
      balanceBucket: 'stipend',
      relatedRequestId: null,
      idempotencyKey: `${uid}_stipendMint_${yearMonth}`,
    });
    await recordLedgerEntries({ tx, db, teamId, entries });

    // set+merge so this works whether the wallet was just created above or
    // already existed (tx.update would fail if the doc was just created in
    // this same transaction)
    tx.set(
      walletRef,
      { stipendPeriodStart: new Date() },
      { merge: true },
    );
  });
}
