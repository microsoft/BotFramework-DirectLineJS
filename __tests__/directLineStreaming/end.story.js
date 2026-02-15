import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import waitFor from './__setup__/external/testing-library/waitFor';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';

const TOKEN_URL =
  'https://hawo-mockbot4-token-app.ambitiousflower-67725bfd.westus.azurecontainerapps.io/api/token/directlinease?bot=echo%20bot';

afterEach(() => jest.useRealTimers());

test('should connect', async () => {
  jest.useFakeTimers({ now: 0 });

  const { domain, token } = await fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json());

  const { directLineStreamingURL } = await setupBotProxy({ streamingBotURL: new URL('/', domain).href });

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
    () =>
      expect(connectionStatusObserver).toHaveProperty('observations', [
        [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
        [expect.any(Number), 'next', ConnectionStatus.Connecting],
        [expect.any(Number), 'next', ConnectionStatus.Online]
      ]),
    { timeout: 5000 }
  );

  // ---

  // WHEN: Call end().
  directLine.end();

  // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online" -> "Ended" -> Complete.
  await waitFor(() =>
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.Online],
      [expect.any(Number), 'next', ConnectionStatus.Ended],
      [expect.any(Number), 'complete']
    ])
  );

  // ---

  // WHEN: Send a message after disconnection.
  const postActivityObserver = mockObserver();

  directLine
    .postActivity({
      text: 'Hello, World!',
      type: 'message'
    })
    .subscribe(postActivityObserver);

  // THEN: Should fail all postActivity() calls.
  await waitFor(() =>
    expect(postActivityObserver).toHaveProperty('observations', [[expect.any(Number), 'error', expect.any(Error)]])
  );

  // THEN: Should complete activity$.
  await waitFor(() =>
    expect(activityObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', expect.activityContaining('Hello and welcome!')],
      [expect.any(Number), 'complete']
    ])
  );

  // THEN: Call reconnect() should throw.
  expect(() =>
    directLine.reconnect({
      conversationId: directLine.conversationId,
      token: directLine.token
    })
  ).toThrow('Connection has ended.');
});
