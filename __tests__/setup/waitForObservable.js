import promiseRaceMap from 'promise-race-map';

import observableToPromise from './observableToPromise';

export default async function waitForObservable(observable, target) {
  const observer = observableToPromise(observable);

  try {
    for (;;) {
      const { error, next } = await promiseRaceMap({
        error: observer.error(),
        next: observer.next()
      });

      if (error) {
        throw error;
      } else if (typeof target === 'function' ? target(next) : Object.is(next, target)) {
        return next;
      }
    }
  } finally {
    observer.unsubscribe();
  }
}
