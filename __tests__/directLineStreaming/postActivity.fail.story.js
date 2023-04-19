import fetch from 'node-fetch';

import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';
import waitFor from './__setup__/external/testing-library/waitFor';

const MOCKBOT3_URL = 'https://webchat-mockbot3.azurewebsites.net/';
const TOKEN_URL = 'https://webchat-mockbot3.azurewebsites.net/api/token/directlinease';

afterEach(() => jest.useRealTimers());

test('should send activity', async () => {
  jest.useFakeTimers({ now: 0 });

  const onWebSocketSendMessage = jest.fn();

  onWebSocketSendMessage.mockImplementation((data, socket, req, next) => next(data, socket, req));

  const [{ directLineStreamingURL }, { token }] = await Promise.all([
    setupBotProxy({ onWebSocketSendMessage, streamingBotURL: MOCKBOT3_URL }),
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

  onWebSocketSendMessage.mockClear();
  onWebSocketSendMessage.mockImplementation((_data, socket) => socket.close());

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

  // THEN: Should observe "Connecting" because the chat adapter should reconnect.
  await waitFor(() =>
    expect(connectionStatusObserver).toHaveProperty('observations', [
      [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
      [expect.any(Number), 'next', ConnectionStatus.Connecting],
      [expect.any(Number), 'next', ConnectionStatus.Online],
      [expect.any(Number), 'next', ConnectionStatus.Connecting]
    ])
  );
}, 15000);
