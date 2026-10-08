import test from 'node:test';
import assert from 'node:assert/strict';
const { RemoteStore, RemoteError } = await import('../src/lib/data/remote-store.ts');

const state = { players: [], events: [], casts: [] };
const context = id => ({ id: () => id, now: () => '2026-10-08T12:00:00.000Z' });
const response = (version, extra = {}) => Response.json({ state, version, result: {}, ...extra });
const flush = () => new Promise(resolve => setImmediate(resolve));
function storage(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } } });
  t.after(() => original ? Object.defineProperty(globalThis, 'window', original) : delete globalThis.window);
  return values;
}

test('an immediate first action waits for registration and uses its new device token', async t => {
  storage(t);
  const requests = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (requests.length === 1) { await gate; return response(2, { deviceToken: 'new-player-token' }); }
    return response(3);
  });
  const store = new RemoteStore('our-group');
  const registered = store.dispatch({ type: 'addPlayer', name: 'Alice', characterId: 'skater' }, context('alice'), { pin: '2468' });
  const action = store.dispatch({ type: 'addEvent', playerId: 'alice', kind: 'candidature' }, context('first-application'));
  try {
    await flush();
    assert.equal(requests.length, 1, 'the first application must not reach the server before the token arrives');
  } finally { release(); await Promise.all([registered, action]); }
  assert.equal(requests[1].headers['x-player-token'], 'new-player-token');
  assert.equal(requests[1].body.context.id, 'first-application');
  assert.equal(requests[0].body.pin, '2468');
});

test('mutation bursts reach the server in order with their original ids and times', async t => {
  storage(t);
  const sent = [];
  let active = 0, peak = 0, clock = '2026-10-08T12:00:00.000Z';
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    active++; peak = Math.max(peak, active);
    sent.push(JSON.parse(init.body));
    await flush();
    active--;
    return response(sent.length);
  });
  const store = new RemoteStore('our-group');
  const calls = [1, 2, 3].map(i => store.dispatch({ type: 'addEvent', playerId: 'alice', kind: 'refus' }, { id: () => `event-${i}`, now: () => clock }));
  clock = '2026-10-08T12:15:00.000Z';
  await Promise.all(calls);
  assert.equal(peak, 1, 'a slower earlier response cannot overtake a later mutation');
  assert.deepEqual(sent.map(item => item.context.id), ['event-1', 'event-2', 'event-3']);
  assert.ok(sent.every(item => item.context.now === '2026-10-08T12:00:00.000Z'));
});

test('a rejected mutation reports its own error and does not block later requests', async t => {
  storage(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? Response.json({ error: 'Action refusée' }, { status: 403 }) : response(3));
  const store = new RemoteStore('our-group');
  const outcomes = await Promise.allSettled([
    store.dispatch({ type: 'addEvent', playerId: 'alice', kind: 'refus' }, context('rejected')),
    store.dispatch({ type: 'addEvent', playerId: 'alice', kind: 'candidature' }, context('next')),
  ]);
  assert.equal(outcomes[0].status, 'rejected');
  assert.ok(outcomes[0].reason instanceof RemoteError);
  assert.equal(outcomes[0].reason.status, 403);
  assert.equal(outcomes[1].status, 'fulfilled');
  assert.equal(calls, 2);
});

test('different groups have independent queues and authentication', async t => {
  const values = storage(t);
  values.set('louchomage:jeton:other-group', 'other-token');
  const requests = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({ url, token: init.headers['x-player-token'] });
    if (url.includes('/our-group/')) await gate;
    return response(2);
  });
  const pending = new RemoteStore('our-group').dispatch({ type: 'addEvent', playerId: 'alice', kind: 'refus' }, context('one'));
  await new RemoteStore('other-group').dispatch({ type: 'addEvent', playerId: 'bob', kind: 'refus' }, context('two'));
  release(); await pending;
  assert.deepEqual(requests.map(item => item.token), [undefined, 'other-token']);
});
