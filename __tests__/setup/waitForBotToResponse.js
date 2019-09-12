import waitForObservable from './waitForObservable';

export default async function waitForBotToResponse(directLine, predicate) {
  return await waitForObservable(directLine.activity$, activity => predicate(activity));
}
