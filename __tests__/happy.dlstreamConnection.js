import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import waitForConnected from './setup/waitForConnected';
import { async } from 'rxjs/scheduler/async';

import {
  ConnectionStatus
} from '../src/directLine.ts';

// TODO: Need more realistic testing.
//       - Able to connect to a Web Socket server
//       - Make sure after `end` is called, the client will not reconnect
//       - If the connection is disrupted, make sure the client will reconnect
//       - Use a fake timer to speed up the test
describe('test dl streaming end', () => {
  let unsubscribes;
  let directLineStreaming;
  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));
  test('using Streaming Extensions', async () => {
    directLineStreaming = await createDirectLine.forStreamingExtensions();
    unsubscribes.push(directLineStreaming.end.bind(directLineStreaming));
    unsubscribes.push(await waitForConnected(directLineStreaming));
    directLineStreaming.end();
    expect(directLineStreaming.connectionStatus$.getValue()).toBe(ConnectionStatus.Ended);
  })
});

describe('test dl streaming reconnect', () => {
  let unsubscribes;
  let directLineStreaming;
  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));
  test('using Streaming Extensions', async () => {
    let errorTimes = 2;

    directLineStreaming = await createDirectLine.forStreamingExtensions();

    let tmpConnect = directLineStreaming.connectAsync;
    directLineStreaming.connectAsync = async function () {
      errorTimes--;
      console.log(`connectAsync errorTimes:${errorTimes}`);
      if (errorTimes >= 0){
        throw new Error("TestErr");
      }
      tmpConnect.call(directLineStreaming);
    }
    directLineStreaming.getRetryDelay = function () {
      return 0;
    }
    unsubscribes.push(directLineStreaming.end.bind(directLineStreaming));
    unsubscribes.push(await waitForConnected(directLineStreaming));

    expect(directLineStreaming.connectionStatus$.getValue()).toBe(ConnectionStatus.Online);
  })
});
