import type { WebSocketClient } from 'botframework-streaming';
import type ActualWebSocketClientWithProbe from './WebSocketClientWithProbe';

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
let probe: AbortController;

beforeEach(() => {
  probe = new AbortController();

  let WebSocketClientWithProbe: typeof ActualWebSocketClientWithProbe;

  WebSocketClientWithProbe = require('./WebSocketClientWithProbe').default;

  client = new WebSocketClientWithProbe({
    disconnectionHandler,
    probe: probe.signal,
    requestHandler,
    url
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

    describe('then abort the probe', () => {
      beforeEach(() => probe.abort());

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

describe('probe is aborted then call connect()', () => {
  beforeEach(() => {
    probe.abort();
    client.connect();
  });

  test('should warn once', () => expect(console.warn).toBeCalledTimes(1));
  test('should warn "probe is aborted before connect()"', () =>
    expect(console.warn).toHaveBeenNthCalledWith(1, expect.stringContaining('probe is aborted before connect()')));
  test('should not call super.connect()', () => expect(client['__test__connect']).toBeCalledTimes(0));
});
