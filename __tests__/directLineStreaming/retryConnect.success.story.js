import fetch from 'node-fetch';

import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import activityTimestampComparer from './__setup__/activityTimestampComparer';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';
import waitFor from './__setup__/external/testing-library/waitFor';

const MOCKBOT3_URL = 'https://webchat-mockbot3.azurewebsites.net/';
const TOKEN_URL = 'https://webchat-mockbot3.azurewebsites.net/api/token/directlinease';

afterEach(() => jest.useRealTimers());

test.each([['with stable connection'], ['without stable connection']])(
  '%s reconnect successful should continue to function properly',
  async scenario => {
    jest.useFakeTimers({ now: 0 });

    const onUpgrade = jest.fn((req, socket, head, next) => {
      next(req, socket, head);

      // HACK: Returns the time when the connection is made.
      return Date.now();
    });

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

    // THEN: Should made the connection.
    expect(onUpgrade).toBeCalledTimes(1);

    // ---

    if (scenario === 'with stable connection') {
      // GIVEN: Tick for 1 minute. DLJS will consider this connection as stable and reset retry count to 3.
      jest.advanceTimersByTime(60000);
    }

    // WHEN: All Web Sockets are forcibly closed.
    const disconnectTime = Date.now();

    closeAllWebSocketConnections();

    // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online" -> "Connecting" -> "Online".
    await waitFor(
      () => {
        expect(connectionStatusObserver).toHaveProperty('observations', [
          [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
          [expect.any(Number), 'next', ConnectionStatus.Connecting],
          [expect.any(Number), 'next', ConnectionStatus.Online],
          [expect.any(Number), 'next', ConnectionStatus.Connecting],
          [expect.any(Number), 'next', ConnectionStatus.Online]
        ]);
      },
      { timeout: 5000 }
    );

    // THEN: "Connecting" should happen immediately after connection is closed.
    const connectingTime = connectionStatusObserver.observations[3][0];

    expect(connectingTime - disconnectTime).toBeLessThan(200);

    if (scenario === 'with stable connection') {
      // THEN: Should reconnect immediately.
      expect(onUpgrade).toBeCalledTimes(2);
      expect(onUpgrade.mock.results[1].value - disconnectTime).toBeLessThan(200);
    } else {
      // THEN: Should reconnect after 3-15 seconds.
      expect(onUpgrade).toBeCalledTimes(2);
      expect(onUpgrade.mock.results[1].value - disconnectTime).toBeGreaterThanOrEqual(3000);
      expect(onUpgrade.mock.results[1].value - disconnectTime).toBeLessThanOrEqual(15000);
    }

    // ---

    // WHEN: Send a message to the bot after reconnected.
    const postActivityObserver = mockObserver();

    directLine
      .postActivity({
        text: 'Hello, World!',
        type: 'message'
      })
      .subscribe(postActivityObserver);

    // THEN: Should send successfully and completed the observable.
    await waitFor(() =>
      expect(postActivityObserver).toHaveProperty('observations', [
        [expect.any(Number), 'next', expect.any(String)],
        [expect.any(Number), 'complete']
      ])
    );

    // THEN: Bot should reply and the activity should echo back.
    await waitFor(() => {
      expect([...activityObserver.observations].sort(([, , x], [, , y]) => activityTimestampComparer(x, y))).toEqual([
        [expect.any(Number), 'next', expect.activityContaining('Hello and welcome!')],
        [expect.any(Number), 'next', expect.activityContaining('Hello and welcome!')],
        [
          expect.any(Number),
          'next',
          expect.activityContaining('Hello, World!', { id: postActivityObserver.observations[0][2] })
        ],
        [expect.any(Number), 'next', expect.activityContaining('Echo: Hello, World!')]
      ]),
        { timeout: 5000 };
    });
  },
  15000
);
