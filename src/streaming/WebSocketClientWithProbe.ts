import { WebSocketClient } from 'botframework-streaming';

import type { RequestHandler } from 'botframework-streaming';

type WebSocketClientWithProbeInit = {
  /**
   * Gets or sets the observer function for disconnection or error sending/receiving through WebSocket.
   *
   * Note: This function could be called multiple times, the callee is expected to ignore subsequent calls.
   */
  disconnectionHandler?: (message: string) => void;
  probe?: AbortSignal;
  requestHandler: RequestHandler;
  url: string;
};

export default class WebSocketClientWithProbe extends WebSocketClient {
  constructor({ disconnectionHandler, probe, requestHandler, url }: WebSocketClientWithProbeInit) {
    super({
      disconnectionHandler,
      requestHandler,
      url
    });

    this.#probe = probe;
  }

  #connectCalled: boolean = false;
  #probe: WebSocketClientWithProbeInit['probe'];

  // TODO: Better, the `probe` should be passed to `BrowserWebSocketClient` -> `BrowserWebSocket`.
  //       `BrowserWebSocket` is where it creates `WebSocket` object.
  //       The `probe` object should accompany `WebSocket` and forcibly close it on abort.
  //       Maybe `botframework-streaming` should accept ponyfills.
  connect(): Promise<void> {
    if (this.#connectCalled) {
      console.warn('botframework-directlinejs: connect() can only be called once.');

      return;
    } else if (this.#probe?.aborted) {
      console.warn('botframework-directlinejs: probe is aborted before connect().');

      return;
    }

    this.#connectCalled = true;

    // Note: It is expected disconnectionHandler() will be called multiple times.
    //       If we call disconnect(), both sender/receiver will call super.onConnectionDisconnected(),
    //       which in turn, call disconnectionHandler() twice, all from a single disconnect() call.
    this.#probe?.addEventListener('abort', () => this.disconnect(), { once: true });

    return super.connect();
  }
}
