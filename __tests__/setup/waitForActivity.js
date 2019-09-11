import waitForObservable from './waitForObservable';

export default function waitForBotRespond(directLine, predicate) {
  return waitForObservable(directLine.activity$, activity => predicate(activity));
}
