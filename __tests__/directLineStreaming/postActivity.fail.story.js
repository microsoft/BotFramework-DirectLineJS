import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';
import waitFor from './__setup__/external/testing-library/waitFor';

const TOKEN_URL = 'https://hawo-mockbot4-token-app.ambitiousflower-67725bfd.westus.azurecontainerapps.io/api/token/directlinease?bot=echo%20bot';

afterEach(() => jest.useRealTimers());

test('should send activity', async () => {
  jest.useFakeTimers({ now: 0 });

  const onWebSocketSendMessage = jest.fn();

  onWebSocketSendMessage.mockImplementation((data, socket, req, next) => next(data, socket, req));

  const { domain, token } = await fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json());

  const { directLineStreamingURL } = await setupBotProxy({ onWebSocketSendMessage, streamingBotURL: new URL('/', domain).href });

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

  // GIVEN: Kill connection on next Web Socket message.
  //        This mimic TCP behavior that disconnection may not be detected until next send.
  onWebSocketSendMessage.mockClear();
  onWebSocketSendMessage.mockImplementationOnce((_data, socket) => socket.close());

  // WHEN: Send a message to the bot.
  const postActivityObserver = mockObserver();

  directLine
    .postActivity({
      text: 'Hello, World!',
      type: 'message'
    })
    .subscribe(postActivityObserver);

  // THEN: Should send through Web Socket.
  await waitFor(() => expect(onWebSocketSendMessage).toBeCalled());

  // THEN: Should fail the call.
  await waitFor(() =>
    expect(postActivityObserver).toHaveProperty('observations', [[expect.any(Number), 'error', expect.any(Error)]])
  );

  // THEN: Should observe "Connecting" -> "Online" because the chat adapter should reconnect.
  await waitFor(
    () =>
      expect(connectionStatusObserver).toHaveProperty('observations', [
        [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
        [expect.any(Number), 'next', ConnectionStatus.Connecting],
        [expect.any(Number), 'next', ConnectionStatus.Online],
        [expect.any(Number), 'next', ConnectionStatus.Connecting],
        [expect.any(Number), 'next', ConnectionStatus.Online]
      ]),
    { timeout: 5_000 }
  );
}, 15000);
