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

  const { ResourceLoader } = require('jsdom');
  const { HTTP_PROXY } = process.env;

  const resources = new ResourceLoader({
    proxy: HTTP_PROXY,
    strictSSL: !HTTP_PROXY
  });

  // HACK: We cannot set ResourceLoader thru testEnvironmentOptions.resources.
  //       This is because the ResourceLoader instance constructor is of "slightly" different type when on runtime (probably Jest magic).
  //       Thus, when we set it thru testEnvironmentOptions.resources, it will fail on "--watch" but succeeded when running without watch.
  window._resourceLoader = resources;
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

        await sleep(100);

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
    //   directLine = new DirectLine(await createDirectLineOptions.forStreamingExtensions());
    // });

    describe('using Web Socket', () => {
      test('with secret', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forWebSocket({ token: false }));
      });

      test('with token', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forWebSocket({ token: false }));
      });
    });
  });
});
