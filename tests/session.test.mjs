import test from 'node:test';
import assert from 'node:assert/strict';
const { loadKnownGroups, forgetGroup, pruneMissingGroups } = await import('../src/lib/data/session.ts');

function storage(t, groups) {
  const values = new Map([
    ['louchomage:groupes:v1', JSON.stringify(groups)],
    ['louchomage:v2', 'solo-progress'], ['louchomage:moi:v1', 'solo-player'],
    ['louchomage:renderer:v1', '3d'], ['louchomage:renderer-choice:v1', '1'],
  ]);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
  } } });
  t.after(() => original ? Object.defineProperty(globalThis, 'window', original) : delete globalThis.window);
  return values;
}

test('only missing groups lose their local references; signed-out, unavailable and offline groups survive', async t => {
  const groups = ['gone', 'valid', 'signed-out', 'unavailable', 'offline'].map(slug => ({ slug, name: slug }));
  const values = storage(t, groups);
  for (const {slug} of groups) {
    values.set(`louchomage:jeton:${slug}`, 'secret');values.set(`louchomage:moi:${slug}`, 'player');
  }
  t.mock.method(globalThis, 'fetch', async url => {
    const slug = url.split('/').at(-1);
    if (slug === 'offline') throw new TypeError('offline');
    return new Response(null, {status: {gone:404, valid:200, 'signed-out':401, unavailable:500}[slug]});
  });
  assert.deepEqual(await pruneMissingGroups(), ['gone']);
  assert.deepEqual(loadKnownGroups(), groups.slice(1));
  assert.equal(values.has('louchomage:jeton:gone'), false);
  assert.equal(values.has('louchomage:moi:gone'), false);
  assert.equal(values.get('louchomage:jeton:valid'), 'secret');
  assert.equal(values.get('louchomage:v2'), 'solo-progress');
  assert.equal(values.get('louchomage:moi:v1'), 'solo-player');
  assert.equal(values.get('louchomage:renderer:v1'), '3d');
});

test('an aborted check cannot erase a saved group', async t => {
  const groups = [{slug:'keep',name:'Keep'}];storage(t,groups);
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async () => { controller.abort(); return new Response(null,{status:404}); });
  assert.deepEqual(await pruneMissingGroups(controller.signal), []);
  assert.deepEqual(loadKnownGroups(), groups);
});

test('even a malformed stale group named v1 cannot erase the solo identity', t => {
  const values=storage(t,[{slug:'v1',name:'Old'}]);forgetGroup('v1');
  assert.equal(values.get('louchomage:moi:v1'),'solo-player');
  assert.equal(values.get('louchomage:v2'),'solo-progress');
});
