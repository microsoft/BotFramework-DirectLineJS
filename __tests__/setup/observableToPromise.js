import createPromiseQueue from './createPromiseQueue';

export default function observableToPromise(observable) {
  let queue = createPromiseQueue();

  const subscription = observable.subscribe({
    complete() {
      queue.push({ complete: {} });
      subscription.unsubscribe();
    },
    error(error) {
      queue.push({ error });
      subscription.unsubscribe();
    },
    next(next) {
      queue.push({ next });
    }
  });

  return {
    shift: queue.shift.bind(queue),
    unsubscribe: subscription.unsubscribe.bind(subscription)
  };
}
