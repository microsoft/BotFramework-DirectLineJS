import { WebSocketClient } from 'botframework-streaming';

import type { RequestHandler } from 'botframework-streaming';

type WebSocketClientWithNetworkInformationInit = {
  /**
   * Gets or sets the observer function for disconnection or error sending/receiving through WebSocket.
   *
   * Note: This function could be called multiple times, the callee is expected to ignore subsequent calls.
   */
  disconnectionHandler: (message: string) => void;
  networkInformation?: NetworkInformation | undefined;
  requestHandler: RequestHandler;
  url: string;
};

export default class WebSocketClientWithNetworkInformation extends WebSocketClient {
  constructor({
    disconnectionHandler,
    networkInformation,
    requestHandler,
    url
  }: WebSocketClientWithNetworkInformationInit) {
    super({
      disconnectionHandler,
      requestHandler,
      url
    });

    this.#networkInformation = networkInformation;
  }

  #connectCalled: boolean = false;
  // According to W3C Network Information API, https://wicg.github.io/netinfo/#handling-changes-to-the-underlying-connection.
  // NetworkInformation.onChange event will be fired on any changes to: `downlinkMax`, `type`, `downlink`, or `rtt`.
  #handleNetworkInformationChange = () =>
    this.#initialNetworkInformationType === this.#networkInformation.type || this.disconnect();
  #initialNetworkInformationType: NetworkInformation['type'];
  #networkInformation: NetworkInformation;

  // TODO: Better, the `NetworkInformation` instance should be passed to `BrowserWebSocketClient` -> `BrowserWebSocket`.
  //       `BrowserWebSocket` is where it creates `WebSocket` object.
  //       The `NetworkInformation` instance should accompany `WebSocket` and forcibly close it on abort.
  //       Maybe `botframework-streaming` should accept ponyfills.
  connect(): Promise<void> {
    if (this.#connectCalled) {
      console.warn('botframework-directlinejs: connect() can only be called once.');

      return Promise.resolve();
    }

    this.#connectCalled = true;

    if (this.#networkInformation) {
      const { type: initialType } = this.#networkInformation;

      this.#initialNetworkInformationType = initialType;

      if (initialType === 'none') {
        console.warn('botframework-directlinejs: Failed to connect while offline.');

        return Promise.reject(new Error('botframework-directlinejs: Failed to connect while offline.'));
      }

      this.#networkInformation.addEventListener('change', this.#handleNetworkInformationChange);
    }

    return super.connect();
  }

  disconnect() {
    this.#networkInformation.removeEventListener('change', this.#handleNetworkInformationChange);
    super.disconnect();
  }
}
