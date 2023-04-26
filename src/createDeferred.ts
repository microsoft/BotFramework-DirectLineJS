type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: any) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  const deferred: Partial<Deferred<T>> = {};

  deferred.promise = new Promise((resolve, reject) => {
    deferred.reject = reject;
    deferred.resolve = resolve;
  });

  return deferred as Deferred<T>;
}

export default createDeferred;
export type { Deferred };
