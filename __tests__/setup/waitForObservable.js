import observableToPromise from './observableToPromise';

export default async function waitForObservable(observable, target) {
  const { shift, unsubscribe } = observableToPromise(observable);

  try {
    for (;;) {
      const { complete, error, next } = await shift();

      if (complete) {
        return;
      } else if (error) {
        throw error;
      } else if (typeof target === 'function' ? await target(next) : Object.is(next, target)) {
        return next;
      }
    }
  } finally {
    unsubscribe();
  }
}
