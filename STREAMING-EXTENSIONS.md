# Direct Line Streaming Extensions

This is CONTRIBUTING.md for Direct Line Streaming Extensions.

## Run automated tests

- Clone this repository branch
- `npm ci`
   - Please ignore `node-gyp` errors, it is a warning instead
- `npm test`

> You don't need to run `npm run build`. Jest will rebuild the source code on-the-fly for each test run.

If you want to run tests in watch mode, run `npm test -- --watch`.

## Build development bundle

- Clone this repository
- `npm ci`
- `npm run build`

After build succeeded, you can use the JavaScript bundle at `/dist/directline.js`. This is development build. It is not minified and contains instrumentation code for code coverage.

To use the bundle:

```js
const { DirectLine } = window.DirectLine;

const directLine = new DirectLineStreaming({
  conversationId: '<required>',
  domain: 'https://.../.bot/v3/directline',
  token: '<required>',
  webSocket: true
});

// Start the connection and console-logging every incoming activity
directLine.activity$.subscribe({
  next(activity) { console.log(activity); }
});
```

## CI/CD pipeline

### Build status

For latest build status, navigate to https://travis-ci.org/microsoft/BotFramework-DirectLineJS/branches, and select `ckk/protocoljs` branch.

### Test in Web Chat

The last successful build can be tested with Web Chat and MockBot.

- Navigate to https://compulim.github.io/webchat-loader/
- Click `Dev` or select `<Latest development bit>` from the dropdown list
- Click `[Public] MockBot with Streaming Extensions`
- Click `Open Web Chat in a new window`

Type `help` to MockBot for list of commands.

### Build artifacts

After successful build, artifacts are published to https://github.com/microsoft/BotFramework-DirectLineJS/releases/tag/dev-streamingextensions.

For easier consumption, in the assets, [`directline.js`](https://github.com/microsoft/BotFramework-DirectLineJS/releases/download/dev-streamingextensions/directline.js) is the bundle from last successful build. You can use the HTML code below to use latest DirectLineJS with Web Chat 4.5.2:

```html
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Web Chat with Streaming Extensions</title>
    <script src="https://cdn.botframework.com/botframework-webchat/latest/webchat-es5.js"></script>
    <script src="https://github.com/microsoft/BotFramework-DirectLineJS/releases/download/dev-streamingextensions/directline.js"></script>
    <style type="text/css">
      html, body, body > div { height: 100%; }
      body { margin: 0; }
    </style>
  </head>
  <body>
    <script>
      const { DirectLine } = window.DirectLine;
      const webChatElement = document.createElement('div');

      window.WebChat.renderWebChat({
        directLine: new DirectLine({
          conversationId: '<required>',
          domain: 'https://.../.bot/v3/directline',
          token: '<required>',
          webSocket: true
        })
      }, webChatElement);

      document.body.append(webChatElement);
    </script>
  </body>
</html>
```

### Source code

Run `git checkout dev-streamingextensions` to checkout the source code of the last successful build.
