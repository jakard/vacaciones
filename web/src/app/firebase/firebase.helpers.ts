import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import {
  DocumentReference,
  Query,
  onSnapshot,
} from 'firebase/firestore';
import { Observable } from 'rxjs';

export function authUser$(auth: Auth): Observable<User | null> {
  return new Observable<User | null>((subscriber) => {
    return onAuthStateChanged(
      auth,
      (u) => subscriber.next(u),
      (err) => subscriber.error(err),
    );
  });
}

export function collectionData$<T>(
  q: Query,
  idField?: string,
): Observable<T[]> {
  return new Observable<T[]>((subscriber) => {
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => {
          const data = d.data();
          return idField ? { ...data, [idField]: d.id } : data;
        });
        subscriber.next(docs as T[]);
      },
      (err) => subscriber.error(err),
    );
  });
}

export function docData$<T>(
  ref: DocumentReference,
  idField?: string,
): Observable<T | undefined> {
  return new Observable<T | undefined>((subscriber) => {
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          subscriber.next(undefined);
          return;
        }
        const data = snap.data();
        subscriber.next(
          (idField ? { ...data, [idField]: snap.id } : data) as T,
        );
      },
      (err) => subscriber.error(err),
    );
  });
}
