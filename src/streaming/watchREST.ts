import sleep from './sleep';

// The watchdog service should respond HTTP 2xx not sooner than 30 seconds.
// To prevent DoS the watchdog service, we should not send ping the watchdog service sooner than 25 seconds.
let DEFAULT_PING_INTERVAL = 25_000;
let MINIMUM_PING_INTERVAL = 10_000;

type WatchRESTInit = {
  /**
   * Time between pings in milliseconds, minimum is 10 seconds, default to 25 seconds.
   *
   * The watching REST API endpoint should keep the polling call open for at least 30 seconds, then respond with HTTP 2xx.
   *
   * If the service return HTTP 2xx sooner than this value (25 seconds), we will wait until the time has passed before
   * sending the ping again. In the meantime, the watchdog will not able to detect any connection issues.
   *
   * If the service return HTTP 2xx later than this value, we will wait until the service return HTTP 2xx.
   */
  pingInterval?: number;

  /**
   * Signal to abort the watchdog.
   *
   * When the signal is aborted, the watchdog signal will be aborted.
   */
  signal?: AbortSignal;
};

/**
 * Watches connectivity issues by continuously calling a long-polling REST API endpoint and returns an `AbortSignal` object.
 *
 * The returned `AbortSignal` object will be aborted when:
 *
 * 1. the REST API endpoint did not return a HTTP 2xx status, or;
 * 2. the `WatchRESTInit.signal` is aborted.
 *
 * The REST API endpoint should keep the polling call open for 30 seconds, then respond with HTTP 2xx.
 *
 * Upon receiving HTTP 2xx, the watchdog will issue another long polling call immediately and not sooner than `pingInterval`.
 *
 * [RFC6202](https://www.rfc-editor.org/rfc/rfc6202) recommends using a timeout value of 30 seconds.
 */
export default function watchREST(url: string | URL, { pingInterval, signal }: WatchRESTInit = {}): AbortSignal {
  const abortController = new AbortController();

  (async () => {
    let warnedReturnTooSoon = false;

    try {
      // Rectifying `pingInterval`.
      if (typeof pingInterval === 'number') {
        pingInterval = Math.max(MINIMUM_PING_INTERVAL, pingInterval);
      } else {
        pingInterval = DEFAULT_PING_INTERVAL;
      }

      // Rectifying `signal`.
      if (signal && !(signal instanceof AbortSignal)) {
        signal = undefined;
      }

      // Instead of listening to signal.addEventListener('abort'), we will just let fetch() handle all aborts.
      while (!signal?.aborted) {
        const pingAt = Date.now();
        const res = await fetch(url, { signal });

        if (!res.ok) {
          throw new Error('Failed to ping REST endpoint.');
        }

        await res.arrayBuffer();

        // TODO: Warns if the API returns sooner than `pingInterval`.
        const timeToSleep = pingAt + pingInterval - Date.now();

        if (timeToSleep > 0) {
          warnedReturnTooSoon ||
            console.warn(
              `botframework-directlinejs: REST API should not return sooner than the predefined \`pingInterval\` of ${pingInterval} ms.`
            );

          warnedReturnTooSoon = true;
        }

        await sleep(timeToSleep, { signal });
      }
    } catch (error) {
      // If any error occurred, probably it is about connection issues.
    } finally {
      abortController.abort();
    }
  })();

  return abortController.signal;
}
