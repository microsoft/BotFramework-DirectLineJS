import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { createServer } from 'http';
import { match } from 'path-to-regexp';
import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';

import removeInline from './removeInline';

import type { Data } from 'ws';
import type { IncomingMessage } from 'http';
import type { Options } from 'http-proxy-middleware';
import type { Socket } from 'net';

type OnUpgradeHandler = (req: IncomingMessage, socket: Socket, head: Buffer, next: OnUpgradeHandler) => void;

type OnWebSocketMessageHandler = (
  data: Data,
  socket: WebSocket,
  req: IncomingMessage,
  next: OnWebSocketMessageHandler
) => void;

type CreateBotProxyInit = {
  onUpgrade?: OnUpgradeHandler;
  onWebSocketReceiveMessage?: OnWebSocketMessageHandler;
  onWebSocketSendMessage?: OnWebSocketMessageHandler;
  streamingBotURL?: string;
};

type CreateBotProxyReturnValue = {
  cleanUp: () => void;
  closeAllWatchdogConnections: () => void;
  closeAllWebSocketConnections: () => void;
  directLineStreamingURL: string;
  directLineURL: string;
  watchdogURL: string;

  get numWatchdogConnection(): number;
  get numOverTheLifetimeWatchdogConnection(): number;
};

const matchDirectLineStreamingProtocol = match('/.bot/', { decode: decodeURIComponent, end: false });

export default function createBotProxy(init?: CreateBotProxyInit): Promise<CreateBotProxyReturnValue> {
  const onUpgrade = init?.onUpgrade || ((req, socket, head, next) => next(req, socket, head, () => {}));
  const onWebSocketReceiveMessage =
    init?.onWebSocketReceiveMessage || ((data, socket, req, next) => next(data, socket, req, () => {}));
  const onWebSocketSendMessage =
    init?.onWebSocketSendMessage || ((data, socket, req, next) => next(data, socket, req, () => {}));
  const streamingBotURL = init?.streamingBotURL;

  return new Promise<CreateBotProxyReturnValue>((resolve, reject) => {
    try {
      const activeSockets: Socket[] = [];
      const app = express();
      const closeAllWatchdogConnections: (() => void)[] = [];
      let numOverTheLifetimeWatchdogConnection = 0;

      streamingBotURL &&
        app.use('/.bot/', createProxyMiddleware({ changeOrigin: true, logLevel: 'silent', target: streamingBotURL }));

      const onProxyRes: Options['onProxyRes'] = responseInterceptor(
        async (responseBuffer, proxyRes: IncomingMessage) => {
          const {
            socket: { localAddress, localPort },
            statusCode
          } = proxyRes;

          if (statusCode && statusCode >= 200 && statusCode < 300) {
            try {
              const json = JSON.parse(responseBuffer.toString('utf8'));

              if (json.streamUrl) {
                return JSON.stringify({
                  ...json,
                  streamUrl: json.streamUrl.replace(
                    /^wss:\/\/directline.botframework.com\/v3\/directline\//,
                    `ws://${localAddress}:${localPort}/v3/directline/`
                  )
                });
              }
            } catch (error) {
              // Returns original response if it is not a JSON.
            }
          }

          return responseBuffer;

          // There is a typing bug in `http-proxy-middleware`.
          // The return type of `responseIntercept` does not match `onProxyRes`.
        }
      );

      app.use(
        '/v3/directline',
        createProxyMiddleware({
          changeOrigin: true,
          logLevel: 'silent',
          onProxyRes,
          selfHandleResponse: true,
          target: 'https://directline.botframework.com/'
        })
      );

      app.get('/test/watchdog', (req, res) => {
        const destroyResponse = () => {
          res.destroy();
        };

        closeAllWatchdogConnections.push(destroyResponse);
        numOverTheLifetimeWatchdogConnection++;

        req.once('error', destroyResponse);
        res.once('close', () => removeInline(closeAllWatchdogConnections, destroyResponse));

        res.chunkedEncoding = true;
        res.statusCode = 200;

        res.setHeader('cache-control', 'no-cache');
        res.setHeader('content-type', 'text/plain');
        res.write(' ');

        setTimeout(() => {
          req.off('error', destroyResponse);
          res.end();
        }, 30_000);
      });

      const webSocketProxy = new WebSocketServer({ noServer: true });

      webSocketProxy.on('connection', (socket: WebSocket, proxySocket: WebSocket, req: IncomingMessage) => {
        socket.addEventListener('message', ({ data }) =>
          onWebSocketSendMessage(data, proxySocket, req, (data, proxySocket) => proxySocket.send(data))
        );

        proxySocket.addEventListener('message', ({ data }) =>
          onWebSocketReceiveMessage(data, socket, req, (data, socket) => socket.send(data))
        );
      });

      const server = createServer(app);

      server.on('error', reject);

      server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) =>
        onUpgrade(req, socket, head, (req, socket, head) => {
          activeSockets.push(socket);

          socket.once('close', () => removeInline(activeSockets, socket));

          const requestURL = req.url || '';

          const isDirectLineStreaming = !!matchDirectLineStreamingProtocol(requestURL);

          if (isDirectLineStreaming && !streamingBotURL) {
            console.warn('Cannot proxy /.bot/ requests without specifying "streamingBotURL".');

            return socket.end();
          }

          const targetURL = new URL(
            requestURL,
            isDirectLineStreaming ? streamingBotURL : 'wss://directline.botframework.com/'
          );

          // "streamingBotURL" could be "https:" instead of "wss:".
          targetURL.protocol = 'wss:';

          const proxySocket = new WebSocket(targetURL);

          proxySocket.addEventListener('close', () => socket.end());
          proxySocket.addEventListener('open', () =>
            webSocketProxy.handleUpgrade(req, socket, head, ws =>
              webSocketProxy.emit('connection', ws, proxySocket, req)
            )
          );
          proxySocket.addEventListener('error', () => {});

          socket.once('close', () => proxySocket.close());
        })
      );

      server.listen(0, '127.0.0.1', () => {
        const address = server.address();

        if (!address) {
          server.close();

          return reject(new Error('Cannot get address of proxy server.'));
        }

        const url = new URL(`http://${typeof address === 'string' ? address : `${address.address}:${address.port}`}`);

        const closeAllWebSocketConnections = () => {
          activeSockets.map(socket => socket.end());
          activeSockets.splice(0);
        };

        resolve({
          cleanUp: () => {
            server.close();

            // `closeAllConnections` is introduced in Node.js 18.2.0.
            server.closeAllConnections?.();

            // Calling close() and closeAllConnections() will not close all Web Socket connections.
            closeAllWebSocketConnections();
          },
          closeAllWatchdogConnections: () => {
            closeAllWatchdogConnections.forEach(close => close());
            closeAllWatchdogConnections.splice(0);
          },
          closeAllWebSocketConnections,
          directLineStreamingURL: new URL('/.bot/v3/directline', url).href,
          directLineURL: new URL('/v3/directline', url).href,
          watchdogURL: new URL('/test/watchdog', url).href,

          get numWatchdogConnection(): number {
            return closeAllWatchdogConnections.length;
          },

          get numOverTheLifetimeWatchdogConnection(): number {
            return numOverTheLifetimeWatchdogConnection;
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}
