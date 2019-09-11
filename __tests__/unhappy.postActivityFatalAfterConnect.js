import 'dotenv/config';

import { createProxyServer } from 'http-proxy';
import { createServer } from 'http';
import { promisify } from 'util';
import getPort from 'get-port';
import onErrorResumeNext from 'on-error-resume-next';

import { DirectLine } from '../src/directLine';
import { timeouts } from './constants.json';
import * as createDirectLineOptions from './setup/createDirectLineOptions';
import postActivity from './setup/postActivity';
import waitForBotEcho from './setup/waitForBotEcho';
import waitForConnected from './setup/waitForConnected';

async function setupDirectLineForwarder(port, handler, target = 'https://directline.botframework.com/') {
  // We need a reverse proxy (a.k.a. forwarder) to control the network traffic.
  // This is because we need to modify the HTTP header by changing its host header (directline.botframework.com do not like "Host: localhost").

  const proxy = createProxyServer({
    changeOrigin: true,
    rejectUnauthorized: false,
    target
  });

  const proxyServer = createServer((req, res) => {
    handler(req, res, () => proxy.web(req, res));
  });

  await promisify(proxyServer.listen.bind(proxyServer))(port);

  return {
    domain: `http://localhost:${ port }/v3/directline`,
    unsubscribe: promisify(proxyServer.close.bind(proxyServer))
  };
}

describe('Unhappy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('channel returned 404 on post activity after connected', () => {
    let directLine;
    let proxyDomain;
    let proxyPort;

    beforeEach(async () => {
      proxyPort = await getPort();
      proxyDomain = `http://localhost:${ proxyPort }/v3/directline`;
    });

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

      test('with secret', async () => {
        directLine = new DirectLine({
          ...await createDirectLineOptions.forREST({ token: false }),
          domain: proxyDomain
        });
      });

      test('with token', async () => {
        directLine = new DirectLine({
          ...await createDirectLineOptions.forREST({ token: true }),
          domain: proxyDomain
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
        directLine = new DirectLine({
          ...await createDirectLineOptions.forWebSocket({ token: false }),
          domain: proxyDomain
        });
      });

      test('with token', async () => {
        directLine = new DirectLine({
          ...await createDirectLineOptions.forWebSocket({ token: false }),
          domain: proxyDomain
        });
      });
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      let lastConnectionStatus;

      const connectionStatusSubscription = directLine.connectionStatus$.subscribe({
        next(value) { lastConnectionStatus = value; }
      });

      unsubscribes.push(connectionStatusSubscription.unsubscribe.bind(connectionStatusSubscription));

      let alwaysReturn404;

      const { unsubscribe } = await setupDirectLineForwarder(proxyPort, (req, res, next) => {
        if (
          req.method !== 'OPTIONS'
          && alwaysReturn404
        ) {
          res.statusCode = 404;
          res.end();
        } else {
          next();
        }
      });

      unsubscribes.push(unsubscribe);
      unsubscribes.push(directLine.end.bind(directLine));
      unsubscribes.push(await waitForConnected(directLine));

      await Promise.all([
        postActivity(directLine, { text: 'Hello, World!', type: 'message' }),
        waitForBotEcho(directLine, ({ text }) => text === 'Hello, World!')
      ]);

      alwaysReturn404 = true;

      await expect(postActivity(directLine, { text: 'Hello, World!', type: 'message' })).rejects.toThrow();

      // After post failed, it should stop polling and end all connections

      // TODO: Currently not working on REST/WS
      // expect(lastConnectionStatus).not.toBe(2);
    });
  });
});
