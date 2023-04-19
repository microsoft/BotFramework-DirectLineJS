import createBotProxy from './createBotProxy';

type SetupBotProxyInit = Parameters<typeof createBotProxy>[0];
type ValueOfPromise<T> = T extends Promise<infer V> ? V : never;

type BotProxyReturnValue = ValueOfPromise<ReturnType<typeof createBotProxy>>;

let botProxies: BotProxyReturnValue[] = [];

beforeEach(() => {
  botProxies = [];
});

export default async function setupBotProxy(init?: SetupBotProxyInit) {
  const botProxy = await createBotProxy(init);

  botProxies.push(botProxy);

  return botProxy;
}

afterEach(() => {
  botProxies.map(botProxy => botProxy.close());
  botProxies.splice(0);
});
