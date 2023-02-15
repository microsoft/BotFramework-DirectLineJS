import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import waitForConnected from './setup/waitForConnected';

describe('test dl streaming end', () => {
  let unsubscribes;
  let directLine;
  const ConnectionStatusEnd = 5;
  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));
  test('using Streaming Extensions', async () => {
    jest.setTimeout(30000);
    directLine = await createDirectLine.forStreamingExtensions();
    unsubscribes.push(directLine.end.bind(directLine));
    unsubscribes.push(await waitForConnected(directLine));
    await new Promise(resolve => setTimeout(resolve, 2000));
    directLine.end();
    expect(directLine.connectionStatus$.getValue()).toBe(ConnectionStatusEnd);
  })
});