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

    get type(): 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'other' | 'unknown' | 'wifi' | 'wimax';
  }

  interface Navigator {
    get connection(): NetworkInformation;
  }
}

export {}
