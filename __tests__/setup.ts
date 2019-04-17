/// <reference path="../node_modules/@types/jest/index.d.ts" />

import createServer from './setup/createServer';
import fetch from 'node-fetch';

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
