/// <reference path="./NetworkInformation.d.ts" />

import { createServer, IncomingMessage } from 'http';
import express from 'express';

import NetworkInformationObserver from './NetworkInformationObserver';
import waitFor from './__setup__/waitFor';

import type { Response } from 'express';
import type { Socket } from 'net';

beforeEach(() => jest.useFakeTimers({ advanceTimers: true, now: 0 }));
afterEach(() => jest.useRealTimers());

let baseURL: URL;
let firstChunkInterval: number;
let processRequest: jest.Mock<void, [IncomingMessage, Response]>;
let server: ReturnType<typeof createServer>;
let sockets: Set<Socket>;

beforeEach(async () => {
  const app = express();

  firstChunkInterval = 0;
  sockets = new Set();
  processRequest = jest.fn();

  app.get('/api/poll', (req, res) => {
    processRequest(req, res);
    sockets.add(req.socket);

    req.once('close', () => {
      res.destroy();
      sockets.delete(req.socket);
    });

    const timeout = +(new URL(req.url, 'http://localhost/').searchParams.get('timeout') || 0);

    res.statusCode = 200;
    res.setHeader('cache-control', 'no-store');
    res.setHeader('transfer-encoding', 'chunked');

    if (timeout) {
      setTimeout(() => {
        res.write(' ');

        setTimeout(() => res.end(), timeout * 1_000 - firstChunkInterval);
      }, firstChunkInterval);
    } else {
      res.end();
    }
  });

  app.get('/api/shortpoll', (req, res) => {
    processRequest(req, res);

    res.statusCode = 204;
    res.setHeader('cache-control', 'no-store');
    res.end();
  });

  app.get('/api/longpoll', (req, res) => {
    processRequest(req, res);
    sockets.add(req.socket);

    res.statusCode = 200;
    res.setHeader('cache-control', 'no-store');
    res.setHeader('transfer-encoding', 'chunked');
    res.write(' ');

    req.once('close', () => {
      res.destroy();
      sockets.delete(req.socket);
    });

    setTimeout(() => res.end(), 30_000);
  });

  server = createServer(app);

  await new Promise<void>(resolve => server.listen(0, 'localhost', resolve));

  const address = server.address();

  if (!address) {
    throw new Error('Cannot listen.');
  }

  baseURL = new URL(`http://${typeof address === 'string' ? address : `${address.address}:${address.port}`}`);
});

afterEach(() => {
  server.closeAllConnections();
  server.close();

  jest.resetAllMocks();
});

describe('A NetworkInformationObserver', () => {
  let callback: jest.Mock<void, [NetworkInformation]>;
  let observer: NetworkInformationObserver;

  beforeEach(() => {
    observer = new NetworkInformationObserver((callback = jest.fn()));
  });

  describe.each<[string, string, string?]>([
    ['default options', '/api/poll'],
    ['shortPollURL', '/api/longpoll', '/api/shortpoll']
  ])('observe with %s', (_, url, shortPollURL) => {
    let expectedLongPollURL: URL;
    let expectedShortPollURL: URL;

    beforeEach(() => {
      if (shortPollURL) {
        observer.observe(new URL(url, baseURL).href, { shortPollURL: new URL(shortPollURL, baseURL) });

        expectedLongPollURL = new URL(url, baseURL);
        expectedShortPollURL = new URL(shortPollURL, baseURL);
      } else {
        observer.observe(new URL(url, baseURL).href);

        expectedLongPollURL = new URL(url, baseURL);
        expectedLongPollURL.searchParams.set('timeout', '30');
        expectedShortPollURL = new URL(url, baseURL);
        expectedShortPollURL.searchParams.set('timeout', '0');
      }
    });

    afterEach(() => observer.disconnect());

    describe('when callback is received', () => {
      let connection: NetworkInformation;
      let handleChange: jest.Mock<void, [Event]>;

      beforeEach(() => {
        expect(callback).toBeCalledTimes(1);
        connection = callback.mock.calls[0][0];
        connection.addEventListener('change', (handleChange = jest.fn()));
      });

      test('should receive an instance of NetworkInformation', () => {
        expect(callback).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            type: expect.stringMatching(/^(bluetooth|cellular|ethernet|none|other|unknown|wifi|wimax)$/)
          })
        );
        expect(typeof callback.mock.calls[0][0].addEventListener).toBe('function');
        expect(typeof callback.mock.calls[0][0].removeEventListener).toBe('function');
      });

      describe('when connection is detected', () => {
        beforeEach(() =>
          waitFor(() => {
            expect(connection).toHaveProperty('type', 'unknown');
            expect(processRequest).toHaveBeenCalledTimes(2);
          })
        );

        test('should have type of "unknown"', () =>
          waitFor(() => expect(connection).toHaveProperty('type', 'unknown')));
        test('should dispatch "change" event', () => waitFor(() => expect(handleChange).toHaveBeenCalledTimes(1)));
        test('should connect with short poll followed by long poll', () =>
          waitFor(() => {
            expect(processRequest).toHaveBeenCalledTimes(2);
            expect(processRequest).toHaveBeenNthCalledWith(
              1,
              expect.objectContaining({ url: expectedShortPollURL.pathname + expectedShortPollURL.search }),
              expect.anything()
            );
            expect(processRequest).toHaveBeenNthCalledWith(
              2,
              expect.objectContaining({ url: expectedLongPollURL.pathname + expectedLongPollURL.search }),
              expect.anything()
            );
            expect(sockets).toHaveProperty('size', 1);
          }));

        describe('when connection is broken', () => {
          beforeEach(() => {
            for (const socket of sockets.values()) {
              socket.destroy();
            }
          });

          test('should have type of "none"', () => waitFor(() => expect(connection).toHaveProperty('type', 'none')));
          test('should dispatch "change" event', () => waitFor(() => expect(handleChange).toHaveBeenCalledTimes(2)));

          describe('after disconnection is detected', () => {
            beforeEach(() => waitFor(() => expect(connection).toHaveProperty('type', 'none')));

            describe('after 1 second', () => {
              beforeEach(() => jest.advanceTimersByTimeAsync(1_000));

              test('should not reconnect', () => expect(sockets).toHaveProperty('size', 0));
            });

            describe('after 2 seconds', () => {
              beforeEach(() => jest.advanceTimersByTimeAsync(2_000));

              test('should have type of "unknown"', () =>
                waitFor(() => expect(connection).toHaveProperty('type', 'unknown')));
              test('should dispatch "change" event', () =>
                waitFor(() => expect(handleChange).toHaveBeenCalledTimes(3)));
              test('should call short-poll followed by long-poll', () =>
                waitFor(() => {
                  expect(processRequest).toHaveBeenCalledTimes(4);
                  expect(processRequest).toHaveBeenNthCalledWith(
                    3,
                    expect.objectContaining({ url: expectedShortPollURL.pathname + expectedShortPollURL.search }),
                    expect.anything()
                  );
                  expect(processRequest).toHaveBeenNthCalledWith(
                    4,
                    expect.objectContaining({ url: expectedLongPollURL.pathname + expectedLongPollURL.search }),
                    expect.anything()
                  );
                  expect(sockets).toHaveProperty('size', 1);
                }));
            });
          });
        });

        describe('after 30 seconds', () => {
          beforeEach(() => jest.advanceTimersByTimeAsync(30_000));

          test('should not dispatch additional "change" event', () =>
            waitFor(() => expect(handleChange).toHaveBeenCalledTimes(1)));
          test('should connect with long poll', () =>
            waitFor(() => {
              expect(processRequest).toHaveBeenCalledTimes(3);
              expect(processRequest).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({ url: expectedLongPollURL.pathname + expectedLongPollURL.search }),
                expect.anything()
              );
              expect(sockets).toHaveProperty('size', 1);
            }));

          describe('after another 30 seconds', () => {
            beforeEach(async () => {
              await waitFor(() => expect(processRequest).toHaveBeenCalledTimes(3));
              await jest.advanceTimersByTimeAsync(30_000);
            });

            test('should not dispatch additional "change" event', () =>
              waitFor(() => expect(handleChange).toHaveBeenCalledTimes(1)));
            test('should connect with long poll', () =>
              waitFor(() => {
                expect(processRequest).toHaveBeenCalledTimes(4);
                expect(processRequest).toHaveBeenNthCalledWith(
                  4,
                  expect.objectContaining({ url: expectedLongPollURL.pathname + expectedLongPollURL.search }),
                  expect.anything()
                );
                expect(sockets).toHaveProperty('size', 1);
              }));
          });
        });
      });
    });
  });

  describe('observe with first chunk delayed for 10 seconds', () => {
    let connection: NetworkInformation;

    beforeEach(async () => {
      firstChunkInterval = 10_000;
      observer.observe(new URL('/api/poll', baseURL).href);

      await expect(callback).toBeCalledTimes(1);
      connection = callback.mock.calls[0][0];
    });

    afterEach(() => observer.disconnect());

    test('should connect long poll', () => waitFor(() => expect(processRequest).toBeCalledTimes(2)));

    describe('when online', () => {
      beforeEach(() => waitFor(() => expect(processRequest).toBeCalledTimes(2)));

      test('type should become "unknown"', () => waitFor(() => expect(connection).toHaveProperty('type', 'unknown')));

      describe('after 5 seconds', () => {
        beforeEach(() => jest.advanceTimersByTimeAsync(5_000));

        test('type should become "none"', () => waitFor(() => expect(connection).toHaveProperty('type', 'none')));
        test('should have closed the connection', () => waitFor(() => expect(sockets).toHaveProperty('size', 0)));
      });
    });
  });

  describe('observe and online', () => {
    let connection: NetworkInformation;

    beforeEach(async () => {
      observer.observe(new URL('/api/poll', baseURL).href);

      await expect(callback).toBeCalledTimes(1);
      connection = callback.mock.calls[0][0];

      await waitFor(() => expect(processRequest).toBeCalledTimes(2));
      waitFor(() => expect(connection).toHaveProperty('type', 'unknown'));
      waitFor(() => expect(sockets).toHaveProperty('size', 1));
    });

    afterEach(() => observer.disconnect());

    describe('when unobserve() is called', () => {
      beforeEach(() => observer.unobserve(new URL('/api/poll', baseURL).href));

      test('should disconnect the call', () => waitFor(() => expect(sockets).toHaveProperty('size', 0)));
    });

    describe('when disconnect() is called', () => {
      beforeEach(() => observer.disconnect());

      test('should disconnect the call', () => waitFor(() => expect(sockets).toHaveProperty('size', 0)));
    });
  });

  describe('observe with short polling API', () => {
    let connection: NetworkInformation;

    beforeEach(async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      observer.observe(new URL('/api/shortpoll', baseURL).href);

      await expect(callback).toBeCalledTimes(1);
      connection = callback.mock.calls[0][0];

      await waitFor(() => expect(processRequest).toBeCalledTimes(2));
      waitFor(() => expect(connection).toHaveProperty('type', 'unknown'));
      waitFor(() => expect(sockets).toHaveProperty('size', 1));
    });

    afterEach(() => console.warn['mockRestore']?.());

    test('should warn', () => {
      expect(console.warn).toBeCalledTimes(1);
      expect(console.warn).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('should not return sooner than 10 seconds')
      );
    });

    describe('after 5 seconds', () => {
      beforeEach(() => jest.advanceTimersByTimeAsync(5_000));

      test('should not reconnect', () => waitFor(() => expect(processRequest).toBeCalledTimes(2)));
    });

    describe.only('after 10 seconds', () => {
      beforeEach(() => jest.advanceTimersByTimeAsync(10_000));

      test('should have connected 3 times', () => waitFor(() => expect(processRequest).toBeCalledTimes(3)));
    });

    describe.only('after 20 seconds', () => {
      beforeEach(() => jest.advanceTimersByTimeAsync(20_000));

      test('should have connected 4 times', () => waitFor(() => expect(processRequest).toBeCalledTimes(4)));
    });
  });
});
