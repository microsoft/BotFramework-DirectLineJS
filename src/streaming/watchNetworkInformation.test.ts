import watchNetworkInformation from './watchNetworkInformation';

let abortController: AbortController;
let networkInformation: EventTarget;

beforeEach(() => {
  abortController = new AbortController();
  networkInformation = new EventTarget();
});

describe('after constructed', () => {
  let watchdog: AbortSignal;

  beforeEach(() => {
    watchdog = watchNetworkInformation(networkInformation, { signal: abortController.signal });
  });

  test('should not be aborted', () => expect(watchdog.aborted).toBe(false));

  describe('when "change" event is received', () => {
    beforeEach(() => navigator.connection.dispatchEvent(new Event('change')));

    test('should be aborted', () => expect(watchdog.aborted).toBe(true));
  });
});
