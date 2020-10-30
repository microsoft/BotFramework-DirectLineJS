import { Observable } from 'rxjs/Observable';

import rxjsToAsyncIterable from './setup/rxjsToAsyncIterable';

test('should iterate 3 items', async () => {
  const actual = [];
  const observable = new Observable(observer => {
    observer.next(1);
    observer.next(2);
    observer.next(3);
    observer.complete();
  });

  const iterable = rxjsToAsyncIterable(observable);

  for await (let value of iterable) {
    actual.push(value);
  }

  expect(actual).toEqual([1, 2, 3]);
});

test('should iterate 3 items then reject', async () => {
  const actual = [];
  const observable = new Observable(observer => {
    observer.next(1);
    observer.next(2);
    observer.next(3);
    observer.error(new Error('artificial'));
  });

  const iterable = rxjsToAsyncIterable(observable);

  await expect(
    (async () => {
      for await (let value of iterable) {
        actual.push(value);
      }
    })()
  ).rejects.toThrow('artificial');

  expect(actual).toEqual([1, 2, 3]);
});
