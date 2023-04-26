/** @jest-environment ./__tests__/setup/jsdomEnvironmentWithProxy */

import 'dotenv/config';
import 'global-agent/bootstrap';

import { EventTarget, getEventAttributeValue, setEventAttributeValue } from 'event-target-shim';
import nock from 'nock';
import onErrorResumeNext from 'on-error-resume-next';

import { DirectLine } from '../src/directLine';

function corsReply(nockRequest) {
  nockRequest.reply(function () {
    const { headers } = this.req;

    return [
      200,
      null,
      {
        'Access-Control-Allow-Headers': headers['access-control-request-headers'],
        'Access-Control-Allow-Methods': headers['access-control-request-method'],
        'Access-Control-Allow-Origin': headers.origin
      }
    ];
  });
}

describe('Unhappy path', () => {
  let unsubscribes;

  beforeEach(() => (unsubscribes = []));
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('broken Web Socket', () => {
    let numErrors;
    let numReconnections;

    beforeEach(async () => {
      numErrors = 0;
      numReconnections = 0;

      nock('https://directline.botframework.com')
        .persist()
        .post(uri => uri.startsWith('/v3/directline/conversations'))
        .reply(
          200,
          JSON.stringify({
            conversationId: '123',
            token: '456',
            streamUrl: 'wss://not-exist-domain'
          })
        )
        .get(uri => uri.startsWith('/v3/directline/conversations'))
        .reply(
          200,
          JSON.stringify({
            conversationId: '123',
            token: '456',
            streamUrl: 'wss://not-exist-domain'
          })
        );

      corsReply(
        nock('https://directline.botframework.com')
          .persist()
          .options(uri => uri.startsWith('/v3/directline/conversations'))
      );

      window.WebSocket = class extends EventTarget {
        constructor() {
          super();

          numReconnections++;

          setTimeout(() => {
            numErrors++;

            this.dispatchEvent(new ErrorEvent('error', { error: new Error('artificial') }));
            this.dispatchEvent(new CustomEvent('close'));
          }, 10);
        }

        get onclose() {
          return getEventAttributeValue(this, 'close');
        }

        set onclose(value) {
          setEventAttributeValue(this, 'close', value);
        }

        get onerror() {
          return getEventAttributeValue(this, 'error');
        }

        set onerror(value) {
          setEventAttributeValue(this, 'error', value);
        }
      };
    });

    afterEach(() => {
      nock.cleanAll();
    });

    test('should reconnect only once for every error', async () => {
      const directLine = new DirectLine({
        token: '123',
        webSocket: true
      });

      // Remove retry delay
      directLine.getRetryDelay = () => 0;

      unsubscribes.push(() => directLine.end());

      await new Promise(resolve => {
        const subscription = directLine.activity$.subscribe(() => {});

        setTimeout(() => {
          subscription.unsubscribe();
          resolve();
        }, 2000);
      });

      // Because we abruptly stopped reconnection after 2 seconds, there is a
      // 10ms window that the number of reconnections is 1 more than number of errors.
      expect(Math.abs(numReconnections - numErrors)).toBeLessThanOrEqual(1);

      // As we loop reconnections for 2000 ms, and we inject errors every 10 ms.
      // We should only see at most 200 errors and reconnections.
      expect(numReconnections).toBeLessThanOrEqual(200);
    });
  });
});
