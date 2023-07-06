/// <reference path="./__setup__/expect/activityContaining.d.ts" />

import fetch from 'node-fetch';

import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';
import waitFor from './__setup__/external/testing-library/waitFor';

type MockObserver<T> = ReturnType<typeof mockObserver>;
type ResultOfPromise<T> = T extends PromiseLike<infer P> ? P : never;

const MOCKBOT3_URL = 'https://webchat-mockbot3.azurewebsites.net/';
const TOKEN_URL = 'https://webchat-mockbot3.azurewebsites.net/api/token/directlinease';

jest.setTimeout(10_000);

// GIVEN: A Direct Line Streaming chat adapter with network probe on REST API.
describe('Direct Line Streaming chat adapter with network probe on REST API', () => {
  let activityObserver: MockObserver<any>;
  let botProxy: ResultOfPromise<ReturnType<typeof setupBotProxy>>;
  let connectionStatusObserver: MockObserver<ConnectionStatus>;
  let directLine: DirectLineStreaming;

  beforeEach(async () => {
    jest.useFakeTimers({ now: 0 });

    let token: string;

    [botProxy, { token }] = await Promise.all([
      setupBotProxy({ streamingBotURL: MOCKBOT3_URL }),
      fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json())
    ]);

    activityObserver = mockObserver();
    connectionStatusObserver = mockObserver();
    directLine = new DirectLineStreaming({
      domain: botProxy.directLineStreamingURL,
      networkProbe: { url: botProxy.networkProbeURL },
      token
    });

    directLine.connectionStatus$.subscribe(connectionStatusObserver);
  });

  afterEach(() => {
    directLine.end();

    jest.useRealTimers();
  });

  describe('when connect', () => {
    // WHEN: Connect.
    beforeEach(() => directLine.activity$.subscribe(activityObserver));

    // THEN: Should observe "Uninitialized" -> "Connecting" -> "Online".
    test('should observe "Uninitialized" -> "Connecting" -> "Online"', () =>
      waitFor(
        () =>
          expect(connectionStatusObserver).toHaveProperty('observations', [
            [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
            [expect.any(Number), 'next', ConnectionStatus.Connecting],
            [expect.any(Number), 'next', ConnectionStatus.Online]
          ]),
        { timeout: 5_000 }
      ));

    // WHEN: Connection status become "Online" and the network probe is connected.
    describe('after online and the network probe is connected', () => {
      beforeEach(() =>
        waitFor(
          () => {
            expect(connectionStatusObserver.observe).toHaveBeenLastCalledWith([
              expect.any(Number),
              'next',
              ConnectionStatus.Online
            ]);

            expect(botProxy.numNetworkProbingConnection).toBe(1);
            expect(botProxy.numOverTheLifetimeNetworkProbingConnection).toBe(1);
          },
          { timeout: 5_000 }
        )
      );

      // THEN: Should receive "Hello and welcome!"
      test('should receive "Hello and welcome!"', () =>
        waitFor(
          () =>
            expect(activityObserver).toHaveProperty('observations', [
              [expect.any(Number), 'next', expect.activityContaining('Hello and welcome!')]
            ]),
          { timeout: 5_000 }
        ));

      // WHEN: The network probing connection is forcibly closed.
      describe('when the network probing connection is forcibly closed', () => {
        beforeEach(() => botProxy.closeAllNetworkProbingConnections());

        // THEN: Should observe "Connecting" -> "Online" again.
        test('should observe ... -> "Connecting" -> "Online"', () =>
          waitFor(
            () =>
              expect(connectionStatusObserver).toHaveProperty('observations', [
                [expect.any(Number), 'next', ConnectionStatus.Uninitialized],
                [expect.any(Number), 'next', ConnectionStatus.Connecting],
                [expect.any(Number), 'next', ConnectionStatus.Online],
                [expect.any(Number), 'next', ConnectionStatus.Connecting],
                [expect.any(Number), 'next', ConnectionStatus.Online]
              ]),
            { timeout: 5_000 }
          ));

        test('should reconnect the network probe', () =>
          waitFor(() => expect(botProxy.numOverTheLifetimeNetworkProbingConnection).toBe(2), { timeout: 5_000 }));
      });

      describe('when the chat adapter is closed', () => {
        beforeEach(() => directLine.end());

        test('should close the network probing connection', () =>
          waitFor(() => {
            expect(botProxy.numOverTheLifetimeNetworkProbingConnection).toBe(1);
            expect(botProxy.numNetworkProbingConnection).toBe(0);
          }));
      });
    });
  });
});
