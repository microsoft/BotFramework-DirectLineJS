import createPromiseStack from './createPromiseStack';

export default function observableToPromise(observable) {
  let errors = createPromiseStack();
  let completes = createPromiseStack();
  let nexts = createPromiseStack();
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
