import waitForObservable from './waitForObservable';

export default async function waitForBotToRespond(directLine, predicate) {
  return await waitForObservable(directLine.activity$, activity => predicate(activity));
}
