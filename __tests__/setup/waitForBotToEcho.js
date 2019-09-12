import getEchoActivity from './getEchoActivity';
import waitForBotToResponse from './waitForBotToResponse';

export default function waitForBotToEcho(directLine, predicate) {
  return waitForBotToResponse(directLine, async activity => {
    const echoActivity = getEchoActivity(activity);

    return echoActivity && await predicate(echoActivity);
  });
}
