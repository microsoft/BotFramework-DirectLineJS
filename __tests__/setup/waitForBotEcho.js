import getEchoActivity from './getEchoActivity';
import waitForObservable from './waitForObservable';

export default function waitForBotEcho(directLine, predicate) {
  return waitForObservable(directLine.activity$, async activity => {
    const echoActivity = getEchoActivity(activity);

    return echoActivity && await predicate(echoActivity);
  });
}
