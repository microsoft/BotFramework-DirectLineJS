import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { createServer } from 'http';
import express from 'express';

import type { IncomingMessage } from 'http';
import type { Socket } from 'net';

type OnUpgradeHandler = (req: IncomingMessage, socket: Socket, head: Buffer, next: OnUpgradeHandler) => void;

type SetupProxyInit = {
  onUpgrade?: OnUpgradeHandler;
};

let app;
let server: ReturnType<typeof createServer>;
let sockets: Socket[];

beforeEach(() => {
  sockets = [];
});

export default function setupProxy(
  streamingBotURL: string = 'https://webchat-mockbot3.azurewebsites.net/',
  init?: SetupProxyInit
) {
  const onUpgrade = init?.onUpgrade || ((req, socket, head, next) => next(req, socket, head, () => {}));

  return new Promise((resolve, reject) => {
    app = express();

    app.use(
      '/.bot',
      createProxyMiddleware({ changeOrigin: true, logLevel: 'silent', target: streamingBotURL })
    );

    app.use(
      ['/v3/directline/conversations', '/v3/directline/conversations/:id'],
      createProxyMiddleware({
        changeOrigin: true,
        logLevel: 'silent',
        onProxyRes: responseInterceptor(async (responseBuffer, { statusCode, socket: { localAddress, localPort } }) => {
          if (statusCode && statusCode >= 200 && statusCode < 300) {
            try {
              const json = JSON.parse(responseBuffer.toString('utf8'));

              if (json.streamUrl) {
                json.streamUrl = json.streamUrl.replace(
                  /^wss:\/\/directline.botframework.com\/v3\/directline\//,
                  `ws://${localAddress}:${localPort}/v3/directline/`
                );

                return JSON.stringify(json);
              }
            } catch (error) {
              console.error(error);
            }
          }

          return responseBuffer;
        }),
        selfHandleResponse: true,
        target: 'https://directline.botframework.com/'
      })
    );

    app.use(
      '/v3/directline',
      createProxyMiddleware({
        changeOrigin: true,
        logLevel: 'silent',
        target: 'https://directline.botframework.com/'
      })
    );

    server = createServer(app);

    const handleUpgrade = createProxyMiddleware({
      changeOrigin: true,
      logLevel: 'silent',
      onProxyReqWs: (proxyReq, req, socket) => {
        sockets.push(socket);
      },
      router: { '/.bot': streamingBotURL },
      target: 'https://directline.botframework.com/',
      ws: true
    }).upgrade as (req: IncomingMessage, socket: Socket, head: Buffer) => void;

    // Note: it only support *one* Web Socket proxy per app/server.
    server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) =>
      onUpgrade(req, socket, head, handleUpgrade)
    );

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (address) {
        const url = new URL(`http://${typeof address === 'string' ? address : `${address.address}:${address.port}`}`);

        resolve({
          close: () => {
            server.close();
            server.closeAllConnections();

            sockets.map(socket => socket.end());
          },
          closeAllWebSocketConnections: () => {
            sockets.map(socket => socket.end());
            sockets.splice(0);
          },
          directLineURL: new URL('/v3/directline', url).href,
          directLineStreamingURL: new URL('/.bot/v3/directline', url).href
        });
      } else {
        reject(new Error('Cannot host a server.'));
      }
    });
  });
}

afterEach(() => {
  server?.close();
  server?.closeAllConnections();

  sockets.map(socket => socket.end());
});
