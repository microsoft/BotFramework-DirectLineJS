/** @jest-environment ./__tests__/setup/jsdomEnvironmentWithProxy */

import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import waitForBotToRespond from './setup/waitForBotToRespond';

// Skipping because the bot at dljstestbot.azurewebsites.net is not available.
describe.skip('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('should receive the welcome message from bot in English', () => {
    let directLine;

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

      test('without conversation start properties', async () => {
        directLine = await createDirectLine.forREST({ token: true });
      });

      test('without locale in conversation start properties', async () => {
        directLine = await createDirectLine.forREST({ token: true }, { conversationStartProperties: {} });
      });

      test('with locale "en-US" in conversation start properties', async () => {
        directLine = await createDirectLine.forREST({ token: true }, { conversationStartProperties: { locale: 'en-US' } });
      });
    });

    describe('using Web Socket', () => {
      beforeEach(() => jest.setTimeout(timeouts.webSocket));

      test('without conversation start properties', async () => {
        directLine = await createDirectLine.forWebSocket({ token: true });
      });

      test('without locale in conversation start properties', async () => {
        directLine = await createDirectLine.forWebSocket({ token: true }, { conversationStartProperties: {} });
      });

      test('with locale "en-US" in conversation start properties', async () => {
        directLine = await createDirectLine.forWebSocket({ token: true }, { conversationStartProperties: { locale: 'en-US' } });
      });
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));

      await waitForBotToRespond(directLine, ({ text }) => text === 'Welcome');
    });
  });

  describe('should receive the welcome message from bot in Chinese', () => {
    let directLine;

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

      test('with locale "zh-CN" in conversation start properties', async () => {
        directLine = await createDirectLine.forREST({ token: true }, { conversationStartProperties: { locale: 'zh-CN' } });
      });
    });

    describe('using Web Socket', () => {
      beforeEach(() => jest.setTimeout(timeouts.webSocket));

      test('with locale "zh-CN" in conversation start properties', async () => {
        directLine = await createDirectLine.forWebSocket({ token: true }, { conversationStartProperties: { locale: 'zh-CN' } });
      });
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));

      await waitForBotToRespond(directLine, ({ text }) => text === '欢迎');
    });
  });
});
