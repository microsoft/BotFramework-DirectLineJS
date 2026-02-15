/// <reference path="./__setup__/expect/activityContaining.d.ts" />

import { ConnectionStatus } from '../../src/directLine';
import { DirectLineStreaming } from '../../src/directLineStreaming';
import waitFor from './__setup__/external/testing-library/waitFor';
import mockObserver from './__setup__/mockObserver';
import setupBotProxy from './__setup__/setupBotProxy';

type MockObserver<T> = ReturnType<typeof mockObserver>;
type ResultOfPromise<T> = T extends PromiseLike<infer P> ? P : never;

const TOKEN_URL =
  'https://hawo-mockbot4-token-app.ambitiousflower-67725bfd.westus.azurecontainerapps.io/api/token/directlinease?bot=echo%20bot';

jest.setTimeout(10_000);

// GIVEN: A Direct Line Streaming chat adapter with Network Information API.
describe('Direct Line Streaming chat adapter with Network Information API', () => {
  let activityObserver: MockObserver<any>;
  let botProxy: ResultOfPromise<ReturnType<typeof setupBotProxy>>;
  let connectionStatusObserver: MockObserver<ConnectionStatus>;
  let directLine: DirectLineStreaming;

  beforeEach(async () => {
    jest.useFakeTimers({ now: 0 });

    const networkInformation = new EventTarget();
    let type: string = 'wifi';

    Object.defineProperty(networkInformation, 'type', {
      get() {
        return type;
      },
      set(value: string) {
        if (type !== value) {
          type = value;
          networkInformation.dispatchEvent(new Event('change'));
        }
      }
    });

    // Node.js 22.x has global.navigator, but Node.js 18.x and 20.x don't.
    if (!global.navigator) {
      (global as any).navigator = {};
    }

    (global as any).navigator.connection = networkInformation;

    const { domain, token } = await fetch(TOKEN_URL, { method: 'POST' }).then(res => res.json());

    const botProxy = await setupBotProxy({ streamingBotURL: new URL('/', domain).href });

    activityObserver = mockObserver();
    connectionStatusObserver = mockObserver();
    directLine = new DirectLineStreaming({
      domain: botProxy.directLineStreamingURL,
      networkInformation: (navigator as any).connection,
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

    // WHEN: Connection status become "Online".
    describe('after online', () => {
      beforeEach(() =>
        waitFor(
          () =>
            expect(connectionStatusObserver.observe).toHaveBeenLastCalledWith([
              expect.any(Number),
              'next',
              ConnectionStatus.Online
            ]),
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

      // WHEN: "change" event is received.
      describe('when "change" event is received', () => {
        beforeEach(() => {
          (navigator as any).connection.type = 'bluetooth';
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
      });
    });
  });
});
