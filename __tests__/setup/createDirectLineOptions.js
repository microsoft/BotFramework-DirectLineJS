import fetch from 'node-fetch';

const {
  DEFAULT_USER_ID = 'u-12345',
  DIRECT_LINE_SECRET,
  // STREAMING_EXTENSIONS_DOMAIN = 'http://localhost:5002/.bot/v3/directline'
  STREAMING_EXTENSIONS_DOMAIN = 'https://webchat-waterbottle.azurewebsites.net/.bot/v3/directline'
} = process.env;

const DEFAULT_DOMAIN = 'https://directline.botframework.com/v3/directline';

async function generateDirectLineToken(domain = DEFAULT_DOMAIN) {
  let cres;

  cres = await fetch(`${ domain }/tokens/generate`, {
    body: JSON.stringify({ User: { Id: DEFAULT_USER_ID } }),
    headers: {
      authorization: `Bearer ${ DIRECT_LINE_SECRET }`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (cres.status === 200) {
    const json = await cres.json();

    if ('error' in json) {
      throw new Error(`Direct Line service responded ${ JSON.stringify(json.error) } while generating new token`);
    } else {
      return json;
    }
  } else {
    throw new Error(`Direct Line service returned ${ cres.status } while generating new token`);
  }
}

export async function forREST({ token } = {}) {
  token = token && (await generateDirectLineToken()).token;

  return {
    ...token ? {} : { secret: DIRECT_LINE_SECRET },
    ...token ? { token } : {},
    webSocket: false
  };
}

export async function forStreamingExtensions() {
  const { conversationId, token } = (await generateDirectLineToken(STREAMING_EXTENSIONS_DOMAIN));

  return {
    conversationId,
    domain: STREAMING_EXTENSIONS_DOMAIN,
    streamingWebSocket: true,
    token,
    webSocket: true
  };
}

export async function forWebSocket({ token } = {}) {
  token = token && (await generateDirectLineToken()).token;

  return {
    ...token ? {} : { secret: DIRECT_LINE_SECRET },
    ...token ? { token } : {},
    webSocket: true
  };
}
