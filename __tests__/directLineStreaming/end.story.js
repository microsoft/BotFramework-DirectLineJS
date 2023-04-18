import fetch from 'node-fetch';

import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import mockObserver from './__setup__/mockObserver';
import setupProxy from './__setup__/proxy';
import waitFor from './__setup__/external/testing-library/waitFor';

const MOCKBOT3_URL = 'https://webchat-mockbot3.azurewebsites.net/';
const TOKEN_URL = 'https://webchat-mockbot3.azurewebsites.net/api/token/directlinease';

afterEach(() => jest.useRealTimers());

test('should connect', async () => {
  jest.useFakeTimers();

  const [{ directLineStreamingURL }, { token }] = await Promise.all([
    setupProxy(MOCKBOT3_URL),
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

  // THEN: Should fail all postActivity() calls.
  const postActivityObserver = mockObserver();

  directLine
    .postActivity({
      text: 'Hello, World!',
      type: 'message'
    })
    .subscribe(postActivityObserver);

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
});
