/// <reference path="get-port.d.ts" />

import express from 'express';
import getPort from 'get-port';

export type PlaybackWithDeferred = {
  deferred: PromiseWithResolvers<{}>;
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
  const app = express();

  const orderedPlaybacks: PlaybackWithDeferred[][] = (options.playbacks || []).map(unorderedPlaybacks => {
    if (Array.isArray(unorderedPlaybacks)) {
      return unorderedPlaybacks.map(playback => ({
        ...playback,
        deferred: Promise.withResolvers<{}>()
      }));
    } else {
      return [
        {
          ...unorderedPlaybacks,
          deferred: Promise.withResolvers<{}>()
        }
      ];
    }
  });

  app.use((req, res, next) => {
    const firstPlayback = orderedPlaybacks[0];

    if (!firstPlayback) {
      return next();
    }

    const unorderedPlaybacks = Array.isArray(firstPlayback) ? firstPlayback : [firstPlayback];
    let handled;

    unorderedPlaybacks.forEach(({ deferred, req: preq = {}, res: pres = {} }, index) => {
      if (req.url === (preq.url || '/')) {
        if (req.method === 'OPTIONS') {
          res
            .status(200)
            .set({
              'Access-Control-Allow-Origin': req.header('Origin') || '*',
              'Access-Control-Allow-Methods': req.header('Access-Control-Request-Method') || 'GET',
              'Access-Control-Allow-Headers': req.header('Access-Control-Request-Headers') || '',
              'Content-Type': 'text/html; charset=utf-8'
            })
            .send('');

          handled = true;
        } else if (req.method === (preq.method || 'GET')) {
          const headers: any = {};

          if (typeof pres.body === 'string') {
            headers['Content-Type'] = 'text/plain';
          }

          res
            .status(pres.code || 200)
            .set({
              // JSDOM requires all HTTP response, including those already pre-flighted, to have "Access-Control-Allow-Origin".
              // https://github.com/jsdom/jsdom/issues/2024
              'Access-Control-Allow-Origin': req.header('Origin') || '*',
              ...headers,
              ...pres.headers
            })
            .send(pres.body);

          handled = true;
          deferred.resolve({});
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

  const server = app.listen(port);

  return {
    dispose: () => {
      return new Promise(resolve => server.close(() => resolve()));
    },
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
