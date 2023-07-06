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
  let createAbortController: jest.Mock<AbortController, [{ signal: AbortSignal }]>;
  let directLine: DirectLineStreaming;

  beforeEach(async () => {
    jest.useFakeTimers({ now: 0 });

    let token: string;

    [botProxy, { token }] = await Promise.all([
      setupBotProxy({ streamingBotURL: MOCKBOT3_URL }),
      fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json())
    ]);

    createAbortController = jest.fn<AbortController, [{ signal: AbortSignal }]>(({ signal }) => {
      const abortController = new AbortController();

      signal.addEventListener('abort', () => abortController.abort(), { once: true });

      return abortController;
    });

    activityObserver = mockObserver();
    connectionStatusObserver = mockObserver();
    directLine = new DirectLineStreaming({
      domain: botProxy.directLineStreamingURL,
      networkProbe: ({ signal }) => createAbortController({ signal }).signal,
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

    // WHEN: Connection status become "Online" and network probe is created.
    describe('after online and network probe is connected', () => {
      beforeEach(() =>
        waitFor(
          () => {
            expect(connectionStatusObserver.observe).toHaveBeenLastCalledWith([
              expect.any(Number),
              'next',
              ConnectionStatus.Online
            ]);

            expect(createAbortController).toBeCalledTimes(1);
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

      // WHEN: Network probing connection is closed.
      describe('when the probing connection detected a fault', () => {
        beforeEach(() => {
          const {
            mock: {
              results: [firstResult]
            }
          } = createAbortController;

          expect(firstResult).toHaveProperty('type', 'return');

          firstResult.value.abort();
        });

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

        test('should recreate network probe', () =>
          waitFor(() => expect(createAbortController).toBeCalledTimes(2), { timeout: 5_000 }));
      });

      describe('when connection is closed', () => {
        beforeEach(() => directLine.end());

        test('should abort the network probe', () => {
          expect(createAbortController).toHaveBeenCalledTimes(1);
          expect(createAbortController.mock.calls[0][0]).toHaveProperty('signal.aborted', true);
        });
      });
    });
  });
});
