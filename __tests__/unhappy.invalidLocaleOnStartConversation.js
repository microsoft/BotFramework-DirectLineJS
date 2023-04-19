/** @jest-environment ./__tests__/setup/jsdomEnvironmentWithProxy */

import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import waitForBotToRespond from './setup/waitForBotToRespond';

// Skipping because the bot at dljstestbot.azurewebsites.net is not available.
describe.skip('Unhappy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('should receive the welcome message from bot in English', () => {
    let directLine;

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

      test('with invalid locale in conversation start properties', async () => {
        directLine = await createDirectLine.forREST({ token: true }, { conversationStartProperties: { locale: { x: 'test' } } });
      });
    });

    describe('using Web Socket', () => {
      beforeEach(() => jest.setTimeout(timeouts.webSocket));

      test('with invalid locale in conversation start properties', async () => {
        directLine = await createDirectLine.forWebSocket({ token: true }, { conversationStartProperties: { locale: { x: 'test' } } });
      });
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));

      await waitForBotToRespond(directLine, ({ text }) => text === 'Welcome');
    });
  });
});
