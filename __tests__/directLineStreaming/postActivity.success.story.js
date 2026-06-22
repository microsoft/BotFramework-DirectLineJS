import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import activityTimestampComparer from './__setup__/activityTimestampComparer';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';
import waitFor from './__setup__/external/testing-library/waitFor';

const TOKEN_URL = 'https://hawo-mockbot4-token-app.ambitiousflower-67725bfd.westus.azurecontainerapps.io/api/token/directlinease?bot=echo%20bot';

afterEach(() => jest.useRealTimers());

test('should send activity', async () => {
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

  // THEN: Should receive "Hello and welcome!"
  await waitFor(() =>
    expect(activityObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', expect.activityContaining('Hello and welcome!')]
    ])
  );

  // ---

  // WHEN: Send a message to the bot.
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
      [expect.any(Number), 'next', expect.any(String)][(expect.any(Number), 'complete')]
    ])
  );

  // THEN: Bot should reply and the activity should echo back.
  await waitFor(
    () =>
      expect([...activityObserver.observations].sort(([, , x], [, , y]) => activityTimestampComparer(x, y))).toEqual([
        [expect.any(Number), 'next', expect.activityContaining('Hello and welcome!')],
        [
          expect.any(Number),
          'next',
          expect.activityContaining('Hello, World!', {
            id: postActivityObserver.observations[0][2]
          })
        ],
        [expect.any(Number), 'next', expect.activityContaining('Echo: Hello, World!')]
      ]),
    { timeout: 5000 }
  );
}, 15000);
