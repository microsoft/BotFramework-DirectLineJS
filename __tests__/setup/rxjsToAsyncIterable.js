import createDeferred from 'p-defer';

export default function rxjsToAsyncIterable(observable) {
  return {
    [Symbol.asyncIterator]() {
      const queue = [];
      let deferred = createDeferred();

      observable.subscribe(
        value => {
          queue.push({ value });
          deferred.resolve();
          deferred = createDeferred();
        },
        error => queue.push({ error }),
        () => queue.push({ complete: 1 })
      );

      return {
        async next() {
          queue.length || (await deferred.promise);

          const { complete, error, value } = queue.shift();

          if (complete) {
            return { done: true };
          } else if (error) {
            return Promise.reject(error);
          } else {
            return { done: false, value };
          }
        }
      };
    }
  };
}
