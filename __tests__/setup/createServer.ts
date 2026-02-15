/// <reference path="get-port.d.ts" />

import fastify from 'fastify';
import createDeferred from 'p-defer';
import getPort from 'get-port';

export type PlaybackWithDeferred = {
  deferred: createDeferred.DeferredPromise<{}>;
} & Playback;

export type Playback = {
  req: {
    method?: string;
    url?: string;
  };
  res: {
    body?: any;
    code?: number;
    headers?: any;
  };
};

export type CreateServerOptions = {
  playbacks: (Playback | Playback[])[];
};

export type CreateServerResult = {
  dispose: () => Promise<void>;
  port: number;
  promises: (Promise<{}> | Promise<{}>[])[];
};

export default async function (options: CreateServerOptions): Promise<CreateServerResult> {
  const port = await getPort({ port: 5000 });
  const server = fastify();

  const orderedPlaybacks: PlaybackWithDeferred[][] = (options.playbacks || []).map(unorderedPlaybacks => {
    if (Array.isArray(unorderedPlaybacks)) {
      return unorderedPlaybacks.map(playback => ({
        ...playback,
        deferred: createDeferred()
      }));
    } else {
      return [
        {
          ...unorderedPlaybacks,
          deferred: createDeferred()
        }
      ];
    }
  });

  server.all('*', async (req, res) => {
    const firstPlayback = orderedPlaybacks[0];

    if (!firstPlayback) {
      res.code(404).send();
      return;
    }

    const unorderedPlaybacks = Array.isArray(firstPlayback) ? firstPlayback : [firstPlayback];
    let handled = false;
    const requestUrl = req.raw.url || req.url || '/';
    const requestMethod = req.raw.method || req.method;

    unorderedPlaybacks.forEach(({ deferred, req: preq = {}, res: pres = {} }, index) => {
      if (requestUrl === (preq.url || '/')) {
        const origin = (req.headers.origin as string) || '*';
        const requestedMethod = (req.headers['access-control-request-method'] as string) || 'GET';
        const requestedHeaders = (req.headers['access-control-request-headers'] as string) || '';

        if (requestMethod === 'OPTIONS') {
          res
            .code(200)
            .header('Access-Control-Allow-Origin', origin)
            .header('Access-Control-Allow-Methods', requestedMethod)
            .header('Access-Control-Allow-Headers', requestedHeaders)
            .header('Content-Type', 'text/html; charset=utf-8')
            .send('');

          handled = true;
        } else if (requestMethod === (preq.method || 'GET')) {
          const headers: Record<string, string> = {};

          if (typeof pres.body === 'string') {
            headers['Content-Type'] = 'text/plain';
          }

          // JSDOM requires all HTTP response, including those already pre-flighted, to have "Access-Control-Allow-Origin".
          // https://github.com/jsdom/jsdom/issues/2024
          res
            .code(pres.code || 200)
            .headers({
              'Access-Control-Allow-Origin': origin,
              ...headers,
              ...pres.headers
            })
            .send(pres.body);

          handled = true;
          deferred.resolve();
          unorderedPlaybacks.splice(index, 1);

          if (!unorderedPlaybacks.length) {
            orderedPlaybacks.shift();
          }
        }

        return;
      }
    });

    if (!handled) {
      res.code(404).send();
    }
  });

  await server.listen({ port, host: '127.0.0.1' });

  return {
    dispose: () => server.close(),
    port,
    promises: options.playbacks.map((unorderedPlayback: Playback | Playback[], index) => {
      if (Array.isArray(unorderedPlayback)) {
        return (orderedPlaybacks[index] as PlaybackWithDeferred[]).map(({ deferred: { promise } }) => promise);
      } else {
        return orderedPlaybacks[index][0].deferred.promise;
      }
    })
  };
}
