import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import fetchAsBase64 from './setup/fetchAsBase64';
import postActivity from './setup/postActivity';
import waitForBotToEcho from './setup/waitForBotToEcho';
import waitForConnected from './setup/waitForConnected';

jest.setTimeout(10000);

// Skipping because the bot at dljstestbot.azurewebsites.net is not available.
describe.skip('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('upload 2 attachments with text messages', () => {
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

      const activityFromUser = {
        // DirectLine.postActivityWithAttachments support "contentUrl" only but not "content"
        attachments: [{
          contentType: 'image/jpg',
          contentUrl: 'https://webchat-mockbot.azurewebsites.net/public/assets/surface1.jpg'
        }, {
          contentType: 'image/jpg',
          contentUrl: 'https://webchat-mockbot.azurewebsites.net/public/assets/surface2.jpg'
        }],
        text: 'Hello, World!',
        type: 'message',
        channelData: {
          testType: "streaming"
        }
      };

      await Promise.all([
        postActivity(directLine, activityFromUser),
        waitForBotToEcho(directLine, async ({ attachments, text }) => {
          if (text === 'Hello, World!' && attachments) {
            const [expectedContents, actualContents] = await Promise.all([
              Promise.all([
                fetchAsBase64(activityFromUser.attachments[0].contentUrl),
                fetchAsBase64(activityFromUser.attachments[1].contentUrl)
              ]),
            ]);


            let result = ( (expectedContents[0] === attachments[0].contentUrl &&
                            expectedContents[1] === attachments[1].contentUrl) ||
                          (expectedContents[1] === attachments[0].contentUrl &&
                            expectedContents[0] === attachments[1].contentUrl) );

            if (!result) {
              console.warn(attachments[0].contentUrl);
              console.warn(attachments[1].contentUrl);
            }

            return result;
          }
        })
      ]);
    });
  });
});
