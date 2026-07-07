import { initializeApp } from 'firebase-admin/app';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

import { CALLABLE_OPTS } from './options';

initializeApp();

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

export const healthcheck = onCall(CALLABLE_OPTS, (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  return {
    status: 'ok',
    timestamp: Date.now(),
    uid: request.auth.uid,
  };
});

export { initUser } from './http/initUser';
export { createTeam } from './http/createTeam';
export { joinTeam } from './http/joinTeam';
export { createCoverageRequest } from './http/createCoverageRequest';
export { acceptCoverageRequest } from './http/acceptCoverageRequest';
export { updateMyAccounts } from './http/updateMyAccounts';
export { getLeaderboard } from './http/getLeaderboard';
export { sendScroll } from './http/sendScroll';
export { setProfile } from './http/setProfile';
export { cancelBounty } from './http/cancelBounty';
export { updateTeam } from './http/updateTeam';
export { updateCrewSettings } from './http/updateCrewSettings';
export { getCrewSettings } from './http/getCrewSettings';
export { topUpOnboardingGrant } from './http/topUpOnboardingGrant';
export { getCrewMembers } from './http/getCrewMembers';
export { reactToScroll } from './http/reactToScroll';
export { updateBountyDetails } from './http/updateBountyDetails';
export { generateBriefing } from './http/generateBriefing';
export { updateMemberRole } from './http/updateMemberRole';
export { removeMember } from './http/removeMember';
export { grantBonusDoubloons } from './http/grantBonusDoubloons';
export { forceCompleteBounty } from './http/forceCompleteBounty';
export { getAuditLog } from './http/getAuditLog';
export { createInviteToken } from './http/inviteTokens';
export { exportMyData, deleteMyAccount, disbandCrew } from './http/gdpr';
export { dailyCoverageRelease } from './scheduled/dailyCoverageRelease';
export { monthlyStipendMint } from './scheduled/monthlyStipendMint';
export { dailyDigest } from './scheduled/dailyDigest';
