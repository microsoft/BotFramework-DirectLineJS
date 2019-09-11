import 'dotenv/config';

import { createProxyServer } from 'http-proxy';
import { createServer } from 'http';
import getPort from 'get-port';
import onErrorResumeNext from 'on-error-resume-next';

import { DirectLine } from '../src/directLine';
import { timeouts } from './constants.json';
import * as createDirectLineOptions from './setup/createDirectLineOptions';
import postActivity from './setup/postActivity';
import waitForBotEcho from './setup/waitForBotEcho';
import waitForConnected from './setup/waitForConnected';

describe('Unhappy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('turn on airplane mode after connected', () => {
    let directLine;
    let proxy;
    let proxyPort;
    let proxyServer;

    beforeEach(async () => {
      // We need a reverse proxy (a.k.a. forwarder) to control the network traffic.
      // This is because we need to modify the HTTP header by changing its host header (directline.botframework.com do not like "Host: localhost").

      proxyPort = await getPort();
      proxyPort = 8889;

      proxy = createProxyServer({
        changeOrigin: true,
        rejectUnauthorized: false,
        target: 'https://directline.botframework.com/'
      });

      proxyServer = createServer((req, res) => proxy.web(req, res));

      await (new Promise(resolve => proxyServer.listen(proxyPort, resolve)));
    });

    afterEach(() => new Promise(resolve => proxyServer.close(resolve)));

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

      test('with secret', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forREST({ token: false }));
      });

      test('with token', async () => {
        directLine = new DirectLine({
          ...await createDirectLineOptions.forREST({ token: true }),
          domain: 'http://localhost:8889/v3/directline'
        });
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

      unsubscribes.push(await waitForConnected(directLine));

      await Promise.all([
        postActivity(directLine, { text: 'Hello, World!', type: 'message' }),
        waitForBotEcho(directLine, ({ text }) => text === 'Hello, World!')
      ]);

      // TODO: Kill the connection and test
    });
  });
});
