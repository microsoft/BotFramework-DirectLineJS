import probeNetworkInformation from './probeNetworkInformation';

let abortController: AbortController;
let networkInformation: EventTarget;

beforeEach(() => {
  abortController = new AbortController();
  networkInformation = new EventTarget();
});

describe('after constructed', () => {
  let probe: AbortSignal;

  beforeEach(() => {
    probe = probeNetworkInformation(networkInformation, { signal: abortController.signal });
  });

  test('should not be aborted', () => expect(probe.aborted).toBe(false));

  describe('when "change" event is received', () => {
    beforeEach(() => networkInformation.dispatchEvent(new Event('change')));

    test('should be aborted', () => expect(probe.aborted).toBe(true));
  });
});
