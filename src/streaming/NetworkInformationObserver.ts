import mergeAbortSignal from './mergeAbortSignal';
import sleep from './sleep';

type NetworkInformationObserverCallback = (networkInformation: NetworkInformation) => void;
// type NetworkInformationType = 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'other' | 'unknown' | 'wifi' | 'wimax';
type ObserveInit = { firstChunkWithin?: number; shortPollURL?: undefined | URL };

const DEFAULT_FIRST_CHUNK_WITHIN = 5_000;
const MINIMUM_PING_INTERVAL = 10_000;
const SLEEP_INTERVAL_AFTER_ERROR = 2_000;
const TIMEOUT_PARAM_NAME = 'timeout';

class NetworkInformationPolyfill extends EventTarget implements NetworkInformation {
  constructor(url: URL, init: Required<ObserveInit> & { signal: AbortSignal }) {
    super();

    this.#firstChunkWithin = init.firstChunkWithin;
    this.#shortPollURL = init.shortPollURL;
    this.#signal = init.signal;
    this.#type = 'none';
    this.#url = url;

    this.#start().catch(() => {});
  }

  #firstChunkWithin: number;
  #shortPollURL: URL;
  #signal: AbortSignal;
  #type: 'none' | 'unknown';
  #url: URL;

  get type() {
    return this.#type;
  }

  #setOffline() {
    this.#setType('none');
  }

  #setOnline() {
    this.#setType('unknown');
  }

  #setType(type: 'none' | 'unknown') {
    if (this.#type !== type) {
      this.#type = type;
      this.dispatchEvent(new Event('change'));
    }
  }

  async #start() {
    let shortPing = true;

    while (!this.#signal.aborted) {
      const currentAbortController = new AbortController();

      try {
        const signal = mergeAbortSignal(currentAbortController.signal, this.#signal);
        const startTime = Date.now();

        const res = await Promise.race([
          fetch(shortPing ? this.#shortPollURL : this.#url, {
            headers: { 'cache-control': 'no-store' },
            signal
          }),
          sleep(this.#firstChunkWithin, { signal }).then(() =>
            Promise.reject(new Error('Timed out while waiting for first chunk.'))
          )
        ]);

        // Received first chunk.
        this.#setOnline();
        await res.arrayBuffer();

        const timeToSleep = Math.max(0, MINIMUM_PING_INTERVAL + startTime - Date.now());

        // Do not ping long-polling sooner than 10 seconds.
        if (!shortPing) {
          if (timeToSleep > 0) {
            console.warn(
              `botframework-directlinejs: network connectivity probe should not return sooner than 10 seconds.`
            );

            await sleep(timeToSleep, { signal });
          }
        }

        shortPing = false;
      } catch (error) {
        currentAbortController.abort();

        this.#setOffline();
        shortPing = true;

        await sleep(SLEEP_INTERVAL_AFTER_ERROR, { signal: this.#signal });
      }
    }
  }
}

export default class NetworkInformationObserver {
  constructor(callback: NetworkInformationObserverCallback) {
    this.#callback = callback;
  }

  #callback: NetworkInformationObserverCallback;
  #connections: Map<string, readonly [NetworkInformationPolyfill, AbortController]> = new Map();

  disconnect() {
    for (const [_, abortController] of this.#connections.values()) {
      abortController.abort();
    }

    this.#connections.clear();
  }

  observe(url: string, init: ObserveInit = {}) {
    let entry = this.#connections.get(url);

    if (!entry) {
      const rectifiedFirstChunkWithin = init.firstChunkWithin || DEFAULT_FIRST_CHUNK_WITHIN;
      let rectifiedShortPollURL: URL;
      let rectifiedURL: URL;

      if (init.shortPollURL) {
        rectifiedShortPollURL = new URL(init.shortPollURL);
        rectifiedURL = new URL(url);
      } else {
        rectifiedShortPollURL = new URL(url);
        rectifiedShortPollURL.searchParams.set(TIMEOUT_PARAM_NAME, '0');
        rectifiedURL = new URL(url);
        rectifiedURL.searchParams.set(TIMEOUT_PARAM_NAME, '30');
      }

      const abortController = new AbortController();

      const connection = new NetworkInformationPolyfill(rectifiedURL, {
        firstChunkWithin: rectifiedFirstChunkWithin,
        shortPollURL: rectifiedShortPollURL,
        signal: abortController.signal
      });

      entry = Object.freeze([connection, abortController]);
      this.#connections.set(url, entry);
    }

    this.#callback(entry[0]);
  }

  unobserve(url: string) {
    this.#connections.get(url)?.[1].abort();
    this.#connections.delete(url);
  }
}
