import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import fetchAsBase64 from './setup/fetchAsBase64';
import postActivity from './setup/postActivity';
import waitForBotToEcho from './setup/waitForBotToEcho';
import waitForConnected from './setup/waitForConnected';
import waitForBotToRespond from './setup/waitForBotToRespond.js';

describe('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('receive attachments', () => {
    let directLine;

    test('using Streaming Extensions', async () => {
      jest.setTimeout(timeouts.webSocket);
      directLine = await createDirectLine.forStreamingExtensions();
    });

    afterEach(async () => {
      // If directLine object is undefined, that means the test is failing.
      if (!directLine) { return; }

      unsubscribes.push(directLine.end.bind(directLine));
      unsubscribes.push(await waitForConnected(directLine));

      let url1 = 'https://webchat-waterbottle.azurewebsites.net/public/surfacelogo.png';
      let url2 = 'https://webchat-waterbottle.azurewebsites.net/public/xboxlogo.png';

      const activityFromUser = {
        text: 'attach ' + url1 + ' ' + url2,
        type: 'message',
        channelData: {
          testType: "streaming"
        }
      };

      await Promise.all([
        postActivity(directLine, activityFromUser),
        waitForBotToRespond(directLine, async (activity) => {
          if (!activity.channelData){
            return false;
          }
          let attachmentContents1 = await fetchAsBase64(url1);
          let attachmentContents2 = await fetchAsBase64(url2);
          return (activity.attachments.length == 2 &&
             attachmentContents1 == activity.attachments[0].contentUrl.substr(23) &&
             attachmentContents2 == activity.attachments[1].contentUrl.substr(23));
        })
      ]);
    });
  });
});
