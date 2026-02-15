import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import waitFor from './__setup__/external/testing-library/waitFor';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';

const TOKEN_URL =
  'https://hawo-mockbot4-token-app.ambitiousflower-67725bfd.westus.azurecontainerapps.io/api/token/directlinease?bot=echo%20bot';

jest.setTimeout(15000);

afterEach(() => jest.useRealTimers());

test('reconnect fail should stop', async () => {
  jest.useFakeTimers({ now: 0 });

  const onUpgrade = jest.fn();

  onUpgrade.mockImplementation((req, socket, head, next) => next(req, socket, head));

  const { domain, token } = await fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json());

  const { closeAllWebSocketConnections, directLineStreamingURL } = await setupBotProxy({
    onUpgrade,
    streamingBotURL: new URL('/', domain).href
  });

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

  // ---

  // WHEN: Kill all future Web Socket connections.
  onUpgrade.mockClear();
  onUpgrade.mockImplementation((_, socket) => {
    socket.end();

    // HACK: Returns the time when the connection is made, so we can expect() it later.
    return Date.now();
  });

  // WHEN: Forcibly close all Web Sockets to trigger a reconnect.
  const disconnectTime = Date.now();

  closeAllWebSocketConnections();

  // THEN: Server should observe three Web Socket connections.
  await waitFor(() => expect(onUpgrade).toBeCalledTimes(3), { timeout: 5000 });

  // THEN: Should not wait before reconnecting the first time.
  //       This is because the connection has been established for more than 1 minute and is considered stable.
  expect(onUpgrade.mock.results[0].value - disconnectTime).toBeLessThan(3000);

  // THEN: Should wait for 3-15 seconds before reconnecting the second time.
  expect(onUpgrade.mock.results[1].value - onUpgrade.mock.results[0].value).toBeGreaterThanOrEqual(3000);
  expect(onUpgrade.mock.results[1].value - onUpgrade.mock.results[0].value).toBeLessThanOrEqual(15000);

  // THEN: Should wait for 3-15 seconds before reconnecting the third time.
  expect(onUpgrade.mock.results[2].value - onUpgrade.mock.results[1].value).toBeGreaterThanOrEqual(3000);
  expect(onUpgrade.mock.results[2].value - onUpgrade.mock.results[1].value).toBeLessThanOrEqual(15000);

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online" -> "Connecting" -> "FailedToConnect".
  await waitFor(() => {
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.Online],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.FailedToConnect]
    ]);
  });

  // ---

  // WHEN: Call reconnect();
  const reconnectTime = Date.now();

  directLine.reconnect({
    conversationId: directLine.conversationId,
    token: directLine.token
  });

  // THEN: Server should observe 3 connections again.
  await waitFor(() => expect(onUpgrade).toBeCalledTimes(6), { timeout: 5000 });

  // THEN: Should not wait before reconnecting.
  //       This is because calling reconnect() should not by delayed.
  expect(onUpgrade.mock.results[3].value - reconnectTime).toBeLessThan(3000);

  // THEN: Should wait for 3-15 seconds before reconnecting the second time.
  expect(onUpgrade.mock.results[4].value - onUpgrade.mock.results[3].value).toBeGreaterThanOrEqual(3000);
  expect(onUpgrade.mock.results[4].value - onUpgrade.mock.results[3].value).toBeLessThanOrEqual(15000);

  // THEN: Should wait for 3-15 seconds before reconnecting the third time.
  expect(onUpgrade.mock.results[5].value - onUpgrade.mock.results[4].value).toBeGreaterThanOrEqual(3000);
  expect(onUpgrade.mock.results[5].value - onUpgrade.mock.results[4].value).toBeLessThanOrEqual(15000);

  // THEN: Should observe ... -> "Connecting" -> "FailedToConnect".
  await waitFor(() => {
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.Online],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.FailedToConnect],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.FailedToConnect]
    ]);
  });
});
