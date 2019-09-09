import waitForObservable from './waitForObservable';

export default async function waitForConnected(directLine) {
  const subscription = directLine.activity$.subscribe();

  await waitForObservable(directLine.connectionStatus$, 2);

  return subscription.unsubscribe.bind(subscription);
}
