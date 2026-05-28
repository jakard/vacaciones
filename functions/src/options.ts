import { CallableOptions } from 'firebase-functions/v2/https';

// Allow callable Functions to be invoked from the deployed Hosting URL,
// the Firebase Auth fallback URL, and any localhost port for local dev.
export const CALLABLE_OPTS: CallableOptions = {
  cors: [
    'https://vacaciones-dev-b3158.web.app',
    'https://vacaciones-dev-b3158.firebaseapp.com',
    /^http:\/\/localhost(:\d+)?$/,
  ],
};
