const { parse } = require('url');
const HttpsProxyAgent = require('https-proxy-agent');
const JSDOMEnvironment = require('jest-environment-jsdom-fourteen');
const WebSocket = require('ws');

const { HTTP_PROXY } = process.env;

function addProxyToWebSocket(window) {
  if (HTTP_PROXY) {
    const agent = new HttpsProxyAgent({
      ...parse(HTTP_PROXY),
      rejectUnauthorized: false
    });

    window.WebSocket = new Proxy(WebSocket, {
      construct(target, [url, protocols = undefined, options = undefined]) {
        return new target(
          url,
          protocols,
          {
            ...options,
            agent
          }
        );
      }
    });

    // The above line is a HACK until we figure out how to call the following line without errors
    // The following line use jsdom version of WebSocket, which will include cookies

    // this.global.WebSocket = require('jsdom/lib/jsdom/living/generated/WebSocket').createInterface({ window: global }).interface;
  }
}

function addProxyToResourceLoader(window) {
  const { ResourceLoader } = require('jsdom');

  const resources = new ResourceLoader({
    proxy: HTTP_PROXY,
    strictSSL: !HTTP_PROXY
  });

  // HACK: We cannot set ResourceLoader thru testEnvironmentOptions.resources.
  //       This is because the ResourceLoader instance constructor is of "slightly" different type when on runtime (probably Jest magic).
  //       Thus, when we set it thru testEnvironmentOptions.resources, it will fail on "--watch" but succeeded when running without watch.
  window._resourceLoader = resources;
}

class JSDOMEnvironmentWithProxy extends JSDOMEnvironment {
  setup() {
    if (HTTP_PROXY) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    addProxyToWebSocket(this.global);
    addProxyToResourceLoader(this.global);

    return super.setup();
  }
}

module.exports = JSDOMEnvironmentWithProxy;
