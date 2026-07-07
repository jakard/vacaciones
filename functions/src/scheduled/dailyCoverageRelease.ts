import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

import {
  completeRequest,
  releaseDaysUpToLocal,
  startOfDayInTz,
} from '../services/release';

export const dailyCoverageRelease = onSchedule(
  {
    schedule: '5 0 * * *',
    timeZone: 'UTC',
    memory: '256MiB',
    retryCount: 3,
  },
  async () => {
    const db = getFirestore();
    const now = new Date();

    const snapshot = await db
      .collectionGroup('coverageRequests')
      .where('status', 'in', ['accepted', 'active'])
      .get();

    logger.info('dailyCoverageRelease tick', {
      activeRequests: snapshot.size,
      nowUtc: now.toISOString(),
    });

    for (const docSnap of snapshot.docs) {
      const teamId = docSnap.ref.parent.parent?.id;
      if (!teamId) continue;
      const requestId = docSnap.id;
      const data = docSnap.data();
      const fallbackCovererUid = data['covererUid'] as string | null | undefined;
      const dayCoverers =
        (data['dayCoverers'] as Record<string, { uid: string }> | undefined) ?? {};
      const cells =
        (data['cells'] as Array<{ accountId: string; dayKey: string }> | undefined) ?? null;
      const cellCoverers =
        (data['cellCoverers'] as Record<string, { uid: string }> | undefined) ?? {};
      const hasAnyCoverer =
        !!fallbackCovererUid ||
        Object.keys(dayCoverers).length > 0 ||
        Object.keys(cellCoverers).length > 0;
      if (!hasAnyCoverer) continue;

      const selectedDayKeys =
        (data['selectedDayKeys'] as string[] | undefined) ?? null;

      // "Today" is computed in the *bounty's* timezone, not UTC — see
      // services/release.ts for the day-key math.
      const bountyTz = (data['timezone'] as string | undefined) || 'UTC';
      const todayInTz = startOfDayInTz(now, bountyTz);
      const windowEndInTz = startOfDayInTz(
        (data['windowEnd'] as Timestamp).toDate(),
        bountyTz,
      );

      try {
        await releaseDaysUpToLocal({
          db,
          teamId,
          requestId,
          fallbackCovererUid: fallbackCovererUid ?? null,
          dayCoverers,
          windowStart: (data['windowStart'] as Timestamp).toDate(),
          windowEnd: (data['windowEnd'] as Timestamp).toDate(),
          now,
          selectedDayKeys,
          timeZone: bountyTz,
          cells,
          cellCoverers,
        });
        // Complete once "today in TZ" has passed the window's last day.
        if (todayInTz > windowEndInTz) {
          // For crew bounties, default the fee burn to the requester so no
          // single coverer eats it twice.
          const feeBurnUid = fallbackCovererUid ?? (data['requesterUid'] as string);
          await completeRequest(db, teamId, requestId, feeBurnUid);
        }
      } catch (err) {
        logger.error('Failed to process coverage request', {
          teamId,
          requestId,
          error: (err as Error).message,
        });
      }
    }
  },
);
