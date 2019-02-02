/// <reference path="get-port.d.ts" />

import { createServer } from 'restify';
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
  const server = createServer();

  const orderedPlaybacks: PlaybackWithDeferred[][] = (options.playbacks || []).map(unorderedPlaybacks => {
    if (Array.isArray(unorderedPlaybacks)) {
      return unorderedPlaybacks.map(playback => ({
        ...playback,
        deferred: createDeferred()
      }));
    } else {
      return [{
        ...unorderedPlaybacks,
        deferred: createDeferred()
      }];
    }
  });

  server.pre((req, res, next) => {
    const firstPlayback = orderedPlaybacks[0];

    if (!firstPlayback) {
      return next();
    }

    const unorderedPlaybacks = Array.isArray(firstPlayback) ? firstPlayback : [firstPlayback];
    let handled;

    unorderedPlaybacks.forEach(({
      deferred,
      req: preq = {},
      res: pres = {}
    }, index) => {
      if (req.url === (preq.url || '/')) {
        if (req.method === 'OPTIONS') {
          res.send(200, '', {
            'Access-Control-Allow-Origin': req.header('Origin') || '*',
            'Access-Control-Allow-Methods': req.header('Access-Control-Request-Method') || 'GET',
            'Access-Control-Allow-Headers': req.header('Access-Control-Request-Headers') || '',
            'Content-Type': 'text/html; charset=utf-8'
          });

          handled = true;
        } else if (req.method === (preq.method || 'GET')) {
          const headers: any = {};

          if (typeof pres.body === 'string') {
            headers['Content-Type'] = 'text/plain';
          }

          res.send(
            pres.code || 200,
            pres.body,
            {
              ...headers,
              ...pres.headers
            }
          );

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
      return next();
    }
  });

  server.listen(port);

  return {
    dispose: () => {
      return new Promise(resolve => server.close(resolve));
    },
    port,
    promises: options.playbacks.map((unorderedPlayback: (Playback | Playback[]), index) => {
      if (Array.isArray(unorderedPlayback)) {
        return (orderedPlaybacks[index] as PlaybackWithDeferred[]).map(({ deferred: { promise } }) => promise);
      } else {
        return (orderedPlaybacks[index][0]).deferred.promise;
      }
    })
  };
}
