import sleep from './sleep';

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
});

describe('sleep for 1s', () => {
  let abortController: AbortController;
  let now: number;
  let promise: Promise<void>;

  beforeEach(() => {
    abortController = new AbortController();
    now = Date.now();
    promise = sleep(1000, { signal: abortController.signal });
  });

  afterEach(() => {
    promise.catch(() => {});
  });

  test('should have 1 timer', () => expect(jest.getTimerCount()).toBe(1));

  describe('when wake up', () => {
    beforeEach(() => {
      jest.runAllTimers();

      return promise;
    });

    test('should passed 1s', () => expect(Date.now() - now).toBe(1000));
  });

  describe('when aborted', () => {
    beforeEach(() => abortController.abort());

    test('should have no timers', () => expect(jest.getTimerCount()).toBe(0));
    test('should reject', () => expect(() => promise).rejects.toThrow('Aborted.'));
  });

  describe('when 0.5s passed followed by abort', () => {
    beforeEach(() => {
      jest.advanceTimersByTime(500);
      abortController.abort();
    });

    test('should have no timers', () => expect(jest.getTimerCount()).toBe(0));
    test('should reject', () => expect(() => promise).rejects.toThrow('Aborted.'));
  });
});

describe('abort before sleep for 1s', () => {
  let abortController: AbortController;
  let now: number;
  let promise: Promise<void>;

  beforeEach(() => {
    abortController = new AbortController();
    abortController.abort();
    now = Date.now();
    promise = sleep(1000, { signal: abortController.signal });

    jest.runAllTimers();
  });

  afterEach(() => {
    promise.catch(() => {});
  });

  test('should have no timer', () => expect(jest.getTimerCount()).toBe(0));
  test('should not advance time', () => expect(Date.now()).toBe(now));
  test('should reject', () => expect(() => promise).rejects.toThrow('Aborted.'));
});
