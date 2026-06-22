/** @jest-environment ./__tests__/setup/jsdomEnvironmentWithProxy */

/// <reference path="../node_modules/@types/jest/index.d.ts" />

import createServer from './setup/createServer';

test('setup correctly', () => {});

test('createServer setup correctly', async () => {
  const { dispose, port } = await createServer({
    playbacks: [{
      req: { url: '/health.txt' },
      res: { body: 'OK' }
    }]
  });

  try {
    const res = await fetch(`http://localhost:${ port }/health.txt`, {});

    expect(res).toHaveProperty('ok', true);
  } finally {
    dispose();
  }
});

test('test environment has Web Cryptography API', () => {
  expect(typeof global.crypto.getRandomValues).toBe('function');
});
