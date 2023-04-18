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

test('should send activity', async () => {
  jest.useFakeTimers();

  const [{ directLineStreamingURL }, { token }] = await Promise.all([
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
    () =>
      expect(connectionStatusObserver).toHaveProperty('observations', [
        [expect.any(Number), 'next', 0],
        [expect.any(Number), 'next', 1],
        [expect.any(Number), 'next', 2]
      ]),
    { timeout: 5000 }
  );

  // THEN: Bot should send "Hello and welcome!"
  await waitFor(() =>
    expect(activityObserver).toHaveProperty('observations', [
      [
        expect.any(Number),
        'next',
        expect.objectContaining({
          id: expect.any(String),
          text: 'Hello and welcome!',
          timestamp: expect.any(String),
          type: 'message'
        })
      ]
    ])
  );

  // WHEN: Send a message to the bot.
  const postActivityObserver = mockObserver();

  directLine
    .postActivity({
      text: 'Hello, World!',
      type: 'message'
    })
    .subscribe(postActivityObserver);

  // THEN: Should send successfully.
  await waitFor(() =>
    expect(postActivityObserver).toHaveProperty('observations', [[expect.any(Number), 'next', expect.any(String)]])
  );

  // THEN: Bot should reply and the activity should echo back.
  await waitFor(
    () =>
      expect(
        activityObserver.observations
          .slice(1, 3)
          .sort(([, , { timestamp: x }], [, , { timestamp: y }]) => new Date(x).getTime() - new Date(y).getTime())
      ).toEqual([
        [
          expect.any(Number),
          'next',
          expect.objectContaining({
            id: postActivityObserver.observations[0][2],
            text: 'Hello, World!',
            timestamp: expect.any(String),
            type: 'message'
          })
        ],
        [
          expect.any(Number),
          'next',
          expect.objectContaining({
            id: expect.any(String),
            text: 'Echo: Hello, World!',
            timestamp: expect.any(String),
            type: 'message'
          })
        ]
      ]),
    { timeout: 5000 }
  );
}, 15000);
