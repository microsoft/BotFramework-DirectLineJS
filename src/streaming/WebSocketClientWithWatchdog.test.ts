import type { WebSocketClient } from 'botframework-streaming';
import type ActualWebSocketClientWithWatchdog from './WebSocketClientWithWatchdog';

// Mocked modules are available across the test file. They cannot be unmocked.
// Thus, they are more-or-less similar to import/require.
jest.mock('botframework-streaming', () => ({
  __esmodule: true,
  WebSocketClient: class WebSocketClient {
    constructor({ disconnectionHandler, requestHandler, url }: WebSocketClientInit) {
      this.#disconnectionHandler = disconnectionHandler;
      this.#requestHandler = requestHandler;
      this.#url = url;

      // Set up mocks.
      this.#connect = jest.fn(() => Promise.resolve());
      this.#disconnect = jest.fn(() => this.#disconnectionHandler?.('disconnect() is called'));
    }

    #connect: () => Promise<void>;
    #disconnect: () => void;
    #disconnectionHandler: WebSocketClientInit['disconnectionHandler'];
    #requestHandler: WebSocketClientInit['requestHandler'];
    #url: string;

    connect(): Promise<void> {
      return this.#connect();
    }

    disconnect(): void {
      return this.#disconnect();
    }

    get __test__connect(): () => Promise<void> {
      return this.#connect;
    }

    get __test__disconnect(): () => void {
      return this.#disconnect;
    }

    get __test__disconnectionHandler(): WebSocketClientInit['disconnectionHandler'] {
      return this.#disconnectionHandler;
    }

    get __test__requestHandler(): WebSocketClientInit['requestHandler'] {
      return this.#requestHandler;
    }

    get __test__url(): WebSocketClientInit['url'] {
      return this.#url;
    }
  }
}));

type WebSocketClientInit = ConstructorParameters<typeof WebSocketClient>[0];

const disconnectionHandler: WebSocketClientInit['disconnectionHandler'] = jest.fn();
const requestHandler: WebSocketClientInit['requestHandler'] = { processRequest: jest.fn() };
const url: string = 'wss://dummy/';

let client: WebSocketClient;
let watchdog: AbortController;

beforeEach(() => {
  watchdog = new AbortController();

  let WebSocketClientWithWatchdog: typeof ActualWebSocketClientWithWatchdog;

  WebSocketClientWithWatchdog = require('./WebSocketClientWithWatchdog').default;

  client = new WebSocketClientWithWatchdog({
    disconnectionHandler,
    requestHandler,
    url,
    watchdog: watchdog.signal
  });

  // Spy on all `console.warn()`.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('constructor', () => {
  test('should pass `disconnectionHandler`', () =>
    expect(client['__test__disconnectionHandler']).toBe(disconnectionHandler));
  test('should pass `requestHandler`', () => expect(client['__test__requestHandler']).toBe(requestHandler));
  test('should pass `url`', () => expect(client['__test__url']).toBe(url));
});

describe('connect()', () => {
  test('should not call super.connect() initially', () => expect(client['__test__connect']).toBeCalledTimes(0));

  describe('when called', () => {
    beforeEach(() => client.connect());

    test('should call super.connect()', () => expect(client['__test__connect']).toBeCalledTimes(1));

    describe('twice', () => {
      beforeEach(() => client.connect());

      test('should warn once', () => expect(console.warn).toBeCalledTimes(1));
      test('should warn "connect() can only be called once"', () =>
        expect(console.warn).toHaveBeenNthCalledWith(1, expect.stringContaining('connect() can only be called once')));
      test('should call super.connect() once', () => expect(client['__test__connect']).toBeCalledTimes(1));
    });

    describe('then abort watchdog', () => {
      beforeEach(() => watchdog.abort());

      test('should call disconnect()', () => expect(client['__test__disconnect']).toBeCalledTimes(1));

      describe('when connect() is called again', () => {
        beforeEach(() => client.connect());

        test('should warn once', () => expect(console.warn).toBeCalledTimes(1));
        test('should warn "connect() can only be called once"', () =>
          expect(console.warn).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('connect() can only be called once')
          ));
        test('should call super.connect() once', () => expect(client['__test__connect']).toBeCalledTimes(1));
      });
    });
  });
});

describe('watchdog is aborted then call connect()', () => {
  beforeEach(() => {
    watchdog.abort();
    client.connect();
  });

  test('should warn once', () => expect(console.warn).toBeCalledTimes(1));
  test('should warn "watchdog is aborted before connect()"', () =>
    expect(console.warn).toHaveBeenNthCalledWith(1, expect.stringContaining('watchdog is aborted before connect()')));
  test('should not call super.connect()', () => expect(client['__test__connect']).toBeCalledTimes(0));
});
