import type { WebSocketClient } from 'botframework-streaming';
import type OriginalWebSocketClientWithWatchdog from './WebSocketClientWithWatchdog';

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

type WebSocketClientInit = ConstructorParameters<typeof WebSocketClient>[0];

const disconnectionHandler: WebSocketClientInit['disconnectionHandler'] = jest.fn();
const requestHandler: WebSocketClientInit['requestHandler'] = { processRequest: jest.fn() };
const url: string = 'wss://dummy/';

let client: WebSocketClient;
let watchdog: AbortController;

beforeEach(() => {
  watchdog = new AbortController();

  let WebSocketClientWithWatchdog: typeof OriginalWebSocketClientWithWatchdog;

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

test('should not call disconnectHandler()', () => expect(disconnectionHandler).toBeCalledTimes(0));

describe('call connect()', () => {
  beforeEach(() => client.connect());

  describe('call disconnect()', () => {
    beforeEach(() => client.disconnect());

    // Both sender/receiver will call `onConnectionDisconnected`, so it is calling it twice.
    test('should call disconnectHandler() twice', () => expect(disconnectionHandler).toBeCalledTimes(2));

    describe('followed by aborting watchdog', () => {
      beforeEach(() => watchdog.abort());

      // After disconnected() is called, there should be no extra calls for aborting the signal.
      test('should have no extra calls to disconnectHandler()', () => expect(disconnectionHandler).toBeCalledTimes(2));
    });
  });

  describe('abort watchdog', () => {
    beforeEach(() => watchdog.abort());

    // Both sender/receiver will call `onConnectionDisconnected`, so it is calling it twice.
    test('should call disconnectHandler() twice', () => expect(disconnectionHandler).toBeCalledTimes(2));

    describe('then call disconnect()', () => {
      beforeEach(() => client.disconnect());

      // After the signal is aborted, there should be no extra calls for calling disconnect().
      test('should have no extra calls to disconnectHandler()', () => expect(disconnectionHandler).toBeCalledTimes(2));
    });
  });
});
