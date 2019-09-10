import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { DirectLine } from '../src/directLine';
import { timeouts } from './constants.json';
import * as createDirectLineOptions from './setup/createDirectLineOptions';
import postActivity from './setup/postActivity';
import waitForBotEcho from './setup/waitForBotEcho';
import waitForConnected from './setup/waitForConnected';

beforeAll(() => {
  jest.setTimeout(timeouts.default);
});

function sleep(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('should connect, send messaage, and receive echo from bot', () => {
    let directLine;

    afterEach(async () => {
      if (directLine) {
        unsubscribes.push(await waitForConnected(directLine));

        // await sleep(100);

        await Promise.all([
          postActivity(directLine, { text: 'Hello, World!', type: 'message' }),
          waitForBotEcho(directLine, ({ text }) => text === 'Hello, World!')
        ]);
      }
    });

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

      test('with secret', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forREST({ token: false }));
      });

      test('with token', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forREST({ token: true }));
      });
    });

    // test('using Streaming Extensions', async () => {
    //   jest.setTimeout(timeouts.webSocket);
    //   directLine = new DirectLine(await createDirectLineOptions.forStreamingExtensions());
    // });

    describe('using Web Socket', () => {
      beforeEach(() => jest.setTimeout(timeouts.webSocket));

      test('with secret', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forWebSocket({ token: false }));
      });

      test('with token', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forWebSocket({ token: false }));
      });
    });
  });
});
