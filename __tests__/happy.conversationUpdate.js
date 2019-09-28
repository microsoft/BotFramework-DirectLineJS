import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import waitForBotToRespond from './setup/waitForBotToRespond';
import waitForConnected from './setup/waitForConnected';

describe('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('should receive the welcome message from bot', () => {
    let directLine;

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

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

      test('with token', async () => {
        directLine = await createDirectLine.forWebSocket({ token: true });
      });
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));
      unsubscribes.push(await waitForConnected(directLine));

      await waitForBotToRespond(directLine, ({ text }) => text === 'Welcome')
    });
  });
});
