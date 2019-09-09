import waitForObservable from './waitForObservable';

export default function waitForBotRespond(directLine, equalityFn) {
  return waitForObservable(directLine.activity$, activity => equalityFn(activity));
}
