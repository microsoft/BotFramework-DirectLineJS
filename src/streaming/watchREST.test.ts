import { createServer } from 'http';
import express from 'express';
import hasResolved from 'has-resolved';

import createDeferred from '../createDeferred';
import waitFor from './__setup__/waitFor';
import watchREST from './watchREST';

import type { Deferred } from '../createDeferred';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import type { Request, Response } from 'express';

const pollFn = jest.fn<Promise<void>, [Request, Response], any>(async (_req, res) => {
  const callIndex = pollFn.mock.calls.length - 1;

  pollCallDeferred[callIndex]?.resolve();

  res.chunkedEncoding = true;
  res.status(200);
  res.setHeader('cache-control', 'no-transform');
  res.write(' ');

  const handleClose = () => pollReturnDeferred[callIndex]?.reject(new Error('Socket closed.'));

  res.once('close', handleClose);

  setTimeout(() => {
    res.off('close', handleClose);
    res.end();

    pollReturnDeferred[callIndex]?.resolve();
  }, 30_000);
});

function setup(): Promise<readonly [URL, Server, () => void]> {
  return new Promise(resolve => {
    const app = express();

    app.get('/poll', pollFn);

    const server = createServer(app);

    server.listen(() => {
      const url = new URL('http://localhost/poll');
      const address = server.address();

      if (typeof address === 'string') {
        url.host = address;
      } else if (address) {
        url.hostname = address.address;
        url.port = address.port + '';
      }

      resolve(Object.freeze([url, server, () => server.closeAllConnections()]));
    });
  });
}

let abortController: AbortController;
let pollCallDeferred: Deferred<void>[];
let pollReturnDeferred: Deferred<void>[];
let server: Server<typeof IncomingMessage, typeof ServerResponse>;
let serverURL: URL;
let signal: AbortSignal;
let teardownServer: () => void;

beforeEach(async () => {
  pollCallDeferred = new Array(5).fill(undefined).map(() => createDeferred<void>());
  pollReturnDeferred = new Array(5).fill(undefined).map(() => {
    const deferred = createDeferred<void>();

    deferred.promise.catch(() => {});

    return deferred;
  });

  jest.clearAllMocks();
  jest.useFakeTimers({ advanceTimers: true, now: 0 });

  [serverURL, server, teardownServer] = await setup();

  abortController = new AbortController();

  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  teardownServer();

  jest.useRealTimers();
  console.warn['mockRestore']?.();

  return new Promise<void>(resolve => {
    signal.addEventListener('abort', () => resolve());

    abortController.abort();

    signal.aborted && resolve();
  });
});

describe('with default options', () => {
  beforeEach(() => {
    signal = watchREST(serverURL, { signal: abortController.signal });
  });

  describe('after first poll received', () => {
    beforeEach(() => pollCallDeferred[0].promise);

    test('should have called API once', () => expect(pollFn).toBeCalledTimes(1));
    test('should not have first API response', () =>
      expect(hasResolved(pollReturnDeferred[0].promise)).resolves.toBe(false));

    describe('after 30 seconds', () => {
      beforeEach(async () => {
        jest.advanceTimersByTime(30_000);

        await pollCallDeferred[1].promise;
      });

      test('should have called API twice', () => waitFor(() => expect(pollFn).toBeCalledTimes(2)));
      test('should have first API response', () =>
        expect(hasResolved(pollReturnDeferred[0].promise)).resolves.toBe(true));
      test('should not warn', () => expect(console.warn).not.toBeCalled());

      describe('after 30 seconds again', () => {
        beforeEach(async () => {
          jest.advanceTimersByTimeAsync(30_000);

          await pollCallDeferred[2].promise;
        });

        test('should have called API three times', () => waitFor(() => expect(pollFn).toBeCalledTimes(3)));
        test('should have second API response', () =>
          expect(hasResolved(pollReturnDeferred[1].promise)).resolves.toBe(true));
        test('should not warn', () => expect(console.warn).not.toBeCalled());
      });
    });

    describe('teardown server', () => {
      beforeEach(() => teardownServer());

      test('should abort the signal', () => waitFor(() => expect(signal.aborted).toBe(true)));
    });

    describe('when aborted', () => {
      beforeEach(() => abortController.abort());

      test('should signal', () => expect(signal.aborted).toBe(true));
      test('server should get the "close" event', () =>
        expect(() => pollReturnDeferred[0].promise).rejects.toThrow('Socket closed.'));
    });
  });
});

describe('with pingInterval=45_000', () => {
  beforeEach(() => {
    signal = watchREST(serverURL, {
      pingInterval: 45_000,
      signal: abortController.signal
    });
  });

  describe('after first poll received', () => {
    beforeEach(() => pollCallDeferred[0].promise);

    test('should have called API once', () => expect(pollFn).toBeCalledTimes(1));
    test('should not have first API response', () =>
      expect(hasResolved(pollReturnDeferred[0].promise)).resolves.toBe(false));

    describe('after 30 seconds', () => {
      beforeEach(() => jest.advanceTimersByTime(30_000));

      test('should have called API once', () => expect(pollFn).toBeCalledTimes(1));
      test('should have first API response', () =>
        expect(hasResolved(pollReturnDeferred[0].promise)).resolves.toBe(true));
      test('should warn once', () =>
        waitFor(() =>
          expect(console.warn).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('REST API should not return sooner than the predefined `pingInterval` of 45000 ms.')
          )
        ));

      describe('after 30 seconds', () => {
        beforeEach(() => jest.advanceTimersByTime(30_000));

        test('should have called API twice', () => waitFor(() => expect(pollFn).toBeCalledTimes(2)));
        test('should not have second API response', () =>
          expect(hasResolved(pollReturnDeferred[1].promise)).resolves.toBe(false));
      });
    });
  });
});

describe('with pingInterval=15_000', () => {
  beforeEach(() => {
    signal = watchREST(serverURL, {
      pingInterval: 15_000,
      signal: abortController.signal
    });
  });

  describe('after first poll received', () => {
    beforeEach(() => pollCallDeferred[0].promise);

    test('should have called API once', () => expect(pollFn).toBeCalledTimes(1));
    test('should not have first API response', () =>
      expect(hasResolved(pollReturnDeferred[0].promise)).resolves.toBe(false));

    describe('after 20 seconds', () => {
      beforeEach(() => jest.advanceTimersByTime(20_000));

      test('should have called API once', () => expect(pollFn).toBeCalledTimes(1));
      test('should not have first API response', () =>
        expect(hasResolved(pollReturnDeferred[0].promise)).resolves.toBe(false));

      describe('after 10 seconds', () => {
        beforeEach(() => jest.advanceTimersByTime(10_000));

        test('should have called API twice', () => waitFor(() => expect(pollFn).toBeCalledTimes(2)));
        test('should have first API response', () =>
          expect(hasResolved(pollReturnDeferred[0].promise)).resolves.toBe(true));
        test('should not have second API response', () =>
          expect(hasResolved(pollReturnDeferred[1].promise)).resolves.toBe(false));
        test('should not warn', () => expect(console.warn).not.toBeCalled());
      });
    });
  });
});
