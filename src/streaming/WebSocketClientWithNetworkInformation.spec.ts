import type { WebSocketClient } from 'botframework-streaming';
import type ActualWebSocketClientWithNetworkInformation from './WebSocketClientWithNetworkInformation';

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

type NetworkInformationType = 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'other' | 'unknown' | 'wifi' | 'wimax';

class MockNetworkInformation extends EventTarget {
  constructor() {
    super();
  }

  #type: NetworkInformationType = 'none';

  get type() {
    return this.#type;
  }

  set type(value: NetworkInformationType) {
    if (this.#type !== value) {
      this.#type = value;
      this.dispatchEvent(new Event('change'));
    }
  }
}

type WebSocketClientInit = ConstructorParameters<typeof WebSocketClient>[0];

const disconnectionHandler: WebSocketClientInit['disconnectionHandler'] = jest.fn();
const requestHandler: WebSocketClientInit['requestHandler'] = { processRequest: jest.fn() };
const url: string = 'wss://dummy/';

let client: WebSocketClient;
let connection: MockNetworkInformation;

beforeEach(() => {
  connection = new MockNetworkInformation();

  let WebSocketClientWithNetworkInformation: typeof ActualWebSocketClientWithNetworkInformation;

  WebSocketClientWithNetworkInformation = require('./WebSocketClientWithNetworkInformation').default;

  client = new WebSocketClientWithNetworkInformation({
    disconnectionHandler,
    networkInformation: connection,
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

describe('initially online', () => {
  beforeEach(() => {
    connection.type = 'wifi';
  });

  test('should not call super.connect()', () => expect(client['__test__connect']).toBeCalledTimes(0));

  describe('when connect() is called', () => {
    beforeEach(() => client.connect());

    test('should call super.connect()', () => expect(client['__test__connect']).toBeCalledTimes(1));
    test('should not call super.disconnect()', () => expect(client['__test__disconnect']).toBeCalledTimes(0));
    test('should not call disconnectionHandler', () =>
      expect(client['__test__disconnectionHandler']).toBeCalledTimes(0));

    describe('when offline', () => {
      beforeEach(() => {
        connection.type = 'none';
      });

      test('should call super.disconnect()', () => expect(client['__test__disconnect']).toBeCalledTimes(1));

      // If connected, it should call disconnectionHandler.
      test('should call disconnectionHandler', () => expect(client['__test__disconnectionHandler']).toBeCalledTimes(1));

      describe('when connect() is called after disconnect', () => {
        let promise;

        beforeEach(() => {
          jest.spyOn(console, 'warn').mockImplementation(() => {});

          promise = client.connect();
        });

        test('should resolve', () => expect(promise).resolves.toBeUndefined());
        test('should warn', () => {
          expect(console.warn).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenNthCalledWith(1, expect.stringContaining('connect() can only be called once'));
        });
      });
    });

    describe('when network type change to "bluetooth"', () => {
      beforeEach(() => {
        connection.type = 'bluetooth';
      });

      test('should call super.disconnect()', () => expect(client['__test__disconnect']).toBeCalledTimes(1));
      test('should call disconnectionHandler', () => expect(client['__test__disconnectionHandler']).toBeCalledTimes(1));
    });

    describe('when connect() is called twice', () => {
      let promise;

      beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        promise = client.connect();
      });

      test('should resolve', () => expect(promise).resolves.toBeUndefined());
      test('should warn', () => {
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenNthCalledWith(1, expect.stringContaining('connect() can only be called once'));
      });
    });
  });
});

describe('initially offline', () => {
  test('NetworkInformation should have type of "none"', () => expect(connection).toHaveProperty('type', 'none'));

  describe('when connect() is called', () => {
    let promise;

    beforeEach(() => {
      promise = client.connect();
      promise.catch(() => {});
    });

    test('should throw', () => expect(() => promise).rejects.toThrow());

    // If never connected, it did not need to call disconnectionHandler.
    test('should not call super.disconnect()', () => expect(client['__test__disconnect']).toBeCalledTimes(0));
    test('should not call disconnectionHandler', () =>
      expect(client['__test__disconnectionHandler']).toBeCalledTimes(0));
  });
});
