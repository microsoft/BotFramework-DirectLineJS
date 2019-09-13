import getEchoActivity from './getEchoActivity';
import waitForBotToRespond from './waitForBotToRespond';

export default function waitForBotToEcho(directLine, predicate) {
  return waitForBotToRespond(directLine, async activity => {
    const echoActivity = getEchoActivity(activity);

    return echoActivity && await predicate(echoActivity);
  });
}
