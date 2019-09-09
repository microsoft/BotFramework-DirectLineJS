import updateIn from 'simple-update-in';

import waitForActivity from './waitForActivity';
import waitForObservable from './waitForObservable';

const DEFAULT_USER_ID = 'u-12345';

export default async function postActivity(directLine, activity) {
  const activityId = await waitForObservable(
    directLine.postActivity(
      updateIn(activity, ['from', 'id'], userId => userId || DEFAULT_USER_ID)
    ),
    () => true
  );

  await waitForActivity(directLine, ({ id }) => id === activityId);
}
