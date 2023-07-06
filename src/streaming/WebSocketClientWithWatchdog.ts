import { WebSocketClient } from 'botframework-streaming';

import type { RequestHandler } from 'botframework-streaming';

type WebSocketClientWithWatchdogInit = {
  /**
   * Gets or sets the observer function for disconnection or error sending/receiving through WebSocket.
   *
   * Note: This function could be called multiple times, the callee is expected to ignore subsequent calls.
   */
  disconnectionHandler?: (message: string) => void;
  requestHandler: RequestHandler;
  url: string;
  watchdog?: AbortSignal;
};

export default class WebSocketClientWithWatchdog extends WebSocketClient {
  constructor({ disconnectionHandler, requestHandler, url, watchdog }: WebSocketClientWithWatchdogInit) {
    super({
      disconnectionHandler,
      requestHandler,
      url
    });

    this.#watchdog = watchdog;
  }

  #connectCalled: boolean = false;
  #watchdog: WebSocketClientWithWatchdogInit['watchdog'];

  // TODO: Better, the `watchdog` should be passed to `BrowserWebSocketClient` -> `BrowserWebSocket`.
  //       `BrowserWebSocket` is where it creates `WebSocket` object.
  //       The `watchdog` object should accompany `WebSocket` and forcibly close it on abort.
  //       Maybe `botframework-streaming` should accept ponyfills.
  connect(): Promise<void> {
    if (this.#connectCalled) {
      console.warn('botframework-directlinejs: connect() can only be called once.');

      return;
    } else if (this.#watchdog?.aborted) {
      console.warn('botframework-directlinejs: watchdog is aborted before connect().');

      return;
    }

    this.#connectCalled = true;

    // Note: It is expected disconnectionHandler() will be called multiple times.
    //       If we call disconnect(), both sender/receiver will call super.onConnectionDisconnected(),
    //       which in turn, call disconnectionHandler() twice, all from a single disconnect() call.
    this.#watchdog?.addEventListener('abort', () => this.disconnect(), { once: true });

    return super.connect();
  }
}
