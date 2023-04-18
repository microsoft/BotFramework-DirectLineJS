import type { Observer, Subscription } from './types/Observable';

// "error" is actually "any".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Observation<T> =
  | [number, 'complete']
  | [number, 'error', any]
  | [number, 'next', T]
  | [number, 'start', Subscription];

/**
 * Mocks an observer and records all observations.
 */
export default function mockObserver<T>(): Readonly<
  Required<Observer<T>> & { observations: ReadonlyArray<Observation<T>> }
> {
  const observations: Array<Observation<T>> = [];

  const complete = jest.fn(() => observations.push([Date.now(), 'complete']));
  const error = jest.fn(reason => observations.push([Date.now(), 'error', reason]));
  const next = jest.fn(value => observations.push([Date.now(), 'next', value]));
  const start = jest.fn(subscription => observations.push([Date.now(), 'start', subscription]));

  return Object.freeze({
    complete,
    error,
    next,
    start,

    get observations() {
      return Object.freeze([...observations]);
    }
  });
}
