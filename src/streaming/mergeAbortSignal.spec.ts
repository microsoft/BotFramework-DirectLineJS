import mergeAbortSignal from './mergeAbortSignal';

describe('merging 3 abort signals', () => {
  let abortControllers: AbortController[];
  let abortSignal: AbortSignal;
  let handleAbort: jest.Mock<void, []>;

  beforeEach(() => {
    abortControllers = new Array(3).fill(undefined).map(() => new AbortController());
    handleAbort = jest.fn();

    abortSignal = mergeAbortSignal(...abortControllers.map(({ signal }) => signal));
    abortSignal.addEventListener('abort', handleAbort);
  });

  test('should not abort initially', () => expect(abortSignal).toHaveProperty('aborted', false));
  test('should not receive "abort" event initially', () => expect(handleAbort).toBeCalledTimes(0));

  describe.each([
    ['first', 0],
    ['second', 1],
    ['third', 2]
  ])('when %s signal is aborted', (_, index) => {
    beforeEach(() => abortControllers[index].abort());

    test('should abort the signal', () => expect(abortSignal).toHaveProperty('aborted', true));
    test('should receive "abort" event', () => expect(handleAbort).toBeCalledTimes(1));

    describe('when all signals are aborted', () => {
      beforeEach(() => abortControllers.forEach(abortController => abortController.abort()));

      test('should abort the signal', () => expect(abortSignal).toHaveProperty('aborted', true));
      test('should receive "abort" event once', () => expect(handleAbort).toBeCalledTimes(1));
    });
  });
});
