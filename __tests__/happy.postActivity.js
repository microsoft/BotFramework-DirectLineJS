/** @jest-environment ./__tests__/setup/jsdomEnvironmentWithProxy */

import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import postActivity from './setup/postActivity';
import waitForBotToEcho from './setup/waitForBotToEcho';
import waitForConnected from './setup/waitForConnected';

// Skipping because the bot at dljstestbot.azurewebsites.net is not available.
describe.skip('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('should connect, send message, and receive echo from bot', () => {
    let directLine;

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

      test('with secret', async () => {
        directLine = await createDirectLine.forREST({ token: false });
      });

      test('with token', async () => {
        directLine = await createDirectLine.forREST({ token: true });
      });
    });

    test('using Streaming Extensions', async () => {
      jest.setTimeout(timeouts.webSocket);
      directLine = await createDirectLine.forStreamingExtensions();
    });

    describe('using Web Socket', () => {
      beforeEach(() => jest.setTimeout(timeouts.webSocket));

      test('with secret', async () => {
        directLine = await createDirectLine.forWebSocket({ token: false });
      });

      test('with token', async () => {
        directLine = await createDirectLine.forWebSocket({ token: false });
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
