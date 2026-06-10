import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

import { HAS_EMULATOR } from './helpers';

const d = HAS_EMULATOR ? describe : describe.skip;
const here = dirname(fileURLToPath(import.meta.url));

d('firestore.rules (emulator)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-rules',
      firestore: {
        rules: readFileSync(resolve(here, '../../../firestore.rules'), 'utf8'),
      },
    });

    // Seed a crew with one member + one manager, bypassing rules.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc('teams/crew1').set({
        name: 'Crew One',
        memberUids: ['alice', 'mgr'],
      });
      await db.doc('teams/crew1/members/alice').set({ role: 'member' });
      await db.doc('teams/crew1/members/mgr').set({ role: 'manager' });
      await db.doc('teams/crew1/wallets/alice').set({ earnedBalance: 10, stipendBalance: 5 });
      await db.doc('teams/crew1/ledgerEntries/e1').set({ uid: 'alice', amountSigned: 10 });
      await db.doc('teams/crew1/auditLog/a1').set({ action: 'updateTeam', actorUid: 'mgr' });
      await db.doc('users/alice').set({ email: 'alice@example.com' });
      await db.doc('users/bob').set({ email: 'bob@example.com' });
    });
  });

  afterAll(async () => {
    await env?.cleanup();
  });

  it('denies unauthenticated team reads', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(db.doc('teams/crew1').get());
  });

  it('lets members read their team; outsiders are denied', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('teams/crew1').get());

    const stranger = env.authenticatedContext('mallory').firestore();
    await assertFails(stranger.doc('teams/crew1').get());
  });

  it('wallets: owner and manager can read; member cannot write', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('teams/crew1/wallets/alice').get());
    await assertFails(
      alice.doc('teams/crew1/wallets/alice').set({ earnedBalance: 9999 }),
    );

    const mgr = env.authenticatedContext('mgr').firestore();
    await assertSucceeds(mgr.doc('teams/crew1/wallets/alice').get());
  });

  it('ledger: client writes always denied — money moves only via callables', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      alice.doc('teams/crew1/ledgerEntries/forged').set({ uid: 'alice', amountSigned: 500 }),
    );
    const mgr = env.authenticatedContext('mgr').firestore();
    await assertFails(
      mgr.doc('teams/crew1/ledgerEntries/forged2').set({ uid: 'mgr', amountSigned: 500 }),
    );
  });

  it('audit log: manager reads, member denied, nobody writes', async () => {
    const mgr = env.authenticatedContext('mgr').firestore();
    await assertSucceeds(mgr.doc('teams/crew1/auditLog/a1').get());

    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('teams/crew1/auditLog/a1').get());
    await assertFails(mgr.doc('teams/crew1/auditLog/a2').set({ action: 'x' }));
  });

  it('users: self-read only', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice').get());
    await assertFails(alice.doc('users/bob').get());
    await assertFails(alice.doc('users/alice').set({ email: 'hax@example.com' }));
  });

  it('mail queue: clients can never read or write outbound email', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('mail/m1').set({ to: 'x@example.com' }));
    await assertFails(alice.doc('mail/m1').get());
  });

  it('coverage requests: member reads, client writes denied', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('teams/crew1/coverageRequests/r1').set({ status: 'open' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('teams/crew1/coverageRequests/r1').get());
    await assertFails(
      alice.doc('teams/crew1/coverageRequests/r1').update({ status: 'completed' }),
    );
  });
});
