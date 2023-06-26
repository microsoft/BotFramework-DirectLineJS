/** @jest-environment ./__tests__/setup/jsdomEnvironmentWithProxy */

import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import postActivity from './setup/postActivity';
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

      test('with secret', async () => {
        directLine = await createDirectLine.forREST({ token: false });
      });
    });

    describe('using Web Socket', () => {
      beforeEach(() => jest.setTimeout(timeouts.webSocket));

      test('with secret', async () => {
        directLine = await createDirectLine.forWebSocket({ token: false });
      });
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));

      directLine.setUserId('u_test');

      await waitForBotToRespond(directLine, ({ text }) => text === 'Welcome');
    });
  });

  describe('should use conversationStartProperties when starting conversation', () => {
    let directLine;

    test('using Streaming Extensions', async () => {
      jest.setTimeout(timeouts.streamingExtensions);
      directLine = await createDirectLine.forStreamingExtensions({ conversationStartProperties: { user: { id: 'u_test' } }});
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));
      unsubscribes.push(await waitForConnected(directLine));

      await Promise.all([
        postActivity(directLine, { text: 'Hello, World!', type: 'message' }),
        waitForBotToRespond(directLine, ({ from }) => from.id === 'u_test')
      ]);
    });
  });
});
