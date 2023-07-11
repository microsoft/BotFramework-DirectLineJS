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
  Required<Observer<T>> & {
    observations: ReadonlyArray<Observation<T>>;
    observe: (observation: Observation<T>) => void;
  }
> {
  const observe: (observation: Observation<T>) => void = jest.fn(observation => observations.push(observation));
  const observations: Array<Observation<T>> = [];

  const complete = jest.fn(() => observe([Date.now(), 'complete']));
  const error = jest.fn(reason => observe([Date.now(), 'error', reason]));
  const next = jest.fn(value => observe([Date.now(), 'next', value]));
  const start = jest.fn(subscription => observe([Date.now(), 'start', subscription]));

  return Object.freeze({
    complete,
    error,
    next,
    observe,
    start,

    get observations() {
      return Object.freeze([...observations]);
    }
  });
}
