import createPromiseQueue from './createPromiseQueue';

export default function observableToPromise(observable) {
  let errors = createPromiseQueue();
  let completes = createPromiseQueue();
  let nexts = createPromiseQueue();
  const subscription = observable.subscribe({
    complete: completes.push,
    error: errors.push,
    next: nexts.push
  });

  return {
    complete: () => completes.pop(),
    error: () => errors.pop(),
    next: () => nexts.pop(),
    unsubscribe: subscription.unsubscribe.bind(subscription)
  };
}
