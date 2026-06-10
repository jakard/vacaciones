import { getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

/**
 * True when a Firestore emulator is reachable via env. Integration suites
 * `describe.skip` themselves without it, so `vitest run` stays green on
 * machines without Java; CI runs the full set via `firebase emulators:exec`.
 */
export const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;

/**
 * Admin Firestore handle bound to an isolated emulator project. Using a
 * distinct projectId per suite keeps test data fully separated without
 * needing wipes between files.
 */
export function emulatorDb(projectId: string): Firestore {
  const name = `test-${projectId}`;
  const existing = getApps().find((a) => a.name === name);
  const app = existing ?? initializeApp({ projectId }, name);
  return getFirestore(app);
}
