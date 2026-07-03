import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';
import { recordLedgerEntries, type LedgerEntryInput } from '../services/wallet';
import { queueMail, wrapTemplate, BRAND_URL } from '../services/mail';

const AcceptSchema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
  // Optional — crew-mode coverers can claim a subset of days. If omitted,
  // claim everything that's still unclaimed (single-mode behaviour).
  dayKeysToClaim: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(366)
    .optional(),
});

interface AcceptResult {
  accepted: boolean;
  coinsEscrowed: number;
  claimedDayKeys: string[];
  allClaimed: boolean;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function dayCost(d: Date): number {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6 ? 10 : 5;
}

export const acceptCoverageRequest = onCall<unknown, Promise<AcceptResult>>(
  CALLABLE_OPTS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = AcceptSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }

    const { teamId, requestId, dayKeysToClaim } = parsed.data;
    const uid = request.auth.uid;
    const token = request.auth.token;
    const db = getFirestore();

    const requestRef = db.doc(`teams/${teamId}/coverageRequests/${requestId}`);
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const [reqSnap, memberSnap] = await Promise.all([
        tx.get(requestRef),
        tx.get(memberRef),
      ]);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Coverage request not found.');
      }
      if (!memberSnap.exists) {
        throw new HttpsError('permission-denied', 'Not a member of this team.');
      }

      const req = reqSnap.data() as {
        status: string;
        requesterUid: string;
        totalCoinsOffered: number;
        coverageMode?: 'single' | 'crew';
        selectedDayKeys?: string[];
        dayCoverers?: Record<string, {
          uid: string;
          displayName: string;
          photoURL: string | null;
        }>;
        coverers?: Array<{
          uid: string;
          displayName: string;
          photoURL: string | null;
        }>;
        coinsEscrowed?: number;
      };

      if (req.status === 'cancelled') {
        throw new HttpsError('failed-precondition', 'Bounty was cancelled.');
      }
      if (req.status === 'completed') {
        throw new HttpsError('failed-precondition', 'Bounty already completed.');
      }
      if (req.requesterUid === uid) {
        throw new HttpsError(
          'failed-precondition',
          'You cannot cover your own bounty.',
        );
      }

      const mode = req.coverageMode ?? 'single';
      const allDayKeys = req.selectedDayKeys ?? [];
      const dayCoverers = req.dayCoverers ?? {};

      if (mode === 'single') {
        // Existing behaviour — single coverer claims everything
        if (req.status !== 'open') {
          throw new HttpsError(
            'failed-precondition',
            `Bounty is ${req.status}, cannot accept.`,
          );
        }

        const amount = req.totalCoinsOffered;
        const requesterUid = req.requesterUid;
        const requesterWalletRef = db.doc(
          `teams/${teamId}/wallets/${requesterUid}`,
        );
        const requesterWalletSnap = await tx.get(requesterWalletRef);
        const requesterWallet = requesterWalletSnap.exists
          ? (requesterWalletSnap.data() as {
              earnedBalance: number;
              stipendBalance: number;
            })
          : { earnedBalance: 0, stipendBalance: 0 };

        const totalBalance =
          requesterWallet.earnedBalance + requesterWallet.stipendBalance;
        if (totalBalance < amount) {
          throw new HttpsError(
            'failed-precondition',
            `Requester has insufficient coins (have ${totalBalance}, need ${amount}).`,
          );
        }

        const fromStipend = Math.min(requesterWallet.stipendBalance, amount);
        const fromEarned = amount - fromStipend;

        // Both escrow debits go to the requester's wallet in ONE batched
        // ledger write — calling recordLedgerEntry twice here would read
        // after a write and crash the transaction.
        const escrowEntries: LedgerEntryInput[] = [];
        if (fromStipend > 0) {
          escrowEntries.push({
            uid: requesterUid,
            type: 'escrowIn',
            amountSigned: -fromStipend,
            balanceBucket: 'stipend',
            relatedRequestId: requestId,
            idempotencyKey: `${requestId}_escrow_stipend`,
          });
        }
        if (fromEarned > 0) {
          escrowEntries.push({
            uid: requesterUid,
            type: 'escrowIn',
            amountSigned: -fromEarned,
            balanceBucket: 'earned',
            relatedRequestId: requestId,
            idempotencyKey: `${requestId}_escrow_earned`,
          });
        }
        await recordLedgerEntries({ tx, db, teamId, entries: escrowEntries });

        const coverer = {
          uid,
          displayName: token.name ?? token.email ?? '',
          photoURL: token.picture ?? null,
        };
        const allCoverersMap: Record<string, typeof coverer> = {};
        for (const k of allDayKeys) allCoverersMap[k] = coverer;

        tx.update(requestRef, {
          covererUid: uid,
          covererDisplayName: coverer.displayName,
          covererPhotoURL: coverer.photoURL,
          coverers: [coverer],
          dayCoverers: allCoverersMap,
          status: 'accepted',
          coinsEscrowed: amount,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return {
          accepted: true,
          coinsEscrowed: amount,
          claimedDayKeys: allDayKeys,
          allClaimed: true,
          // Needed by the post-commit notification email (was missing —
          // single mode is the default flow, so the requester never got
          // the "claimed your bounty" email and the missing fields made
          // db.doc('users/') throw).
          requesterUid: req.requesterUid,
          windowStart: (req as { windowStart?: { toDate: () => Date } }).windowStart?.toDate?.()?.toISOString() ?? null,
          windowEnd: (req as { windowEnd?: { toDate: () => Date } }).windowEnd?.toDate?.()?.toISOString() ?? null,
        };
      }

      // CREW MODE
      // Determine which days this coverer is claiming
      const remainingDays = allDayKeys.filter((k) => !dayCoverers[k]);
      if (remainingDays.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          'All days are already claimed.',
        );
      }
      const dayKeysToTake =
        dayKeysToClaim && dayKeysToClaim.length > 0
          ? dayKeysToClaim
          : remainingDays;
      // Validate every requested day is in the bounty and unclaimed
      for (const k of dayKeysToTake) {
        if (!allDayKeys.includes(k)) {
          throw new HttpsError(
            'invalid-argument',
            `Day ${k} is not part of this bounty.`,
          );
        }
        if (dayCoverers[k]) {
          throw new HttpsError(
            'failed-precondition',
            `Day ${k} is already claimed by another crewmate.`,
          );
        }
      }

      // Compute the claim's portion of the total cost
      const claimCost = dayKeysToTake.reduce(
        (sum, k) => sum + dayCost(parseDateKey(k)),
        0,
      );

      // Debit requester for this claim's portion
      const requesterUid = req.requesterUid;
      const requesterWalletRef = db.doc(
        `teams/${teamId}/wallets/${requesterUid}`,
      );
      const requesterWalletSnap = await tx.get(requesterWalletRef);
      const requesterWallet = requesterWalletSnap.exists
        ? (requesterWalletSnap.data() as {
            earnedBalance: number;
            stipendBalance: number;
          })
        : { earnedBalance: 0, stipendBalance: 0 };

      const totalBalance =
        requesterWallet.earnedBalance + requesterWallet.stipendBalance;
      if (totalBalance < claimCost) {
        throw new HttpsError(
          'failed-precondition',
          `Requester is out of doubloons for this claim (have ${totalBalance}, need ${claimCost}).`,
        );
      }

      const fromStipend = Math.min(requesterWallet.stipendBalance, claimCost);
      const fromEarned = claimCost - fromStipend;
      const sortedFirstDay = dayKeysToTake.slice().sort()[0];

      const crewEscrowEntries: LedgerEntryInput[] = [];
      if (fromStipend > 0) {
        crewEscrowEntries.push({
          uid: requesterUid,
          type: 'escrowIn',
          amountSigned: -fromStipend,
          balanceBucket: 'stipend',
          relatedRequestId: requestId,
          idempotencyKey: `${requestId}_escrow_${uid}_${sortedFirstDay}_stipend`,
        });
      }
      if (fromEarned > 0) {
        crewEscrowEntries.push({
          uid: requesterUid,
          type: 'escrowIn',
          amountSigned: -fromEarned,
          balanceBucket: 'earned',
          relatedRequestId: requestId,
          idempotencyKey: `${requestId}_escrow_${uid}_${sortedFirstDay}_earned`,
        });
      }
      await recordLedgerEntries({ tx, db, teamId, entries: crewEscrowEntries });

      // Build updated dayCoverers map and coverers list
      const coverer = {
        uid,
        displayName: token.name ?? token.email ?? '',
        photoURL: token.picture ?? null,
      };
      const nextDayCoverers: Record<string, typeof coverer> = { ...dayCoverers };
      for (const k of dayKeysToTake) nextDayCoverers[k] = coverer;

      const existingCoverers = req.coverers ?? [];
      const hasAlready = existingCoverers.some((c) => c.uid === uid);
      const nextCoverers = hasAlready
        ? existingCoverers
        : [...existingCoverers, coverer];

      const allClaimed = allDayKeys.every((k) => nextDayCoverers[k]);
      const nextEscrowed = (req.coinsEscrowed ?? 0) + claimCost;

      tx.update(requestRef, {
        coverers: nextCoverers,
        dayCoverers: nextDayCoverers,
        coinsEscrowed: nextEscrowed,
        status: allClaimed ? 'accepted' : 'open',
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        accepted: true,
        coinsEscrowed: claimCost,
        claimedDayKeys: dayKeysToTake,
        allClaimed,
        requesterUid: req.requesterUid,
        windowStart: (req as { windowStart?: { toDate: () => Date } }).windowStart?.toDate?.()?.toISOString() ?? null,
        windowEnd: (req as { windowEnd?: { toDate: () => Date } }).windowEnd?.toDate?.()?.toISOString() ?? null,
      };
    });

    // Post-commit: queue an email to the requester so they hear about the
    // claim outside the app. Errors here must NOT roll back the accept.
    try {
      const requesterSnap = await db.doc(`users/${result.requesterUid ?? ''}`).get();
      const requesterEmail = (requesterSnap.data() as { email?: string })?.email;
      if (requesterEmail) {
        const covererName = token.name ?? token.email ?? 'A crewmate';
        const dayCount = result.claimedDayKeys.length;
        const subject = result.allClaimed
          ? `${covererName} is covering your time off`
          : `${covererName} claimed ${dayCount} day${dayCount === 1 ? '' : 's'} of your bounty`;
        const html = wrapTemplate({
          preheader: `${dayCount} day${dayCount === 1 ? '' : 's'} claimed.`,
          title: subject,
          bodyHtml: `
            <p style="margin:0 0 12px;">Good news — <strong>${esc(covererName)}</strong> just claimed
            ${dayCount} day${dayCount === 1 ? '' : 's'} of your time-off bounty.</p>
            <p style="margin:0 0 12px;">${result.allClaimed
              ? 'Your bounty is fully covered. You can pack a bag.'
              : 'Some days still need a coverer. Want to nudge the crew?'}</p>
            <p style="margin:0;color:#7E7B73;font-size:13px;">${esc(formatWindow(result.windowStart, result.windowEnd))} · ${result.coinsEscrowed} doubloons</p>`,
          ctaLabel: 'View bounty',
          ctaUrl: `${BRAND_URL}/#/team/${encodeURIComponent(teamId)}`,
        });
        await queueMail(db, {
          to: requesterEmail,
          subject,
          html,
          idempotencyKey: `${requestId}_accepted_${uid}_${result.claimedDayKeys[0] ?? 'all'}`,
          category: 'bounty-accepted',
        });
      }
    } catch (err) {
      // Don't bubble — accept already succeeded.
      console.error('Failed to queue accepted-bounty mail', err);
    }

    return {
      accepted: result.accepted,
      coinsEscrowed: result.coinsEscrowed,
      claimedDayKeys: result.claimedDayKeys,
      allClaimed: result.allClaimed,
    };
  },
);

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatWindow(startIso: string | null | undefined, endIso: string | null | undefined): string {
  if (!startIso || !endIso) return '';
  const s = new Date(startIso);
  const e = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}
