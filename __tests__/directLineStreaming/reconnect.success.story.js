import fetch from 'node-fetch';
import { DirectLineStreaming } from '../../src/directLineStreaming';

import setupProxy from './__setup__/proxy';
import mockObserver from './__setup__/mockObserver';
import waitFor from './__setup__/external/testing-library/waitFor';

const MOCKBOT3_URL = 'https://webchat-mockbot3.azurewebsites.net/';
const TOKEN_URL = 'https://webchat-mockbot3.azurewebsites.net/api/token/directlinease';

afterEach(() => {
  jest.useRealTimers();
});

test('should reconnect', async () => {
  jest.useFakeTimers();

  const [{ closeAllWebSocketConnections, directLineStreamingURL }, { token }] = await Promise.all([
    setupProxy(MOCKBOT3_URL),
    fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json())
  ]);

  const directLine = new DirectLineStreaming({
    domain: directLineStreamingURL,
    token
  });

  const activityObserver = mockObserver();
  const connectionStatusObserver = mockObserver();

  // GIVEN: Observer observing connectionStatus$.
  directLine.connectionStatus$.subscribe(connectionStatusObserver);

  // WHEN: Connect.
  directLine.activity$.subscribe(activityObserver);

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online".
  await waitFor(
    () => {
      expect(connectionStatusObserver).toHaveProperty('observations', [
        [expect.any(Number), 'next', 0],
        [expect.any(Number), 'next', 1],
        [expect.any(Number), 'next', 2]
      ]);
    },
    { timeout: 5000 }
  );

  // WHEN: All Web Sockets are forcibly closed.
  const closeTime = Date.now();

  closeAllWebSocketConnections();

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online" -> "Connecting" -> "Online".
  await waitFor(() => {
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', 0],
      [expect.any(Number), 'next', 1],
      [expect.any(Number), 'next', 2],
      [expect.any(Number), 'next', 1],
      [expect.any(Number), 'next', 2]
    ]);
  });

  // THEN: "Connecting" should happen immediately after connection is closed.
  const connectingTime = connectionStatusObserver.observations[3][0];

  expect(connectingTime - closeTime).toBeLessThan(200);
});
