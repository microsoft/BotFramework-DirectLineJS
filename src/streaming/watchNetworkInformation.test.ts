import watchNetworkInformation from './watchNetworkInformation';

let abortController: AbortController;

beforeEach(() => {
  const networkInformation = new EventTarget();

  (global as any).navigator = {
    get connection() {
      return networkInformation;
    }
  };

  abortController = new AbortController();
});

describe('after constructed', () => {
  let watchdog: AbortSignal;

  beforeEach(() => {
    watchdog = watchNetworkInformation({ signal: abortController.signal });
  });

  test('should not be aborted', () => expect(watchdog.aborted).toBe(false));

  describe('when "change" event is received', () => {
    beforeEach(() => navigator.connection.dispatchEvent(new Event('change')));

    test('should be aborted', () => expect(watchdog.aborted).toBe(true));
  });
});
