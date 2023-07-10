import type { WebSocketClient } from 'botframework-streaming';
import type OriginalWebSocketClientWithNetworkInformation from './WebSocketClientWithNetworkInformation';

// Mocked modules are available across the test file. They cannot be unmocked.
// Thus, they are more-or-less similar to import/require.
jest.mock('../../node_modules/botframework-streaming/lib/webSocket/nodeWebSocket', () => ({
  __esmodule: true,
  NodeWebSocket: class {
    connect() {}
    setOnCloseHandler() {}
    setOnErrorHandler() {}
    setOnMessageHandler() {}
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
let networkInformationConnection: MockNetworkInformation;

beforeEach(() => {
  networkInformationConnection = new MockNetworkInformation();

  let WebSocketClientWithNetworkInformation: typeof OriginalWebSocketClientWithNetworkInformation;

  WebSocketClientWithNetworkInformation = require('./WebSocketClientWithNetworkInformation').default;

  client = new WebSocketClientWithNetworkInformation({
    disconnectionHandler,
    networkInformation: networkInformationConnection,
    requestHandler,
    url
  });

  // Spy on all `console.warn()`.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test('should not call disconnectHandler()', () => expect(disconnectionHandler).toBeCalledTimes(0));

describe('initially online', () => {
  beforeEach(() => {
    networkInformationConnection.type = 'wifi';
  });

  describe('when connect() is called', () => {
    beforeEach(() => client.connect());

    describe('call disconnect()', () => {
      beforeEach(() => client.disconnect());

      // Both sender/receiver will call `onConnectionDisconnected`, so it is calling it twice.
      test('should call disconnectHandler() twice', () => expect(disconnectionHandler).toBeCalledTimes(2));

      describe('when offline', () => {
        beforeEach(() => {
          networkInformationConnection.type = 'none';
        });

        // After disconnected() is called, there should be no extra calls for offline.
        test('should have no extra calls to disconnectHandler()', () =>
          expect(disconnectionHandler).toBeCalledTimes(2));
      });
    });

    describe('when offline', () => {
      beforeEach(() => {
        networkInformationConnection.type = 'none';
      });

      // Both sender/receiver will call `onConnectionDisconnected`, so it is calling it twice.
      test('should call disconnectHandler() twice', () => expect(disconnectionHandler).toBeCalledTimes(2));

      describe('when disconnect() is called', () => {
        beforeEach(() => client.disconnect());

        // After the signal is aborted, there should be no extra calls for calling disconnect().
        test('should have no extra calls to disconnectHandler()', () =>
          expect(disconnectionHandler).toBeCalledTimes(2));
      });
    });
  });
});
