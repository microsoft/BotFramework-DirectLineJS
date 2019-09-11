import { ConnectionStatus } from '../../src/directLine';

import waitForObservable from './waitForObservable';

export default async function waitForConnected(directLine) {
  const subscription = directLine.activity$.subscribe();

  await waitForObservable(directLine.connectionStatus$, ConnectionStatus.Online);

  return subscription.unsubscribe.bind(subscription);
}
