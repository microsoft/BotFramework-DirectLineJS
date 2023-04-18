import fetch from 'node-fetch';
import { DirectLineStreaming } from '../../src/directLineStreaming';

import setupProxy from './__setup__/proxy';
import mockObserver from './__setup__/mockObserver';
import waitFor from './__setup__/external/testing-library/waitFor';

const MOCKBOT3_URL = 'https://webchat-mockbot3.azurewebsites.net/';
const TOKEN_URL = 'https://webchat-mockbot3.azurewebsites.net/api/token/directlinease';

afterEach(() => jest.useRealTimers());

test('should reconnect', async () => {
  jest.useFakeTimers();

  const onUpgrade = jest.fn();

  onUpgrade.mockImplementation((req, socket, head, next) => next(req, socket, head));

  const [{ close, closeAllWebSocketConnections, directLineStreamingURL }, { token }] = await Promise.all([
    setupProxy(MOCKBOT3_URL, {
      onUpgrade
    }),
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

  // THEN: Server should observe one Web Socket connection.
  await waitFor(() => expect(onUpgrade).toBeCalledTimes(1));

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

  // GIVEN: Tick for 1 minute. DLJS will consider this connection as stable and reset retry count to 3.
  jest.advanceTimersByTime(60000);

  // WHEN: Forcibly kill all future Web Socket connections.
  onUpgrade.mockClear();
  onUpgrade.mockImplementation((_, socket) => socket.end());

  // WHEN: Forcibly close all Web Sockets to trigger a reconnect.
  closeAllWebSocketConnections();

  // THEN: Server should observe three Web Socket connections.
  await waitFor(() => expect(onUpgrade).toBeCalledTimes(3));

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online" -> "Connecting" -> "FailedToConnect".
  await waitFor(() => {
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', 0],
      [expect.any(Number), 'next', 1],
      [expect.any(Number), 'next', 2],
      [expect.any(Number), 'next', 1],
      [expect.any(Number), 'next', 4]
    ]);
  });
});
