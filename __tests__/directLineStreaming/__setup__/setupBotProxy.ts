import createBotProxy from './createBotProxy';

type SetupBotProxyInit = Parameters<typeof createBotProxy>[0];
type ValueOfPromise<T> = T extends Promise<infer V> ? V : never;

type CreateBotProxyReturnValue = ValueOfPromise<ReturnType<typeof createBotProxy>>;

let botProxies: CreateBotProxyReturnValue[] = [];

beforeEach(() => {
  botProxies = [];
});

export default async function setupBotProxy(
  init?: SetupBotProxyInit
): Promise<Omit<CreateBotProxyReturnValue, 'cleanUp'>> {
  const botProxy = await createBotProxy(init);

  botProxies.push(botProxy);

  return {
    closeAllNetworkProbingConnections: botProxy.closeAllNetworkProbingConnections,
    closeAllWebSocketConnections: botProxy.closeAllWebSocketConnections,
    directLineURL: botProxy.directLineURL,
    directLineStreamingURL: botProxy.directLineStreamingURL,
    networkProbeURL: botProxy.networkProbeURL,

    get numNetworkProbingConnection() {
      return botProxy.numNetworkProbingConnection;
    },

    get numOverTheLifetimeNetworkProbingConnection() {
      return botProxy.numOverTheLifetimeNetworkProbingConnection;
    }
  };
}

afterEach(() => {
  botProxies.map(botProxy => botProxy.cleanUp());
  botProxies.splice(0);
});
