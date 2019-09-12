import getEchoActivity from './getEchoActivity';
import waitForActivity from './waitForActivity';

export default function waitForBotEcho(directLine, predicate) {
  return waitForActivity(directLine, async activity => {
    const echoActivity = getEchoActivity(activity);

    return echoActivity && await predicate(echoActivity);
  });
}
