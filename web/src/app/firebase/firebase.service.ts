import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import {
  Functions,
  connectFunctionsEmulator,
  getFunctions,
} from 'firebase/functions';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly functions: Functions;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);
    this.functions = getFunctions(this.app, environment.functionsRegion);

    if (environment.useEmulators) {
      connectAuthEmulator(this.auth, 'http://localhost:9099', {
        disableWarnings: true,
      });
      connectFirestoreEmulator(this.firestore, 'localhost', 8080);
      connectFunctionsEmulator(this.functions, 'localhost', 5001);
    }
  }
}
