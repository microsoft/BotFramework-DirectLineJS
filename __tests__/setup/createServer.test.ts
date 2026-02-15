
import createServer from './createServer';
import hasResolved from 'has-resolved';

test('GET /once.txt should return 200 OK', async () => {
  const { dispose, port, promises } = await createServer({
    playbacks: [{
      req: { method: 'GET', url: '/once.txt' },
      res: { body: 'OK' }
    }]
  });

  try {
    const res1 = await fetch(`http://localhost:${ port }/once.txt`, undefined);

    expect(res1).toHaveProperty('ok', true);
    expect(await hasResolved(promises[0])).toBeTruthy();

    const res2 = await fetch(`http://localhost:${ port }/once.txt`, undefined);

    expect(res2).toHaveProperty('status', 404);
  } finally {
    dispose();
  }
});

test('OPTIONS /once.txt should keep return 200 OK until GET /once.txt', async () => {
  const { dispose, port, promises } = await createServer({
    playbacks: [{
      req: { method: 'GET', url: '/once.txt' },
      res: { body: 'OK' }
    }]
  });

  try {
    const res1 = await fetch(`http://localhost:${ port }/once.txt`, { method: 'OPTIONS' });

    expect(res1).toHaveProperty('ok', true);
    expect(await hasResolved(promises[0])).toBeFalsy();

    const res2 = await fetch(`http://localhost:${ port }/once.txt`, { method: 'OPTIONS' });

    expect(res2).toHaveProperty('ok', true);
    expect(await hasResolved(promises[0])).toBeFalsy();

    const res3 = await fetch(`http://localhost:${ port }/once.txt`, undefined);

    expect(res3).toHaveProperty('ok', true);
    expect(await hasResolved(promises[0])).toBeTruthy();

    const res4 = await fetch(`http://localhost:${ port }/once.txt`, { method: 'OPTIONS' });

    expect(res4).toHaveProperty('status', 404);
    expect(await hasResolved(promises[0])).toBeTruthy();
  } finally {
    dispose();
  }
});

test('GET should succeed with a strict ordered sequence', async () => {
  const { dispose, port, promises } = await createServer({
    playbacks: [{
      req: { method: 'GET', url: '/1.txt' },
      res: { body: '1' }
    }, {
      req: { method: 'GET', url: '/2.txt' },
      res: { body: '2' }
    }]
  });

  try {
    const res1 = await fetch(`http://localhost:${ port }/1.txt`, undefined);

    expect(res1).toHaveProperty('ok', true);
    expect(await res1.text()).toBe('1');
    expect(await hasResolved(promises[0])).toBeTruthy();
    expect(await hasResolved(promises[1])).toBeFalsy();

    const res2 = await fetch(`http://localhost:${ port }/2.txt`, undefined);

    expect(res2).toHaveProperty('ok', true);
    expect(await res2.text()).toBe('2');
    expect(await hasResolved(promises[0])).toBeTruthy();
    expect(await hasResolved(promises[1])).toBeTruthy();

    const res3 = await fetch(`http://localhost:${ port }/1.txt`, undefined);

    expect(res3).toHaveProperty('status', 404);
  } finally {
    dispose();
  }
});

test('GET should fail if out-of-order', async () => {
  const { dispose, port, promises } = await createServer({
    playbacks: [{
      req: { method: 'GET', url: '/1.txt' },
      res: { body: '1' }
    }, {
      req: { method: 'GET', url: '/2.txt' },
      res: { body: '2' }
    }]
  });

  try {
    const res1 = await fetch(`http://localhost:${ port }/2.txt`, undefined);

    expect(res1).toHaveProperty('status', 404);
    expect(await hasResolved(promises[0])).toBeFalsy();
    expect(await hasResolved(promises[1])).toBeFalsy();

    const res2 = await fetch(`http://localhost:${ port }/1.txt`, undefined);

    expect(res2).toHaveProperty('ok', true);
    expect(await hasResolved(promises[0])).toBeTruthy();
    expect(await hasResolved(promises[1])).toBeFalsy();

    const res3 = await fetch(`http://localhost:${ port }/2.txt`, undefined);

    expect(res3).toHaveProperty('ok', true);
    expect(await hasResolved(promises[0])).toBeTruthy();
    expect(await hasResolved(promises[1])).toBeTruthy();

    const res4 = await fetch(`http://localhost:${ port }/2.txt`, undefined);

    expect(res4).toHaveProperty('status', 404);
  } finally {
    dispose();
  }
});

test('GET unordered requests', async () => {
  const { dispose, port, promises } = await createServer({
    playbacks: [
      [
        {
          req: { method: 'GET', url: '/1a.txt' },
          res: { body: '1a' }
        }, {
          req: { method: 'GET', url: '/1b.txt' },
          res: { body: '1b' }
        }
      ],
      {
        req: { method: 'GET', url: '/2.txt' },
        res: { body: '2' }
      }
    ]
  });

  try {
    // 404: We must get either 1a or 1b first
    const res1 = await fetch(`http://localhost:${ port }/2.txt`, undefined);

    expect(res1).toHaveProperty('status', 404);
    expect(await hasResolved(promises[1])).toBeFalsy();

    // 200: We get either 1a or 1b
    const res2 = await fetch(`http://localhost:${ port }/1b.txt`, undefined);

    expect(res2).toHaveProperty('ok', true);
    expect(await hasResolved(promises[0][0])).toBeFalsy();
    expect(await hasResolved(promises[0][1])).toBeTruthy();

    // 404: We must get 1a first
    const res3 = await fetch(`http://localhost:${ port }/2.txt`, undefined);

    expect(res3).toHaveProperty('status', 404);

    // 200: We got 1a
    const res4 = await fetch(`http://localhost:${ port }/1a.txt`, undefined);

    expect(res4).toHaveProperty('ok', true);
    expect(await hasResolved(promises[0][0])).toBeTruthy();
    expect(await hasResolved(promises[0][1])).toBeTruthy();

    // 200: We got 2
    const res5 = await fetch(`http://localhost:${ port }/2.txt`, undefined);

    expect(res5).toHaveProperty('ok', true);
    expect(await hasResolved(promises[1])).toBeTruthy();

    // 404: Playbacks is finished
    const res6 = await fetch(`http://localhost:${ port }/2.txt`, undefined);

    expect(res6).toHaveProperty('status', 404);
  } finally {
    dispose();
  }
});
