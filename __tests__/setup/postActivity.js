import updateIn from 'simple-update-in';

import waitForActivity from './waitForActivity';
import waitForObservable from './waitForObservable';

const DEFAULT_USER_ID = 'dl_12345';

export default async function postActivity(directLine, activity) {
  // We need to use channelData.clientActivityId because postActivity could come later than the activity$ observable.
  // Thus, when we receive the activity ID for the "just posted" activity, it might be already too late.

  const targetClientActivityId = Math.random().toString(36).substr(2);

  activity = updateIn(activity, ['from', 'id'], userId => userId || DEFAULT_USER_ID);
  activity = updateIn(activity, ['channelData', 'clientActivityId'], () => targetClientActivityId);

  const [activityId] = await Promise.all([
    waitForObservable(directLine.postActivity(activity), () => true),
    waitForActivity(directLine, ({ channelData: { clientActivityId } = {} }) => clientActivityId === targetClientActivityId)
  ]);

  return activityId;
}
