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

async function setupDirectLineForwarder(target = 'https://directline.botframework.com/') {
  // We need a reverse proxy (a.k.a. forwarder) to control the network traffic.
  // This is because we need to modify the HTTP header by changing its host header (directline.botframework.com do not like "Host: localhost").

  const proxyPort = await getPort();
  const proxy = createProxyServer({
    changeOrigin: true,
    rejectUnauthorized: false,
    target
  });

  const proxyServer = createServer((req, res) => proxy.web(req, res));

  await promisify(proxyServer.listen.bind(proxyServer))(proxyPort);

  return {
    domain: `http://localhost:${ proxyPort }/v3/directline`,
    unsubscribe: promisify(proxyServer.close.bind(proxyServer))
  };
}

describe('Unhappy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('turn on airplane mode after connected', () => {
    let directLine;

    describe('using REST', () => {
      let domain;

      beforeEach(async () => {
        jest.setTimeout(timeouts.rest);

        const { domain: forwarderDomain, unsubscribe } = await setupDirectLineForwarder();

        unsubscribes.push(unsubscribe);
        domain = forwarderDomain;
      });

      test('with secret', async () => {
        directLine = new DirectLine({
          ...await createDirectLineOptions.forREST({ token: false }),
          domain
        });
      });

      test('with token', async () => {
        directLine = new DirectLine({
          ...await createDirectLineOptions.forREST({ token: true }),
          domain
        });
      });
    });

    // test('using Streaming Extensions', async () => {
    //   jest.setTimeout(timeouts.webSocket);
    //   directLine = new DirectLine(await createDirectLineOptions.forStreamingExtensions());
    // });

    describe('using Web Socket', () => {
      let domain;

      beforeEach(async () => {
        jest.setTimeout(timeouts.webSocket);

        const { domain: forwarderDomain, unsubscribe } = await setupDirectLineForwarder();

        unsubscribes.push(unsubscribe);
        domain = forwarderDomain;
      });

      test('with secret', async () => {
        directLine = new DirectLine({
          ...await createDirectLineOptions.forWebSocket({ token: false }),
          domain
        });
      });

      test('with token', async () => {
        directLine = new DirectLine({
          ...await createDirectLineOptions.forWebSocket({ token: false }),
          domain
        });
      });
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));
      unsubscribes.push(await waitForConnected(directLine));

      await Promise.all([
        postActivity(directLine, { text: 'Hello, World!', type: 'message' }),
        waitForBotEcho(directLine, ({ text }) => text === 'Hello, World!')
      ]);

      // TODO: Kill the connection and test
    });
  });
});
