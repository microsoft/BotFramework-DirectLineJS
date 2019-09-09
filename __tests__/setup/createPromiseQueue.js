import createDeferred from 'p-defer';

export default function createPromiseQueue() {
  const deferreds = [];
  const queue = [];
  const processOne = () => {
    deferreds.length && queue.length && deferreds.shift().resolve(queue.shift());
  };

  return {
    pop() {
      const deferred = createDeferred();

      deferreds.push(deferred);
      processOne();

      return deferred.promise;
    },
    push(value) {
      queue.push(value);
      processOne();
    }
  };
}
