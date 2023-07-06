declare global {
  // This is subset of https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation.
  interface NetworkInformation extends EventTarget {
    addEventListener(
      type: 'change',
      listener: EventListener | EventListenerObject,
      options?: AddEventListenerOptions | boolean
    ): void;

    removeEventListener(
      type: 'change',
      listener: EventListener | EventListenerObject,
      options?: AddEventListenerOptions | boolean
    ): void;
  }

  interface Navigator {
    get connection(): NetworkInformation;
  }
}

type WatchNetworkInformationInit = {
  signal: AbortSignal;
};

/**
 * Watches the connection a device is using to communicate with the network via [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API).
 *
 * When the connection change, watchdog will treat it as a fault.
 */
export default function watchNetworkInformation({ signal }: WatchNetworkInformationInit): AbortSignal {
  const abortController = new AbortController();
  const handleNetworkInformationChange = () => abortController.abort();

  const connection = navigator?.connection;

  if (connection) {
    connection.addEventListener('change', handleNetworkInformationChange, { once: true });

    signal?.addEventListener('abort', () => {
      connection.removeEventListener('change', handleNetworkInformationChange);
      abortController.abort();
    });
  } else {
    console.warn('botframework-directlinejs: Network Information API is not supported in the current environment, liveness probe will not report fault.');
  }

  return abortController.signal;
}
