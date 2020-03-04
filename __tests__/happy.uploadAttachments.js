import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { timeouts } from './constants.json';
import * as createDirectLine from './setup/createDirectLine';
import fetchAsBase64 from './setup/fetchAsBase64';
import postActivity from './setup/postActivity';
import waitForBotToEcho from './setup/waitForBotToEcho';
import waitForConnected from './setup/waitForConnected';

describe('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('upload 2 attachments with text messages', () => {
    let directLine;

    describe('using REST', () => {
      beforeEach(() => jest.setTimeout(timeouts.rest));

      test('with secret', async () => {
        directLine = await createDirectLine.forREST({ token: false });
      });

      test('with token', async () => {
        directLine = await createDirectLine.forREST({ token: true });
      });
    });

    describe('using Web Socket', () => {
      beforeEach(() => jest.setTimeout(timeouts.webSocket));

      test('with secret', async () => {
        directLine = await createDirectLine.forWebSocket({ token: false });
      });

      test('with token', async () => {
        directLine = await createDirectLine.forWebSocket({ token: false });
      });
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
          contentUrl: 'http://myasebot.azurewebsites.net/177KB.jpg',
          thumbnailUrl: 'data:image/png;base64,===177KB.jpg'
        }, {
          contentType: 'image/png',
          contentUrl: 'http://myasebot.azurewebsites.net/100KB.jpg',
          thumbnailUrl: 'data:image/png;base64,===100KB.jpb'
        }],
        text: 'Hello, World!',
        type: 'message'
      };

      await Promise.all([
        postActivity(directLine, activityFromUser),
        waitForBotToEcho(directLine, async ({ attachments, text }) => {
          if (text === 'Hello, World!') {
            // Bug #194 is causing trouble on the order of attachments sent.
            // https://github.com/microsoft/BotFramework-DirectLineJS/issues/194

            // Until the bug is fixed, we will not check the order.

            const [expectedContents, actualContents] = await Promise.all([
              Promise.all([
                fetchAsBase64(activityFromUser.attachments[0].contentUrl),
                fetchAsBase64(activityFromUser.attachments[1].contentUrl)
              ]),
              Promise.all([
                fetchAsBase64(attachments[0].contentUrl),
                fetchAsBase64(attachments[1].contentUrl)
              ])
            ]);

            const actualThumbnailUrls = attachments.map(({ thumbnailUrl }) => thumbnailUrl);

            return (
              attachments[0] !== attachments[1]
              && actualContents.includes(expectedContents[0])
              && actualContents.includes(expectedContents[1])
              && actualThumbnailUrls.includes(activityFromUser.attachments[0].thumbnailUrl)
              && actualThumbnailUrls.includes(activityFromUser.attachments[1].thumbnailUrl)
            );

            // Use the commented code below after bug #194 is fixed.
            // https://github.com/microsoft/BotFramework-DirectLineJS/issues/194

            // return (
            //   await fetchAsBase64(attachments[0].contentUrl) === await fetchAsBase64(activityFromUser.attachments[0].contentUrl)
            //   && await fetchAsBase64(attachments[1].contentUrl) === await fetchAsBase64(activityFromUser.attachments[1].contentUrl)
            //   && attachments[0].thumbnailUrl === activityFromUser.attachments[0].thumbnailUrl
            //   && attachments[1].thumbnailUrl === activityFromUser.attachments[1].thumbnailUrl
            // );
          }
        })
      ]);
    });
  });
});
