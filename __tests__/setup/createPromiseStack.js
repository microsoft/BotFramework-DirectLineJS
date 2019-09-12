export default function createPromiseStack() {
  const resolves = [];
  const stack = [];
  const trigger = () => {
    resolves.length && stack.length && resolves.shift()(stack.shift());
  };

  return {
    pop() {
      const promise = new Promise(resolve => resolves.push(resolve));

      trigger();

      return promise;
    },
    push(value) {
      stack.push(value);
      trigger();
    }
  };
}
