import fetch from 'node-fetch';

import { DirectLine } from '../../src/directLine';

const {
  DEFAULT_USER_ID = 'dl_12345',
  DIRECT_LINE_SECRET,
  STREAMING_EXTENSIONS_DOMAIN = 'https://webchat-waterbottle.azurewebsites.net/.bot/v3/directline'
} = process.env;

const DEFAULT_DOMAIN = 'https://directline.botframework.com/v3/directline';

async function fetchDirectLineToken() {
  const res = await fetch('https://webchat-waterbottle.azurewebsites.net/token/directline');

  if (res.ok) {
    return await res.json();
  } else {
    throw new Error(`Server returned ${ res.status } while fetching Direct Line token`);
  }
}

async function fetchDirectLineStreamingExtensionsToken() {
  const res = await fetch(`${ STREAMING_EXTENSIONS_DOMAIN }/token/directline`);

  if (res.ok) {
    return await res.json();
  } else {
    throw new Error(`Server returned ${ res.status } while fetching Direct Line token`);
  }
}

async function generateDirectLineToken(domain = DEFAULT_DOMAIN) {
  let res;

  res = await fetch(`${ domain }/tokens/generate`, {
    body: JSON.stringify({ User: { Id: DEFAULT_USER_ID } }),
    headers: {
      authorization: `Bearer ${ DIRECT_LINE_SECRET }`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (res.status === 200) {
    const json = await res.json();

    if ('error' in json) {
      throw new Error(`Direct Line service responded with ${ JSON.stringify(json.error) } while generating a new token`);
    } else {
      return json;
    }
  } else {
    throw new Error(`Direct Line service returned ${ res.status } while generating a new token`);
  }
}

export async function forREST({ token } = {}, directLineOptions = {}) {
  if (token || DIRECT_LINE_SECRET) {
    return new DirectLine({
      ...token ?
        DIRECT_LINE_SECRET ?
          { token: (await generateDirectLineToken()).token }
        :
          { token: (await fetchDirectLineToken()).token }
      :
        { secret: DIRECT_LINE_SECRET },
      webSocket: false,
      ...directLineOptions
    });
  } else {
    console.warn('Tests using secret are skipped because DIRECT_LINE_SECRET environment variable is not defined.');
  }
}

export async function forStreamingExtensions(directLineOptions = {}) {
  const { conversationId, token } = DIRECT_LINE_SECRET ?
    await generateDirectLineToken(STREAMING_EXTENSIONS_DOMAIN)
  :
    await fetchDirectLineStreamingExtensionsToken();

  return new DirectLine({
    conversationId,
    domain: STREAMING_EXTENSIONS_DOMAIN,
    streamingWebSocket: true,
    token,
    webSocket: true,
    ...directLineOptions
  });
}

export async function forWebSocket({ token } = {}, directLineOptions = {}) {
  if (token || DIRECT_LINE_SECRET) {
    return new DirectLine({
      ...token ?
        DIRECT_LINE_SECRET ?
          { token: (await generateDirectLineToken()).token }
        :
          { token: (await fetchDirectLineToken()).token }
      :
        { secret: DIRECT_LINE_SECRET },
      webSocket: true,
      ...directLineOptions
    });
  } else {
    console.warn('Tests using secret are skipped because DIRECT_LINE_SECRET environment variable is not defined.');
  }
}
