import fetch from 'node-fetch';

import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';
import waitFor from './__setup__/external/testing-library/waitFor';

const MOCKBOT3_URL = 'https://webchat-mockbot3.azurewebsites.net/';
const TOKEN_URL = 'https://webchat-mockbot3.azurewebsites.net/api/token/directlinease';

afterEach(() => jest.useRealTimers());

test('reconnect fail should stop', async () => {
  jest.useFakeTimers();

  const onUpgrade = jest.fn();

  onUpgrade.mockImplementation((req, socket, head, next) => next(req, socket, head));

  const [{ closeAllWebSocketConnections, directLineStreamingURL }, { token }] = await Promise.all([
    setupBotProxy({ onUpgrade, streamingBotURL: MOCKBOT3_URL }),
    fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json())
  ]);

  // GIVEN: A Direct Line Streaming chat adapter.
  const activityObserver = mockObserver();
  const connectionStatusObserver = mockObserver();
  const directLine = new DirectLineStreaming({ domain: directLineStreamingURL, token });

  directLine.connectionStatus$.subscribe(connectionStatusObserver);

  // ---

  // WHEN: Connect.
  directLine.activity$.subscribe(activityObserver);

  // THEN: Server should observe one Web Socket connection.
  await waitFor(() => expect(onUpgrade).toBeCalledTimes(1));

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online".
  await waitFor(
    () => {
      expect(connectionStatusObserver).toHaveProperty('observations', [
        [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
        [expect.any(Number), 'next', ConnectionStatus.Connecting],
        [expect.any(Number), 'next', ConnectionStatus.Online]
      ]);
    },
    { timeout: 5000 }
  );

  // ---

  // GIVEN: Tick for 1 minute. DLJS will consider this connection as stable and reset retry count to 3.
  jest.advanceTimersByTime(60000);

  // WHEN: Kill all future Web Socket connections.
  onUpgrade.mockClear();
  onUpgrade.mockImplementation((_, socket) => socket.end());

  // WHEN: Forcibly close all Web Sockets to trigger a reconnect.
  closeAllWebSocketConnections();

  // THEN: Server should observe three Web Socket connections.
  await waitFor(() => expect(onUpgrade).toBeCalledTimes(3));

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online" -> "Connecting" -> "FailedToConnect".
  await waitFor(() => {
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.Online],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.FailedToConnect],
      [expect.any(Number), 'complete']
    ]);
  });

  // TODO: Assert the delay between reconnect to make sure it reconnects only once every 3-15 seconds.
});
