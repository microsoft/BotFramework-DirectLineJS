import 'dotenv/config';

import onErrorResumeNext from 'on-error-resume-next';

import { DirectLine } from '../src/directLine';
import { timeouts } from './constants.json';
import * as createDirectLineOptions from './setup/createDirectLineOptions';
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
        directLine = new DirectLine(await createDirectLineOptions.forREST({ token: false }));
      });

      test('with token', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forREST({ token: true }));
      });
    });

    // test('using Streaming Extensions', async () => {
    //   jest.setTimeout(timeouts.webSocket);
    //   directLine = new DirectLine(await createDirectLineOptions.forStreamingExtensions());
    // });

    describe('using Web Socket', () => {
      beforeEach(() => jest.setTimeout(timeouts.webSocket));

      test('with secret', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forWebSocket({ token: false }));
      });

      test('with token', async () => {
        directLine = new DirectLine(await createDirectLineOptions.forWebSocket({ token: false }));
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
          contentType: 'image/png',
          contentUrl: 'https://webchat-waterbottle.azurewebsites.net/public/surfacelogo.png'
        }, {
          contentType: 'image/png',
          contentUrl: 'https://webchat-waterbottle.azurewebsites.net/public/xboxlogo.png'
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

            const [expecteds, actuals] = await Promise.all([
              Promise.all([
                fetchAsBase64(activityFromUser.attachments[0].contentUrl),
                fetchAsBase64(activityFromUser.attachments[1].contentUrl)
              ]),
              Promise.all([
                fetchAsBase64(attachments[0].contentUrl),
                fetchAsBase64(attachments[1].contentUrl)
              ])
            ]);

            expect(attachments[0]).not.toBe(attachments[1]);
            expect(~actuals.indexOf(expecteds[0])).toBeTruthy();
            expect(~actuals.indexOf(expecteds[1])).toBeTruthy();

            // Use the commented code below after bug #194 is fixed.
            // https://github.com/microsoft/BotFramework-DirectLineJS/issues/194

            // await expect(fetchAsBase64(attachments[0].contentUrl)).resolves.toBe(await fetchAsBase64(activityFromUser.attachments[0].contentUrl));
            // await expect(fetchAsBase64(attachments[1].contentUrl)).resolves.toBe(await fetchAsBase64(activityFromUser.attachments[1].contentUrl));

            return true;
          }
        })
      ]);
    });
  });
});
