require('global-agent/bootstrap');

// To use proxy, SET GLOBAL_AGENT_HTTP_PROXY=http://localhost:8888

const JSDOMEnvironment = require('jest-environment-jsdom').TestEnvironment;

class JSDOMEnvironmentWithProxy extends JSDOMEnvironment {
  setup() {
    if (process.env.GLOBAL_AGENT_HTTP_PROXY) {
      const { ResourceLoader } = require('jsdom');
      const resources = new ResourceLoader({ strictSSL: false });

      // HACK: We cannot set ResourceLoader thru testEnvironmentOptions.resources.
      //       This is because the ResourceLoader instance constructor is of "slightly" different type when on runtime (probably Jest magic).
      //       Thus, when we set it thru testEnvironmentOptions.resources, it will fail on "--watch" but succeed when running without watch.
      this.global._resourceLoader = resources;
    }

    // Make native fetch and Fetch API globals available in jsdom environment
    // Required for nock v14+ which uses @mswjs/interceptors
    this.global.fetch = fetch;
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;

    // Streams API globals
    if (typeof ReadableStream !== 'undefined') {
      this.global.ReadableStream = ReadableStream;
    }
    if (typeof WritableStream !== 'undefined') {
      this.global.WritableStream = WritableStream;
    }
    if (typeof TransformStream !== 'undefined') {
      this.global.TransformStream = TransformStream;
    }

    return super.setup();
  }
}

module.exports = JSDOMEnvironmentWithProxy;
