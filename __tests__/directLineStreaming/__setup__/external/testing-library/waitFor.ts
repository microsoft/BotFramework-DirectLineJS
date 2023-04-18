// Adopted from @testing-library/dom and removed dependencies on DOM.
// https://github.com/testing-library/dom-testing-library/blob/eadf7485430968df8d1e1293535d78cdbeea20a5/src/wait-for.js

// The code essentially do a few things:
// - Set a timer to stop everything after timeout (1000 ms)
// - Run fn()
//    - If fn() resolves, finish
//    - If fn() rejects, do nothing
// - For every interval (50 ms), check the result of fn()
//    - Assert no one toggled between Jest real/fake timers
//    - Advance Jest fake timer
//    - Check result of fn(), if it recently rejected, run it again

import jestFakeTimersAreEnabled from './jestFakeTimersAreEnabled';

const DEFAULT_INTERVAL = 50;
const DEFAULT_TIMEOUT = 1000;

const globalSetInterval = setInterval;
const globalSetTimeout = setTimeout;

type WaitForCallback = () => Promise<void> | void;

type WaitForInit = {
  interval?: number;
  onTimeout?: (error: Error) => Error;
  showOriginalStackTrace?: boolean;
  timeout?: number;
};

type InternalWaitForInit = WaitForInit & {
  stackTraceError: Error;
};

// This is so the stack trace the developer sees is one that's
// closer to their code (because async stack traces are hard to follow).
function copyStackTrace(target, source) {
  target.stack = source.stack.replace(source.message, target.message);
}

function waitFor(
  callback: WaitForCallback,
  {
    interval = DEFAULT_INTERVAL,
    onTimeout = error => error,
    showOriginalStackTrace = false,
    stackTraceError,
    timeout = DEFAULT_TIMEOUT
  }: InternalWaitForInit
): Promise<void> {
  if (typeof callback !== 'function') {
    throw new TypeError('Received `callback` arg must be a function');
  }

  return new Promise(async (resolve, reject) => {
    let lastError: unknown;
    let intervalId: ReturnType<typeof setInterval>;
    let finished = false;
    let promiseStatus = 'idle';

    const overallTimeoutTimer = globalSetTimeout(handleTimeout, timeout);

    const usingJestFakeTimers = jestFakeTimersAreEnabled();

    if (usingJestFakeTimers) {
      checkCallback();

      // this is a dangerous rule to disable because it could lead to an
      // infinite loop. However, eslint isn't smart enough to know that we're
      // setting finished inside `onDone` which will be called when we're done
      // waiting or when we've timed out.
      // eslint-disable-next-line no-unmodified-loop-condition
      while (!finished) {
        if (!jestFakeTimersAreEnabled()) {
          const error = new Error(
            `Changed from using fake timers to real timers while using waitFor. This is not allowed and will result in very strange behavior. Please ensure you're awaiting all async things your test is doing before changing to real timers. For more info, please go to https://github.com/testing-library/dom-testing-library/issues/830`
          );

          if (!showOriginalStackTrace) {
            copyStackTrace(error, stackTraceError);
          }

          reject(error);

          return;
        }

        // we *could* (maybe should?) use `advanceTimersToNextTimer` but it's
        // possible that could make this loop go on forever if someone is using
        // third party code that's setting up recursive timers so rapidly that
        // the user's timer's don't get a chance to resolve. So we'll advance
        // by an interval instead. (We have a test for this case).
        jest.advanceTimersByTime(interval);

        // It's really important that checkCallback is run *before* we flush
        // in-flight promises. To be honest, I'm not sure why, and I can't quite
        // think of a way to reproduce the problem in a test, but I spent
        // an entire day banging my head against a wall on this.
        checkCallback();

        if (finished) {
          break;
        }

        // In this rare case, we *need* to wait for in-flight promises
        // to resolve before continuing. We don't need to take advantage
        // of parallelization so we're fine.
        // https://stackoverflow.com/a/59243586/971592
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => {
          globalSetTimeout(r, 0);

          jest.advanceTimersByTime(0);
        });
      }
    } else {
      intervalId = globalSetInterval(checkRealTimersCallback, interval);

      checkCallback();
    }

    function onDone(error, result) {
      finished = true;

      clearTimeout(overallTimeoutTimer);

      if (!usingJestFakeTimers) {
        clearInterval(intervalId);
      }

      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    }

    function checkRealTimersCallback() {
      if (jestFakeTimersAreEnabled()) {
        const error = new Error(
          `Changed from using real timers to fake timers while using waitFor. This is not allowed and will result in very strange behavior. Please ensure you're awaiting all async things your test is doing before changing to fake timers. For more info, please go to https://github.com/testing-library/dom-testing-library/issues/830`
        );

        if (!showOriginalStackTrace) {
          copyStackTrace(error, stackTraceError);
        }

        return reject(error);
      } else {
        return checkCallback();
      }
    }

    function checkCallback() {
      if (promiseStatus === 'pending') {
        return;
      }

      try {
        const result = callback();

        if (typeof result?.then === 'function') {
          promiseStatus = 'pending';

          result.then(
            resolvedValue => {
              promiseStatus = 'resolved';

              onDone(null, resolvedValue);
            },
            rejectedValue => {
              promiseStatus = 'rejected';
              lastError = rejectedValue;
            }
          );
        } else {
          onDone(null, result);
        }
        // If `callback` throws, wait for the next mutation, interval, or timeout.
      } catch (error) {
        // Save the most recent callback error to reject the promise with it in the event of a timeout
        lastError = error;
      }
    }

    function handleTimeout() {
      let error;

      if (lastError) {
        error = lastError;

        if (!showOriginalStackTrace) {
          copyStackTrace(error, stackTraceError);
        }
      } else {
        error = new Error('Timed out in waitFor.');

        if (!showOriginalStackTrace) {
          copyStackTrace(error, stackTraceError);
        }
      }

      onDone(onTimeout(error), null);
    }
  });
}

function waitForWrapper(callback: WaitForCallback, options?: WaitForInit): Promise<void> {
  // create the error here so its stack trace is as close to the
  // calling code as possible
  const stackTraceError = new Error('STACK_TRACE_MESSAGE');

  return waitFor(callback, { stackTraceError, ...options });
}

export default waitForWrapper;

/*
eslint
  max-lines-per-function: ["error", {"max": 200}],
*/
