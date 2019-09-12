import waitForObservable from './waitForObservable';

export default async function waitForBotRespond(directLine, predicate) {
  return await waitForObservable(directLine.activity$, activity => await predicate(activity));
}
