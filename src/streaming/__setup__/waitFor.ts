const DEFAULT_DURATION = 1000;
const DEFAULT_INTERVAL = 50;

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return value && typeof (value as Promise<T>).then === 'function';
}

export default function waitFor<T>(
  fn: () => Promise<T> | T,
  {
    duration,
    interval
  }: {
    duration?: number;
    interval?: number;
  } = {}
): Promise<T> {
  let runInterval: ReturnType<typeof setInterval>;
  let runTimeout: ReturnType<typeof setTimeout>;

  const promise = new Promise<T>((resolve, reject) => {
    let lastError: any;
    let ready = true;

    const run = () => {
      if (!ready) {
        return;
      }

      ready = false;

      let returnValue;

      try {
        returnValue = fn();
      } catch (error) {
        lastError = error;
        ready = true;

        return;
      }

      if (isPromise(returnValue)) {
        returnValue.then(
          result => resolve(result),
          error => {
            lastError = error;
            ready = true;
          }
        );
      } else {
        resolve(returnValue);
      }
    };

    runInterval = setInterval(run, interval || DEFAULT_INTERVAL);

    runTimeout = setTimeout(() => {
      reject(lastError || new Error('timed out'));
    }, duration || DEFAULT_DURATION);

    run();
  }).finally(() => {
    clearInterval(runInterval);
    clearTimeout(runTimeout);
  });

  promise.catch(() => {});

  return promise;
}
