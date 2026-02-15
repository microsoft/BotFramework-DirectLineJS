import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import waitFor from './__setup__/external/testing-library/waitFor';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';

const TOKEN_URL =
  'https://hawo-mockbot4-token-app.ambitiousflower-67725bfd.westus.azurecontainerapps.io/api/token/directlinease?bot=echo%20bot';

afterEach(() => jest.useRealTimers());

test('connect fail should signal properly', async () => {
  jest.useFakeTimers({ now: 0 });

  const onUpgrade = jest.fn();

  onUpgrade.mockImplementation((_req, socket) => {
    // Kill the socket when it tries to connect.
    socket.end();

    return Date.now();
  });

  const { domain, token } = await fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json());

  const { directLineStreamingURL } = await setupBotProxy({ onUpgrade, streamingBotURL: new URL('/', domain).href });

  // GIVEN: A Direct Line Streaming chat adapter.
  const activityObserver = mockObserver();
  const connectionStatusObserver = mockObserver();
  const directLine = new DirectLineStreaming({ domain: directLineStreamingURL, token });

  directLine.connectionStatus$.subscribe(connectionStatusObserver);

  // ---

  // WHEN: Connect.
  const connectTime = Date.now();

  directLine.activity$.subscribe(activityObserver);

  // THEN: Should try to connect 3 times.
  await waitFor(() => expect(onUpgrade).toBeCalledTimes(3), { timeout: 5_000 });

  // THEN: Should not wait before connecting the first time.
  expect(onUpgrade.mock.results[0].value - connectTime).toBeLessThan(3000);

  // THEN: Should wait for 3-15 seconds before connecting the second time.
  expect(onUpgrade.mock.results[1].value - onUpgrade.mock.results[0].value).toBeGreaterThanOrEqual(3000);
  expect(onUpgrade.mock.results[1].value - onUpgrade.mock.results[0].value).toBeLessThanOrEqual(15000);

  // THEN: Should wait for 3-15 seconds before connecting the third time.
  expect(onUpgrade.mock.results[2].value - onUpgrade.mock.results[1].value).toBeGreaterThanOrEqual(3000);
  expect(onUpgrade.mock.results[2].value - onUpgrade.mock.results[1].value).toBeLessThanOrEqual(15000);

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "FailedToConnect".
  await waitFor(() =>
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.FailedToConnect]
    ])
  );

  // ---

  // WHEN: Call reconnect().
  const reconnectTime = Date.now();

  directLine.reconnect({
    conversationId: directLine.conversationId,
    token: directLine.token
  });

  // THEN: Should try to reconnect 3 times again.
  await waitFor(() => expect(onUpgrade).toBeCalledTimes(6));

  // THEN: Should not wait before reconnecting.
  //       This is because calling reconnect() should not by delayed.
  expect(onUpgrade.mock.results[3].value - reconnectTime).toBeLessThan(3000);

  // THEN: Should wait for 3-15 seconds before reconnecting the second time.
  expect(onUpgrade.mock.results[4].value - onUpgrade.mock.results[3].value).toBeGreaterThanOrEqual(3000);
  expect(onUpgrade.mock.results[4].value - onUpgrade.mock.results[3].value).toBeLessThanOrEqual(15000);

  // THEN: Should wait for 3-15 seconds before reconnecting the third time.
  expect(onUpgrade.mock.results[5].value - onUpgrade.mock.results[4].value).toBeGreaterThanOrEqual(3000);
  expect(onUpgrade.mock.results[5].value - onUpgrade.mock.results[4].value).toBeLessThanOrEqual(15000);

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "FailedToConnect" -> "Connecting" -> "FailedToConnect".
  await waitFor(() =>
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.FailedToConnect],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.FailedToConnect]
    ])
  );
});
