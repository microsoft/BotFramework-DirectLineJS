import { userId as DEFAULT_USER_ID } from '../constants.json';
import { DirectLine, DirectLineStreaming } from '../../dist/directline';

const {
  DIRECT_LINE_SECRET,
  STREAMING_EXTENSIONS_DOMAIN = 'https://dljstestbot.azurewebsites.net/.bot/v3/directline'
} = process.env;

const DEFAULT_DOMAIN = 'https://directline.botframework.com/v3/directline';

async function fetchDirectLineToken() {
  const res = await fetch('https://dljstestbot.azurewebsites.net/token/directline');

  if (res.ok) {
    return await res.json();
  } else {
    throw new Error(`Server returned ${ res.status } while fetching Direct Line token`);
  }
}

async function fetchDirectLineStreamingExtensionsToken() {
  const res = await fetch(`https://dljstestbot.azurewebsites.net/token/directlinease`);

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

export async function forREST({ token } = {}, mergeOptions = {}) {
  let options = { webSocket: false };

  if (token && DIRECT_LINE_SECRET) {
    options = { ...options, token: (await generateDirectLineToken()).token };
  } else if (token) {
    // Probably via PR validation on Travis, or run by a contributing developer.
    // We still want to let the developer to test majority of stuff without deploying their own bot server.
    options = { ...options, token: (await fetchDirectLineToken()).token };
  } else if (DIRECT_LINE_SECRET) {
    options = { ...options, secret: DIRECT_LINE_SECRET };
  } else {
    return console.warn('Tests using secret are skipped because DIRECT_LINE_SECRET environment variable is not defined.');
  }

  return new DirectLine({ ...options, ...mergeOptions });
}

export async function forStreamingExtensions(mergeOptions = {}) {
  const { conversationId, token } = DIRECT_LINE_SECRET ?
    await generateDirectLineToken(STREAMING_EXTENSIONS_DOMAIN)
  :
    await fetchDirectLineStreamingExtensionsToken();

  return new DirectLineStreaming({
    conversationId,
    domain: STREAMING_EXTENSIONS_DOMAIN,
    token,
    webSocket: true,
    ...mergeOptions
  });
}

export async function forWebSocket({ token } = {}, mergeOptions = {}) {
  return await forREST(
    { token },
    {
      webSocket: true,
      ...mergeOptions
    }
  );
}
