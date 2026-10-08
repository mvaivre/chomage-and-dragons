import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { applyAction, fixedContext } = await import('../src/lib/game/reducer.ts');
const { createMemoryDb } = await import('../src/lib/server/db.ts');
const { createGroup, applyGroupAction, loadSnapshot, validateAction, GroupError } = await import('../src/lib/server/groups.ts');
const T0 = '2026-10-08T10:00:00.000Z';
const ctx = (id) => fixedContext(id, T0);
const find = (playerId, itemId = 'hidden:0:plaine') => ({ type: 'findHidden', playerId, itemId });

test('discoveries are unique per player and item, never affect the race, and leave with the player', () => {
  let state = { players: [{ id: 'mika' }, { id: 'lou' }], events: [], casts: [] };
  const first = applyAction(state, find('mika'), ctx('first'));
  assert.deepEqual(first.result.discovery, { playerId: 'mika', itemId: 'hidden:0:plaine', at: T0 });
  assert.equal(first.state.events, state.events);
  assert.equal(first.state.casts, state.casts);
  assert.equal(first.state.miniGames, undefined);
  const duplicate = applyAction(first.state, find('mika'), ctx('again'));
  assert.equal(duplicate.state, first.state);
  state = applyAction(first.state, find('lou'), ctx('friend')).state;
  assert.equal(state.discoveries.length, 2, 'finding something does not take it from a friend');
  for (const action of [find('nobody'), find('mika', 'hidden:1:plaine'), find('mika', 'hidden:0:unknown'), find('mika', null)]) {
    const invalid = applyAction(state, action, ctx('invalid'));
    assert.equal(invalid.state, state);
    assert.ok(invalid.result.rejected);
  }
  const removed = applyAction(state, { type: 'removePlayer', playerId: 'mika' }, ctx('remove')).state;
  assert.deepEqual(removed.discoveries.map(d => d.playerId), ['lou']);
});

test('group discovery authorization rejects guests and impersonation, and reload keeps the first discovery', async () => {
  const db = createMemoryDb();
  const group = await createGroup(db, { name: 'Compagnie', password: 'dragon' }, new Date(T0));
  await applyGroupAction(db, group, { type: 'addPlayer', name: 'Mika', characterId: 'skater' }, ctx('mika'), null, '1234');
  await applyGroupAction(db, group, { type: 'addPlayer', name: 'Lou', characterId: 'barde' }, ctx('lou'), null, '0000');
  for (const token of [null, 'lou']) {
    await assert.rejects(applyGroupAction(db, group, find('mika'), ctx('forged'), token), (error) => error instanceof GroupError && error.status === 403);
  }
  const first = await applyGroupAction(db, group, validateAction(find('mika')), ctx('found'), 'mika');
  const duplicate = await applyGroupAction(db, group, find('mika'), ctx('again'), 'mika');
  assert.equal(duplicate.version, first.version, 'a retried discovery never writes twice');
  assert.deepEqual((await loadSnapshot(db, group.id)).state.discoveries, [first.result.discovery]);
  await assert.rejects(applyGroupAction(db, group, find('mika', 'hidden:0:unknown'), ctx('bad'), 'mika'), (error) => error instanceof GroupError && error.status === 409);
  assert.throws(() => validateAction({ type: 'findHidden', playerId: 'mika', itemId: [] }), GroupError);
});
