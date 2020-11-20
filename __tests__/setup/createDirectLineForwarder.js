import { createProxyServer } from 'http-proxy';
import { createServer } from 'http';
import { promisify } from 'util';

export default async function createDirectLineForwarder(
  port,
  handler,
  target = 'https://directline.botframework.com/'
) {
  // We need a reverse proxy (a.k.a. forwarder) to control the network traffic.
  // This is because we need to modify the HTTP header by changing its host header (directline.botframework.com do not like "Host: localhost").

  const proxy = createProxyServer({
    changeOrigin: true,
    rejectUnauthorized: false,
    target
  });

  proxy.on('proxyReq', (proxyRes, req, res, options) => {
    // JSDOM requires all HTTP response, including those already pre-flighted, to have "Access-Control-Allow-Origin".
    // https://github.com/jsdom/jsdom/issues/2024
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  });

  const proxyServer = createServer((req, res) => {
    handler(req, res, () => proxy.web(req, res));
  });

  await promisify(proxyServer.listen.bind(proxyServer))(port);

  return {
    domain: `http://localhost:${port}/v3/directline`,
    unsubscribe: promisify(proxyServer.close.bind(proxyServer))
  };
}