import getEchoActivity from './getEchoActivity';
import waitForObservable from './waitForObservable';

export default function waitForBotEcho(directLine, equalityFn) {
  return waitForObservable(directLine.activity$, activity => {
    const echoActivity = getEchoActivity(activity);

    return echoActivity && equalityFn(echoActivity);
  });
}
