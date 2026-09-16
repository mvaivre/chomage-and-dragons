import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { createMemoryDb } = await import('../src/lib/server/db.ts');
const { createGroup, joinGroup, applyGroupAction, claimPlayer, playerForToken, validateContext, validateAction, GroupError, slugify } = await import('../src/lib/server/groups.ts');
const { createSessionValue, verifySessionValue, sessionCookieName, hashToken, isValidPin } = await import('../src/lib/server/auth.ts');
const { fixedContext } = await import('../src/lib/game/reducer.ts');

const T0 = '2026-09-16T10:00:00.000Z';
const ctx = (id, now = T0) => fixedContext(id, now);
const rejects = async (promise, status, pattern) => {
  const error = await promise.then(() => null, e => e);
  assert.ok(error instanceof GroupError, `expected a GroupError, got ${error}`);
  assert.equal(error.status, status);
  if (pattern) assert.match(error.message, pattern);
};

test('a group is created with a hashed password and an unguessable slug; joining checks the password', async () => {
  const db = createMemoryDb();
  const group = await createGroup(db, { name: 'Les Chômeurs Magnifiques', password: 'dragon' });
  assert.match(group.slug, /^les-chomeurs-magnifiques-[0-9a-f]{6}$/);
  assert.notEqual(group.passwordHash, 'dragon');
  assert.equal((await db.loadState(group.id)).version, 1);
  await rejects(createGroup(db, { name: 'X', password: 'dragon' }), 400, /nom/);
  await rejects(createGroup(db, { name: 'Bons amis', password: '123' }), 400, /mot de passe/);
  assert.equal((await joinGroup(db, group.slug, 'dragon')).id, group.id);
  await rejects(joinGroup(db, group.slug, 'licorne'), 403, /Mauvais/);
  await rejects(joinGroup(db, 'nope-000000', 'dragon'), 404);
  for (let i = 0; i < 4; i++) await rejects(joinGroup(db, group.slug, 'x'), 403);
  await rejects(joinGroup(db, group.slug, 'dragon'), 429, /essais/);
  assert.notEqual(slugify('Été à Zürich !'), slugify('Été à Zürich !'), 'two groups with the same name get different slugs');
});

test('the session cookie is signed per group and expires', () => {
  const value = createSessionValue('g1', Date.now());
  assert.equal(verifySessionValue(value, 'g1'), true);
  assert.equal(verifySessionValue(value, 'g2'), false);
  assert.equal(verifySessionValue(value.slice(0, -2) + 'zz', 'g1'), false);
  assert.equal(verifySessionValue(createSessionValue('g1', Date.now() - 401 * 86_400_000), 'g1'), false);
  assert.equal(verifySessionValue(undefined, 'g1'), false);
  assert.match(sessionCookieName('a-b_c'), /^cdg_abc$/);
});

test('a player joins with a PIN and gets a device token; only that device acts for them', async () => {
  const db = createMemoryDb();
  const group = await createGroup(db, { name: 'Compagnie', password: 'dragon' });
  await rejects(applyGroupAction(db, group, { type: 'addPlayer', name: 'Mika', characterId: 'skater' }, ctx('mika'), null), 400, /PIN/);
  const joined = await applyGroupAction(db, group, { type: 'addPlayer', name: 'Mika', characterId: 'skater' }, ctx('mika'), null, '1234');
  assert.equal(joined.version, 2);
  assert.equal(joined.result.player.id, 'mika');
  assert.ok(joined.deviceToken.length > 30);
  assert.equal(await playerForToken(db, group.id, joined.deviceToken), 'mika');
  assert.equal(await playerForToken(db, group.id, 'forged'), null);
  const lou = await applyGroupAction(db, group, { type: 'addPlayer', name: 'Lou', characterId: 'barde' }, ctx('lou'), null, '0000');
  assert.equal(lou.version, 3);
  // Mika logs an application with her token, not with Lou's, not without one.
  await rejects(applyGroupAction(db, group, { type: 'addEvent', playerId: 'mika', kind: 'candidature' }, ctx('e1'), null), 403, /appareil/);
  await rejects(applyGroupAction(db, group, { type: 'addEvent', playerId: 'mika', kind: 'candidature' }, ctx('e1'), 'lou'), 403);
  const logged = await applyGroupAction(db, group, { type: 'addEvent', playerId: 'mika', kind: 'candidature' }, ctx('e1'), 'mika');
  assert.equal(logged.version, 4);
  assert.equal(logged.result.offer, 'pigeon');
  assert.deepEqual(logged.state.events.map(e => e.id), ['e1']);
  // The mini-game result belongs to the attempt's player; loot targets decide who marks it seen.
  await rejects(applyGroupAction(db, group, { type: 'finishMiniGame', attemptId: 'e1', result: 'won' }, ctx('x'), 'lou'), 403);
  const won = await applyGroupAction(db, group, { type: 'finishMiniGame', attemptId: 'e1', result: 'won' }, ctx('x'), 'mika');
  assert.equal(won.state.events[0].journeyBonus, 2);
  await rejects(applyGroupAction(db, group, { type: 'finishMiniGame', attemptId: 'ghost', result: 'won' }, ctx('x'), 'mika'), 404);
  for (let i = 0; i < 3; i++) await applyGroupAction(db, group, { type: 'addEvent', playerId: 'mika', kind: 'candidature' }, ctx(`c${i}`), 'mika');
  const cast = await applyGroupAction(db, group, { type: 'castPower', playerId: 'mika', targetPlayerId: 'lou', kind: 'shot', slot: 0 }, ctx('cast1'), 'mika');
  assert.equal(cast.result.accepted, true);
  await rejects(applyGroupAction(db, group, { type: 'markCastSeen', castId: 'cast1' }, ctx('x'), 'mika'), 403, /appareil/);
  const seen = await applyGroupAction(db, group, { type: 'markCastSeen', castId: 'cast1' }, ctx('x', '2026-09-17T10:00:00.000Z'), 'lou');
  assert.equal(seen.state.casts[0].seenAt, '2026-09-17T10:00:00.000Z');
  await rejects(applyGroupAction(db, group, { type: 'settleShots', castIds: ['cast1'] }, ctx('x'), 'mika'), 403);
  // Rejected by the rules: a refused action changes nothing and says why.
  await rejects(applyGroupAction(db, group, { type: 'addPlayer', name: 'Sam', characterId: 'skater' }, ctx('sam'), null, '9999'), 409, /taken/);
  await rejects(applyGroupAction(db, group, { type: 'undoLast', playerId: 'lou' }, ctx('x'), 'lou'), 409, /nothing/);
  // Self-removal only, and the secrets go with the player.
  await rejects(applyGroupAction(db, group, { type: 'removePlayer', playerId: 'lou' }, ctx('x'), 'mika'), 403);
  const gone = await applyGroupAction(db, group, { type: 'removePlayer', playerId: 'lou' }, ctx('x'), 'lou');
  assert.deepEqual(gone.state.players.map(p => p.id), ['mika']);
  assert.equal(await playerForToken(db, group.id, lou.deviceToken), null);
  assert.equal(await db.findPin(group.id, 'lou'), null);
});

test('a character is reclaimed on a new device with its PIN, and the old device loses it', async () => {
  const db = createMemoryDb();
  const group = await createGroup(db, { name: 'Compagnie', password: 'dragon' });
  const joined = await applyGroupAction(db, group, { type: 'addPlayer', name: 'Mika', characterId: 'skater' }, ctx('mika'), null, '4321');
  await rejects(claimPlayer(db, group, 'mika', '0000'), 403, /PIN/);
  await rejects(claimPlayer(db, group, 'nobody', '4321'), 404);
  const token = await claimPlayer(db, group, 'mika', '4321');
  assert.equal(await playerForToken(db, group.id, token), 'mika');
  assert.equal(await playerForToken(db, group.id, joined.deviceToken), null, 'the earlier device is signed out');
  for (let i = 0; i < 5; i++) await rejects(claimPlayer(db, group, 'mika', '1111'), 403);
  await rejects(claimPlayer(db, group, 'mika', '4321'), 429);
  assert.equal(isValidPin('12345'), true);
  assert.equal(isValidPin('12'), false);
  assert.equal(isValidPin('abcd'), false);
  assert.equal(hashToken('a').length, 64);
});

test('concurrent saves retry on the fresh state, and the device-proposed context is checked', async () => {
  const db = createMemoryDb();
  const group = await createGroup(db, { name: 'Compagnie', password: 'dragon' });
  const mika = await applyGroupAction(db, group, { type: 'addPlayer', name: 'Mika', characterId: 'skater' }, ctx('mika'), null, '1234');
  // Another device saves between the read and the write: the first write fails once, then lands on version 4.
  const original = db.saveState.bind(db);
  let intrusions = 0;
  db.saveState = async (groupId, expected, state, at) => {
    if (intrusions++ === 0) {
      const fresh = await db.loadState(groupId);
      await original(groupId, fresh.version, { ...fresh.state, casts: [] }, at);
    }
    return original(groupId, expected, state, at);
  };
  const applied = await applyGroupAction(db, group, { type: 'addEvent', playerId: 'mika', kind: 'refus' }, ctx('r1'), mika.result.player.id);
  assert.equal(applied.version, 4);
  assert.equal(intrusions, 2);
  const now = new Date('2026-09-16T10:00:00.000Z');
  const kept = validateContext({ id: '123e4567-e89b-12d3-a456-426614174000', now: '2026-09-16T09:59:00.000Z' }, now);
  assert.equal(kept.id(), '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(kept.now(), '2026-09-16T09:59:00.000Z');
  const replaced = validateContext({ id: 'not-a-uuid', now: '2020-01-01T00:00:00.000Z' }, now);
  assert.match(replaced.id(), /^[0-9a-f-]{36}$/);
  assert.equal(replaced.now(), now.toISOString(), 'a stale timestamp is replaced by the server clock');
  assert.throws(() => validateAction({ type: 'dropTables' }), GroupError);
  assert.throws(() => validateAction(null), GroupError);
});
