export default function createPromiseQueue() {
  const resolves = [];
  const stack = [];
  const trigger = () => resolves.length && stack.length && resolves.shift()(stack.shift());

  return {
    push(value) {
      stack.push(value);
      trigger();
    },
    shift() {
      const promise = new Promise(resolve => resolves.push(resolve));

      trigger();

      return promise;
    }
  };
}
