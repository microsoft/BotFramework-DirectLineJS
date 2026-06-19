/**
 * Tests for leak fixes in DirectLineStreaming after end() is called.
 *
 * Covers:
 * 1. sleep() resolves immediately when end() is called (abort signal)
 * 2. refreshToken() exits early when end() is called (before and after sleep)
 * 3. refreshToken() returns after fatal 403 instead of continuing the loop
 * 4. connectWithRetryAsync() retry delay is cancellable via end()
 * 5. waitUntilOnline() unsubscribes from connectionStatus$ on resolve/reject
 */

import { ConnectionStatus } from './directLine';

// We need to capture the WebSocketClient instances to control them in tests.
let mockWebSocketClientInstances: MockWebSocketClient[] = [];

class MockWebSocketClient {
  #disconnectionHandler: ((reason?: string) => void) | undefined;
  #connectResolve: (() => void) | undefined;
  #connectReject: ((err: Error) => void) | undefined;

  connect: jest.Mock;
  disconnect: jest.Mock;
  send: jest.Mock;

  constructor(init: any) {
    this.#disconnectionHandler = init.disconnectionHandler;

    this.connect = jest.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          this.#connectResolve = resolve;
          this.#connectReject = reject;
        })
    );

    this.disconnect = jest.fn(() => {
      this.#disconnectionHandler?.('disconnect() called');
    });

    this.send = jest.fn(async () => ({
      statusCode: 200,
      streams: [
        {
          readAsString: async () =>
            JSON.stringify({ conversationId: 'conv-123' })
        }
      ]
    }));

    mockWebSocketClientInstances.push(this);
  }

  // Test helpers to simulate connection lifecycle.
  __test__resolveConnect() {
    this.#connectResolve?.();
  }

  __test__rejectConnect(err: Error) {
    this.#connectReject?.(err);
  }

  __test__simulateDisconnect(reason?: string) {
    this.#disconnectionHandler?.(reason);
  }
}

jest.mock('./streaming/WebSocketClientWithNetworkInformation', () => ({
  __esModule: true,
  default: function (...args: any[]) {
    return new MockWebSocketClient(args[0]);
  }
}));

// Mock cross-fetch to prevent real network calls.
// jest.mock is hoisted, so we use jest.fn() inline and retrieve it later.
jest.mock('cross-fetch', () => ({
  __esModule: true,
  default: jest.fn()
}));

// Import after mocks.
import { DirectLineStreaming } from './directLineStreaming';
import _mockFetchImport from 'cross-fetch';

const mockFetch = _mockFetchImport as unknown as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  mockWebSocketClientInstances = [];
  mockFetch.mockReset();

  // Default: token refresh returns 200.
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ token: 'new-token' })
  });
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Helper: creates a DirectLineStreaming instance, subscribes to activity$,
 * and drives the connection through to Online state.
 */
async function createAndConnect(): Promise<{
  directLine: DirectLineStreaming;
  client: MockWebSocketClient;
}> {
  const directLine = new DirectLineStreaming({
    domain: 'https://test.bot',
    token: 'test-token'
  });

  // Subscribe to activity$ to kick off the connection.
  directLine.activity$.subscribe({ next() {}, error() {}, complete() {} });

  // Let microtasks flush so connectWithRetryAsync starts.
  await jest.advanceTimersByTimeAsync(0);

  const client = mockWebSocketClientInstances[mockWebSocketClientInstances.length - 1];

  // Simulate successful WebSocket connection.
  client.__test__resolveConnect();
  await jest.advanceTimersByTimeAsync(0);

  return { directLine, client };
}

// ---------------------------------------------------------------------------
// 1. sleep() resolves immediately when _endAbortController is aborted
// ---------------------------------------------------------------------------
describe('sleep() abort on end()', () => {
  test('calling end() during refreshToken sleep should stop the token refresh loop (no dangling timer)', async () => {
    const { directLine, client } = await createAndConnect();

    // At this point, refreshToken() is waiting for waitUntilOnline() which has resolved,
    // and then it sleeps for refreshTokenInterval (15 minutes).
    // Advance only partway through the 15min sleep.
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    // Now call end(). This should abort the sleep immediately.
    directLine.end();

    // Let microtasks complete.
    await jest.advanceTimersByTimeAsync(0);

    // The refresh loop should have exited. No further fetch calls should be made.
    const fetchCallCountAfterEnd = mockFetch.mock.calls.length;

    // Advance time way past when the next refresh would have happened.
    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);

    // No new fetch calls should have been made.
    expect(mockFetch.mock.calls.length).toBe(fetchCallCountAfterEnd);
  });
});

// ---------------------------------------------------------------------------
// 2. refreshToken() exits early when end() is called before/after sleep
// ---------------------------------------------------------------------------
describe('refreshToken() abort checks', () => {
  test('refreshToken should not make fetch calls after end() is called', async () => {
    const { directLine, client } = await createAndConnect();

    // No refresh fetch yet (haven't advanced 15 minutes).
    const fetchCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => typeof url === 'string' && url.includes('/tokens/refresh')
    );
    expect(fetchCalls).toHaveLength(0);

    // Call end().
    directLine.end();
    await jest.advanceTimersByTimeAsync(0);

    // Advance past the refresh interval.
    await jest.advanceTimersByTimeAsync(30 * 60 * 1000);

    // There should be no refresh calls.
    const refreshCallsAfterEnd = mockFetch.mock.calls.filter(
      ([url]: [string]) => typeof url === 'string' && url.includes('/tokens/refresh')
    );
    expect(refreshCallsAfterEnd).toHaveLength(0);
  });

  test('refreshToken should stop after abort even between sleep and fetch', async () => {
    const { directLine, client } = await createAndConnect();

    // Advance to just before the refresh sleep would end.
    await jest.advanceTimersByTimeAsync(15 * 60 * 1000 - 100);

    // Call end() right before the sleep resolves.
    directLine.end();
    await jest.advanceTimersByTimeAsync(0);

    // The sleep resolves immediately due to abort, then the abort check returns.
    // Advance more time.
    await jest.advanceTimersByTimeAsync(30 * 60 * 1000);

    // No token refresh should have been attempted.
    const refreshCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => typeof url === 'string' && url.includes('/tokens/refresh')
    );
    expect(refreshCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. refreshToken() returns after fatal 403
// ---------------------------------------------------------------------------
describe('refreshToken() on fatal 403', () => {
  test('should stop refresh loop and not continue retrying after 403', async () => {
    const { directLine, client } = await createAndConnect();

    // Make the refresh endpoint return 403.
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({})
    });

    // Advance through the first refresh interval.
    await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
    await jest.advanceTimersByTimeAsync(0);

    // The first refresh attempt should have been made and returned 403.
    const refreshCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => typeof url === 'string' && url.includes('/tokens/refresh')
    );
    expect(refreshCalls.length).toBeGreaterThanOrEqual(1);

    const callCountAfter403 = mockFetch.mock.calls.length;

    // Advance far past further refresh intervals.
    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);

    // No more refresh calls should be made (the loop returned after 403).
    expect(mockFetch.mock.calls.length).toBe(callCountAfter403);
  });
});

// ---------------------------------------------------------------------------
// 4. connectWithRetryAsync() retry delay is cancellable via end()
// ---------------------------------------------------------------------------
describe('connectWithRetryAsync() retry sleep cancellation', () => {
  test('calling end() during retry delay should stop reconnection attempts promptly', async () => {
    const { directLine, client } = await createAndConnect();

    // Simulate a disconnect to trigger reconnection retries.
    client.__test__simulateDisconnect('test disconnect');
    await jest.advanceTimersByTimeAsync(0);

    // The first retry should begin after a delay of 3-15 seconds.
    // Advance partway into the retry delay.
    await jest.advanceTimersByTimeAsync(1000);

    // Call end() while waiting for the retry delay.
    directLine.end();
    await jest.advanceTimersByTimeAsync(0);

    // Record the current state after end() has been processed.
    const clientCountAfterEnd = mockWebSocketClientInstances.length;

    // Advance time far past any retry delays.
    await jest.advanceTimersByTimeAsync(60 * 1000);

    // No additional WebSocket clients should have been created after end() settled.
    expect(mockWebSocketClientInstances.length).toBe(clientCountAfterEnd);
  });

  test('calling end() should prevent further reconnection attempts', async () => {
    const { directLine, client } = await createAndConnect();

    // Tick for 1 minute to make the connection "stable" (resets retry count).
    await jest.advanceTimersByTimeAsync(60_000);

    const statusValues: ConnectionStatus[] = [];
    directLine.connectionStatus$.subscribe(s => statusValues.push(s));

    // Simulate disconnect.
    client.__test__simulateDisconnect('test disconnect');
    await jest.advanceTimersByTimeAsync(0);

    // Call end() immediately.
    directLine.end();
    await jest.advanceTimersByTimeAsync(0);

    // Should observe Ended status.
    expect(statusValues).toContain(ConnectionStatus.Ended);

    // Advance time past all possible retries.
    await jest.advanceTimersByTimeAsync(120_000);

    const clientsAfterEnd = mockWebSocketClientInstances.length;

    // No further connection attempts.
    await jest.advanceTimersByTimeAsync(120_000);
    expect(mockWebSocketClientInstances.length).toBe(clientsAfterEnd);
  });
});

// ---------------------------------------------------------------------------
// 5. waitUntilOnline() cleans up subscription
// ---------------------------------------------------------------------------
describe('waitUntilOnline() subscription cleanup', () => {
  test('should unsubscribe from connectionStatus$ after going online (async case)', async () => {
    const directLine = new DirectLineStreaming({
      domain: 'https://test.bot',
      token: 'test-token'
    });

    // Subscribe to activity$ to kick off the connection.
    directLine.activity$.subscribe({ next() {}, error() {}, complete() {} });
    await jest.advanceTimersByTimeAsync(0);

    const client = mockWebSocketClientInstances[mockWebSocketClientInstances.length - 1];

    const observerCountBeforeOnline = (directLine.connectionStatus$ as any).observers.length;

    // Simulate successful connection — this triggers Online and refreshToken's waitUntilOnline resolves.
    client.__test__resolveConnect();
    await jest.advanceTimersByTimeAsync(0);

    // After going Online, the waitUntilOnline() subscription from refreshToken should be cleaned up.
    // Observer count should not have grown (the waitUntilOnline subscription was added then removed).
    const observerCountAfterOnline = (directLine.connectionStatus$ as any).observers.length;
    expect(observerCountAfterOnline).toBeLessThanOrEqual(observerCountBeforeOnline);

    // Clean up.
    directLine.end();
    await jest.advanceTimersByTimeAsync(0);

    // After end(), no observers should remain subscribed (connectionStatus$ completed).
    expect((directLine.connectionStatus$ as any).observers.length).toBe(0);
  });

  test('should unsubscribe from connectionStatus$ when already online (synchronous case)', async () => {
    const { directLine } = await createAndConnect();

    // Status is already Online. Calling waitUntilOnline() will subscribe to a BehaviorSubject
    // that synchronously emits Online. The subscription must still be cleaned up.
    const observerCountBefore = (directLine.connectionStatus$ as any).observers.length;

    // Call waitUntilOnline() via refreshToken indirectly by triggering another refresh cycle.
    // Instead, we can test it more directly: force a second waitUntilOnline by disconnecting
    // and reconnecting, then checking observer count is stable.

    // Disconnect and reconnect to trigger another waitUntilOnline() call in refreshToken.
    const client = mockWebSocketClientInstances[mockWebSocketClientInstances.length - 1];
    client.__test__simulateDisconnect('test');
    await jest.advanceTimersByTimeAsync(0);

    // A new connection attempt is made. Simulate success.
    const newClient = mockWebSocketClientInstances[mockWebSocketClientInstances.length - 1];
    newClient.__test__resolveConnect();
    await jest.advanceTimersByTimeAsync(0);

    // Now we're back Online. A new refreshToken waitUntilOnline() resolved synchronously
    // (status was briefly Connecting, then Online). Observer count should not have grown.
    const observerCountAfterReconnect = (directLine.connectionStatus$ as any).observers.length;
    expect(observerCountAfterReconnect).toBeLessThanOrEqual(observerCountBefore);

    // Clean up.
    directLine.end();
    await jest.advanceTimersByTimeAsync(0);
    expect((directLine.connectionStatus$ as any).observers.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: end() should not leave any pending timers
// ---------------------------------------------------------------------------
describe('end() cleanup integration', () => {
  test('after end(), advancing time should not trigger any activity', async () => {
    const { directLine, client } = await createAndConnect();

    directLine.end();
    await jest.advanceTimersByTimeAsync(0);

    const fetchCountAfterEnd = mockFetch.mock.calls.length;
    const clientCountAfterEnd = mockWebSocketClientInstances.length;

    // Advance time by 2 hours - nothing should happen.
    await jest.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);

    expect(mockFetch.mock.calls.length).toBe(fetchCountAfterEnd);
    expect(mockWebSocketClientInstances.length).toBe(clientCountAfterEnd);
  });
});
