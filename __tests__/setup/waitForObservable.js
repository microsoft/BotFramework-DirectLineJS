import promiseRaceMap from 'promise-race-map';

import observableToPromise from './observableToPromise';

export default async function waitForObservable(observable, target) {
  const observer = observableToPromise(observable);

  try {
    for (;;) {
      const { complete, error, next } = await promiseRaceMap({
        complete: observer.complete(),
        error: observer.error(),
        next: observer.next()
      });

      if (complete) {
        return;
      } else if (error) {
        throw error;
      } else if (typeof target === 'function' ? await target(next) : Object.is(next, target)) {
        return next;
      }
    }
  } finally {
    observer.unsubscribe();
  }
}
