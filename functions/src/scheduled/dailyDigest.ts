import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import {
  getFirestore,
  FieldValue,
  Firestore,
  Timestamp,
} from 'firebase-admin/firestore';

import { queueMail, wrapTemplate, BRAND_URL, mailEsc as esc } from '../services/mail';

/**
 * Daily digest — runs each morning, builds one summary email per active
 * crewmate per crew with: open bounties they could cover, new scrolls
 * received, ledger gains since last digest, role / membership changes.
 *
 * Scheduled at 14:00 UTC = 09:00 ET = 06:00 PT = 23:00 Tokyo. That's the
 * best compromise for the launch geography (US-East-heavy TAM cohort).
 * For a multi-region launch, fan out per timezone.
 */
export const dailyDigest = onSchedule(
  {
    schedule: '0 14 * * *',
    timeZone: 'UTC',
    memory: '256MiB',
    retryCount: 1,
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();

    // Iterate every team — each team's `memberUids` array gives us the
    // recipients without an O(users × teams) read pattern.
    const teamsSnap = await db.collection('teams').get();
    logger.info('dailyDigest tick', { teams: teamsSnap.size });

    let emailsQueued = 0;
    for (const teamDoc of teamsSnap.docs) {
      const team = teamDoc.data() as { name?: string; memberUids?: string[] };
      const teamId = teamDoc.id;
      const memberUids: string[] = team.memberUids ?? [];
      if (memberUids.length === 0) continue;

      // Pull this team's recent activity once, partition per-user below.
      const [openBounties, recentScrolls] = await Promise.all([
        db
          .collection(`teams/${teamId}/coverageRequests`)
          .where('status', '==', 'open')
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get(),
        db
          .collection(`teams/${teamId}/scrolls`)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
      ]);

      for (const uid of memberUids) {
        try {
          const queued = await buildAndQueue(
            db,
            uid,
            teamId,
            team.name ?? 'Your crew',
            openBounties.docs,
            recentScrolls.docs,
            now,
          );
          if (queued) emailsQueued += 1;
        } catch (err) {
          logger.error('digest user failed', {
            teamId,
            uid,
            error: (err as Error).message,
          });
        }
      }
    }
    logger.info('dailyDigest done', { emailsQueued });
  },
);

async function buildAndQueue(
  db: Firestore,
  uid: string,
  teamId: string,
  teamName: string,
  openBountyDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  recentScrollDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  now: Timestamp,
): Promise<boolean> {
  // Read user prefs + last-digest timestamp.
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return false;
  const user = userSnap.data() as {
    email?: string;
    displayName?: string;
    digestEnabled?: boolean;
    lastDigestAt?: Timestamp;
  };
  if (!user.email) return false;
  if (user.digestEnabled === false) return false;

  const since = user.lastDigestAt ?? Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

  // Open bounties this user could cover (not theirs, not already claimed by them)
  const myOpenBounties: Array<{ id: string; requester: string; coins: number; days: number; windowFrom: string }> = [];
  for (const doc of openBountyDocs) {
    const d = doc.data();
    if (d.requesterUid === uid) continue;
    const dayCoverers = (d.dayCoverers as Record<string, { uid: string }> | undefined) ?? {};
    const alreadyMine = Object.values(dayCoverers).some((c) => c.uid === uid);
    if (alreadyMine) continue;
    myOpenBounties.push({
      id: doc.id,
      requester: d.requesterDisplayName ?? 'a crewmate',
      coins: d.totalCoinsOffered ?? 0,
      days: (d.selectedDayKeys as string[] | undefined)?.length ?? 0,
      windowFrom: (d.windowStart as Timestamp)?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '',
    });
  }

  // Scrolls received since last digest
  const newScrolls = recentScrollDocs
    .map((s) => s.data() as { toUid?: string; fromName?: string; message?: string; createdAt?: Timestamp })
    .filter((s) => s.toUid === uid && (s.createdAt?.toMillis() ?? 0) > since.toMillis());

  // Ledger gains since last digest
  const ledgerSnap = await db
    .collection(`teams/${teamId}/ledgerEntries`)
    .where('uid', '==', uid)
    .where('createdAt', '>', since)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  let coinsEarned = 0;
  for (const l of ledgerSnap.docs) {
    const amount = (l.data() as { amountSigned?: number }).amountSigned ?? 0;
    if (amount > 0) coinsEarned += amount;
  }

  // Nothing to say? Bail without sending.
  const nothing =
    myOpenBounties.length === 0 &&
    newScrolls.length === 0 &&
    coinsEarned === 0;
  if (nothing) return false;

  const todayKey = new Date().toISOString().slice(0, 10);
  const title = `Your ${teamName} digest`;

  // Build body sections
  const sections: string[] = [];
  if (myOpenBounties.length > 0) {
    const top3 = myOpenBounties.slice(0, 3);
    sections.push(`
      <h2 style="margin:24px 0 8px;font-size:16px;font-weight:600;color:#1F1E1D;">Open bounties you could cover</h2>
      <ul style="margin:0;padding:0;list-style:none;">
        ${top3.map((b) => `
          <li style="padding:10px 0;border-bottom:1px solid #F0EDE3;">
            <div style="font-weight:600;">${esc(b.requester)} · ${b.days} day${b.days === 1 ? '' : 's'}</div>
            <div style="font-size:13px;color:#7E7B73;">Starts ${esc(b.windowFrom)} · ${b.coins} doubloons</div>
          </li>`).join('')}
      </ul>
      ${myOpenBounties.length > 3 ? `<p style="margin:8px 0 0;font-size:13px;color:#7E7B73;">…and ${myOpenBounties.length - 3} more.</p>` : ''}`);
  }
  if (coinsEarned > 0) {
    sections.push(`
      <h2 style="margin:24px 0 8px;font-size:16px;font-weight:600;color:#1F1E1D;">You earned ${coinsEarned} doubloons</h2>
      <p style="margin:0;color:#7E7B73;font-size:13px;">From coverage releases and scrolls since your last digest.</p>`);
  }
  if (newScrolls.length > 0) {
    sections.push(`
      <h2 style="margin:24px 0 8px;font-size:16px;font-weight:600;color:#1F1E1D;">${newScrolls.length} new thank-you scroll${newScrolls.length === 1 ? '' : 's'}</h2>
      <ul style="margin:0;padding:0;list-style:none;">
        ${newScrolls.slice(0, 3).map((s) => `
          <li style="padding:10px 0;border-bottom:1px solid #F0EDE3;">
            <div style="font-weight:600;">${esc(s.fromName ?? 'A crewmate')}</div>
            <div style="font-size:13px;color:#3A3935;">${esc(s.message ?? '')}</div>
          </li>`).join('')}
      </ul>`);
  }

  const html = wrapTemplate({
    preheader: `${myOpenBounties.length} open bounties · ${coinsEarned} doubloons earned · ${newScrolls.length} scrolls.`,
    title,
    bodyHtml: `<p style="margin:0 0 8px;">Good morning, ${esc((user.displayName ?? '').split(' ')[0] || 'crewmate')}.</p>
      <p style="margin:0;color:#7E7B73;font-size:14px;">Here's what's happening in <strong>${esc(teamName)}</strong> since your last digest.</p>
      ${sections.join('')}`,
    ctaLabel: 'Open Unplugged',
    ctaUrl: `${BRAND_URL}/#/team/${encodeURIComponent(teamId)}`,
  });

  await queueMail(db, {
    to: user.email,
    subject: title,
    html,
    idempotencyKey: `digest_${uid}_${teamId}_${todayKey}`,
    category: 'daily-digest',
  });

  await userRef.set({ lastDigestAt: FieldValue.serverTimestamp() }, { merge: true });
  return true;
}
