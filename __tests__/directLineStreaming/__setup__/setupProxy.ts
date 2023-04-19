import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import express from 'express';

import removeInline from './removeInline';

import type { Data } from 'ws';
import type { IncomingMessage } from 'http';
import type { Options } from 'http-proxy-middleware';
import type { Socket } from 'net';

type OnWebSocketMessageHandler = (
  data: Data,
  socket: WebSocket,
  req: IncomingMessage,
  next: OnWebSocketMessageHandler
) => void;
type OnUpgradeHandler = (req: IncomingMessage, socket: Socket, head: Buffer, next: OnUpgradeHandler) => void;

type SetupProxyInit = {
  onUpgrade?: OnUpgradeHandler;
  onWebSocketReceiveMessage: OnWebSocketMessageHandler;
  onWebSocketSendMessage: OnWebSocketMessageHandler;
};

let app: ReturnType<typeof express>;
let server: ReturnType<typeof createServer>;
let activeSockets: Socket[];

beforeEach(() => {
  activeSockets = [];
});

export default function setupProxy(
  streamingBotURL: string = 'https://webchat-mockbot3.azurewebsites.net/',
  init?: SetupProxyInit
) {
  const onUpgrade = init?.onUpgrade || ((req, socket, head, next) => next(req, socket, head, () => {}));
  const onWebSocketReceiveMessage =
    init?.onWebSocketReceiveMessage || ((data, socket, req, next) => next(data, socket, req, () => {}));
  const onWebSocketSendMessage =
    init?.onWebSocketSendMessage || ((data, socket, req, next) => next(data, socket, req, () => {}));

  return new Promise((resolve, reject) => {
    app = express();

    app.use('/.bot', createProxyMiddleware({ changeOrigin: true, logLevel: 'silent', target: streamingBotURL }));

    const onProxyRes: Options['onProxyRes'] = responseInterceptor(async (responseBuffer, proxyRes: IncomingMessage) => {
      const {
        statusCode,
        socket: { localAddress, localPort }
      } = proxyRes;

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
          // console.error(error);
        }
      }

      return responseBuffer;

      // There is a typing bug in `http-proxy-middleware`.
      // The return type of `responseIntercept` does not match `onProxyRes`.
    }) as unknown as Options['onProxyRes'];

    // app.use(
    //   ['/v3/directline/conversations', '/v3/directline/conversations/:id'],
    //   createProxyMiddleware({
    //     changeOrigin: true,
    //     logLevel: 'silent',
    //     onProxyRes,
    //     selfHandleResponse: true,
    //     target: 'https://directline.botframework.com/'
    //   })
    // );

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

    server = createServer(app);

    const webSocketProxy = new WebSocketServer({ noServer: true });

    webSocketProxy.on('connection', (socket: WebSocket, proxySocket: WebSocket, req: IncomingMessage) => {
      socket.addEventListener('message', ({ data }) =>
        onWebSocketReceiveMessage(data, proxySocket, req, (data, proxySocket) => proxySocket.send(data))
      );

      proxySocket.addEventListener('message', ({ data }) =>
        onWebSocketSendMessage(data, socket, req, (data, socket) => socket.send(data))
      );
    });

    server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) =>
      onUpgrade(req, socket, head, (req, socket, head) => {
        activeSockets.push(socket);
        socket.once('close', () => removeInline(activeSockets, socket));

        const targetURL = new URL(
          req.url || '',
          (req.url || '').startsWith('/.bot/') ? streamingBotURL : 'wss://directline.botframework.com/'
        );

        targetURL.protocol = 'wss:';

        const proxySocket = new WebSocket(targetURL);

        proxySocket.addEventListener('close', () => webSocketProxy.close());
        proxySocket.addEventListener('open', () =>
          webSocketProxy.handleUpgrade(req, socket, head, ws => webSocketProxy.emit('connection', ws, proxySocket, req))
        );

        socket.once('close', () => proxySocket.close());
      })
    );

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (address) {
        const url = new URL(`http://${typeof address === 'string' ? address : `${address.address}:${address.port}`}`);

        resolve({
          close: () => {
            server.close();
            server.closeAllConnections();

            // Calling close() and closeAllConnections() will not close all Web Socket connections.
            activeSockets.map(socket => socket.end());
            activeSockets.splice(0);
          },
          closeAllWebSocketConnections: () => {
            activeSockets.map(socket => socket.end());
            activeSockets.splice(0);
          },
          directLineURL: new URL('/v3/directline', url).href,
          directLineStreamingURL: new URL('/.bot/v3/directline', url).href
        });
      } else {
        reject(new Error('Cannot host proxy server.'));
      }
    });
  });
}

afterEach(() => {
  server?.close();
  server?.closeAllConnections();

  activeSockets.map(socket => socket.end());
  activeSockets.splice(0);
});
