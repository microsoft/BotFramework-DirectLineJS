import sleep from './sleep';

// The liveness service should respond HTTP 2xx not sooner than 30 seconds.
// To prevent DoS the liveness service, we should not send probe to the liveness service sooner than 25 seconds.
let DEFAULT_MINIMUM_INTERVAL = 25_000;
let MINIMUM_MINIMUM_INTERVAL = 10_000;

type ProbeRESTInit = {
  /**
   * Minimum time between pings in milliseconds, minimum is 10 seconds, default to 25 seconds.
   *
   * The probing REST API endpoint should keep the polling call open for at least 30 seconds, then respond with HTTP 2xx.
   *
   * If the service respond with HTTP 2xx sooner than this interval, the next call will be delayed until the interval has passed.
   * In the meantime, the probe will not be able to detect any connection faults.
   *
   * If the service respond with HTTP 2xx on or later than this interval, the next call will be made immediately.
   *
   * For example, assumes the interval is set to 25 seconds. If the service responded after 10 seconds the call is being made,
   * the probe will wait for 15 seconds before making another call.
   */
  minimumInterval?: number;

  /**
   * Signal to abort the probe.
   *
   * When this signal is being aborted, the probe will treat it as a fault.
   */
  signal?: AbortSignal;
};

/**
 * Probes connectivity issues by continuously calling a long-polling REST API endpoint and returns an `AbortSignal` object.
 *
 * The returned `AbortSignal` object will be aborted when:
 *
 * 1. the REST API endpoint did not return a HTTP 2xx status, or;
 * 2. the `ProbeRESTInit.signal` is aborted.
 *
 * The REST API endpoint should keep the polling call open for 30 seconds, then respond with HTTP 2xx.
 *
 * Upon receiving HTTP 2xx, the probe will issue another long polling call immediately and not sooner than `minimumInterval`.
 *
 * [RFC6202](https://www.rfc-editor.org/rfc/rfc6202) recommends using a timeout value of 30 seconds.
 */
export default function probeREST(url: string | URL, { minimumInterval, signal }: ProbeRESTInit = {}): AbortSignal {
  const abortController = new AbortController();

  (async () => {
    let warnedReturnTooSoon = false;

    try {
      // Rectifying `minimumInterval`.
      if (typeof minimumInterval === 'number') {
        minimumInterval = Math.max(MINIMUM_MINIMUM_INTERVAL, minimumInterval);
      } else {
        minimumInterval = DEFAULT_MINIMUM_INTERVAL;
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

        // TODO: Warns if the API returns sooner than `minimumInterval`.
        const timeToSleep = pingAt + minimumInterval - Date.now();

        if (timeToSleep > 0) {
          warnedReturnTooSoon ||
            console.warn(
              `botframework-directlinejs: REST API should not return sooner than the predefined \`minimumInterval\` of ${minimumInterval} ms.`
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
