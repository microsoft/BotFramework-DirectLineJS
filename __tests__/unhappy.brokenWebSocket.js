import 'dotenv/config';
import 'global-agent/bootstrap';

import nock from 'nock';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
// import * as createDirectLine from './setup/createDirectLine';
import { DirectLine } from '../src/directLine';
import rxjsToAsyncIterable from './setup/rxjsToAsyncIterable';

describe('Unhappy path', () => {
  let unsubscribes;

  beforeEach(() => (unsubscribes = []));
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('broken Web Socket', () => {
    beforeEach(async () => {
      nock('https://directline.botframework.com')
        .post('/v3/directline/conversations')
        .reply(
          200,
          JSON.stringify({
            conversationId: '123',
            token: '456',
            streamUrl: 'wss://localhost/'
          })
        );
    });

    test('should not through uncaught exception', async () => {
      const directLine = new DirectLine({
        token: '123'
      });

      unsubscribes.push(directLine.end.bind(directLine));

      for await (let connectionStatus of rxjsToAsyncIterable(directLine.connectionStatus$)) {
        console.log(connectionStatus);
      }
    });
  });
});
