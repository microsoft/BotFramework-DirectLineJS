import createBotProxy from './createBotProxy';

type SetupProxyInit = Parameters<typeof createBotProxy>[0];
type ValueOfPromise<T> = T extends Promise<infer V> ? V : never;

type BotProxyReturnValue = ValueOfPromise<ReturnType<typeof createBotProxy>>;

let botProxies: BotProxyReturnValue[] = [];

beforeEach(() => {
  botProxies = [];
});

export default async function setupProxy(init?: SetupProxyInit) {
  const botProxy = await createBotProxy(init);

  botProxies.push(botProxy);

  return botProxy;
}

afterEach(() => {
  botProxies.map(botProxy => botProxy.close());
  botProxies.splice(0);
});
