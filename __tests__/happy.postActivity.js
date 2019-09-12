import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { DirectLine } from '../src/directLine';
import { timeouts } from './constants.json';
import * as createDirectLineOptions from './setup/createDirectLineOptions';
import postActivity from './setup/postActivity';
import waitForBotToEcho from './setup/waitForBotToEcho';
import waitForConnected from './setup/waitForConnected';

describe('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('should connect, send message, and receive echo from bot', () => {
    let directLine;

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

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));
      unsubscribes.push(await waitForConnected(directLine));

      await Promise.all([
        postActivity(directLine, { text: 'Hello, World!', type: 'message' }),
        waitForBotToEcho(directLine, ({ text }) => text === 'Hello, World!')
      ]);
    });
  });
});
