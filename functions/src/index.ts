import { initializeApp } from 'firebase-admin/app';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

export const healthcheck = onCall((request) => {
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
export { dailyCoverageRelease } from './scheduled/dailyCoverageRelease';
export { monthlyStipendMint } from './scheduled/monthlyStipendMint';
