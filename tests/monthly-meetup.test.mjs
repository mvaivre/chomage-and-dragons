import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { zurichDateTimeInput, zurichInputToIso, monthClosesAt, monthCountdown, editableMeetupMonths, validateMeetupInput } = await import('../src/lib/game/monthly-meetup.ts');
const { applyAction, fixedContext } = await import('../src/lib/game/reducer.ts');
const { createMemoryDb } = await import('../src/lib/server/db.ts');
const { createGroup, applyGroupAction, loadSnapshot, playerForToken, validateAction, GroupError } = await import('../src/lib/server/groups.ts');
const { loadState, saveState } = await import('../src/lib/data/local-store.ts');

const T0 = '2026-10-08T10:00:00.000Z';
const ctx = (id, now = T0) => fixedContext(id, now);
const planned = (extra = {}) => ({ type: 'scheduleMeetup', playerId: 'mika', monthKey: '2026-10', at: '2026-10-30T18:00:00.000Z', place: '  La taverne  ', ...extra });
const state = () => ({ players: [{ id: 'mika', name: 'Mika', characterId: 'skater', joinedAt: T0 }], events: [], casts: [] });

test('Zurich wall-clock dates survive device timezone differences, with strict DST handling', () => {
  assert.equal(zurichInputToIso('2026-03-28T19:00'), '2026-03-28T18:00:00.000Z');
  assert.equal(zurichInputToIso('2026-03-29T19:00'), '2026-03-29T17:00:00.000Z');
  assert.equal(zurichInputToIso('2026-10-24T19:00'), '2026-10-24T17:00:00.000Z');
  assert.equal(zurichInputToIso('2026-10-25T19:00'), '2026-10-25T18:00:00.000Z');
  assert.equal(zurichInputToIso('2026-03-29T02:30'), null, 'the skipped spring hour cannot be scheduled');
  assert.equal(zurichInputToIso('2026-10-25T02:30'), null, 'the repeated autumn hour needs an unambiguous choice');
  for (const invalid of ['2026-02-30T18:00', '2026-13-01T18:00', '2026-10-31T24:00', '2026-10-31T18:61', 'tomorrow', '2026-10-31T18:00Z']) {
    assert.equal(zurichInputToIso(invalid), null, invalid);
  }
  assert.equal(zurichDateTimeInput(new Date('2026-10-30T18:00:00.000Z')), '2026-10-30T19:00');
});

test('monthly deadline counts down to Zurich midnight across DST, leap months and year rollover', () => {
  assert.equal(new Date(monthClosesAt('2026-03')).toISOString(), '2026-03-31T22:00:00.000Z');
  assert.equal(new Date(monthClosesAt('2026-10')).toISOString(), '2026-10-31T23:00:00.000Z');
  assert.equal(new Date(monthClosesAt('2028-02')).toISOString(), '2028-02-29T23:00:00.000Z');
  assert.equal(new Date(monthClosesAt('2026-12')).toISOString(), '2026-12-31T23:00:00.000Z');
  assert.equal(monthCountdown('2026-03', new Date('2026-03-28T23:00:00.000Z')), '2 j 23 h');
  assert.equal(monthCountdown('2026-10', new Date('2026-10-31T22:59:30.000Z')), '1 min');
  assert.equal(monthCountdown('2026-10', new Date('2026-10-31T23:00:00.000Z')), '0 min');
  assert.deepEqual(editableMeetupMonths(new Date('2026-12-31T23:00:00.000Z')), ['2027-01', '2026-12']);
  assert.deepEqual(editableMeetupMonths(new Date('2026-10-14T22:00:00.000Z')), ['2026-10'], 'the previous-month window closes at Zurich midnight on the 15th');
});

test('a drink date can be changed independently of the crown and all invalid input leaves state untouched', () => {
  const original = state();
  const first = applyAction(original, planned(), ctx('meetup'));
  assert.deepEqual(first.result.meetup, { monthKey: '2026-10', at: '2026-10-30T18:00:00.000Z', place: 'La taverne', updatedBy: 'mika', updatedAt: T0 });
  assert.equal(first.state.events, original.events, 'the race journal does not change');
  const moved = applyAction(first.state, planned({ at: '2026-11-06T18:00:00.000Z', place: 'Au dragon' }), ctx('move'));
  assert.equal(moved.state.monthlyMeetups.length, 1, 'one shared meeting per crown month');
  assert.equal(moved.state.monthlyMeetups[0].monthKey, '2026-10', 'a November drink still celebrates the October crown');
  assert.equal(monthClosesAt('2026-10'), Date.parse('2026-10-31T23:00:00.000Z'));
  const repeated = applyAction(moved.state, planned({ at: '2026-11-06T18:00:00.000Z', place: 'Au dragon' }), ctx('again'));
  assert.equal(repeated.state, moved.state, 'a duplicate does not create another update');
  for (const extra of [
    { playerId: 'nobody' }, { monthKey: '2026-13' }, { monthKey: '2026-08' }, { monthKey: null },
    { at: T0 }, { at: '2026-10-07T18:00:00.000Z' }, { at: '2026-11-15T18:00:00.000Z' },
    { at: '2026-10-32T18:00:00.000Z' }, { at: '2026-10-30T19:00:00+01:00' }, { at: {} },
    { place: 'a'.repeat(81) }, { place: 'a\nb' }, { place: null },
  ]) {
    const rejected = applyAction(original, planned(extra), ctx('bad'));
    assert.equal(rejected.state, original, JSON.stringify(extra));
    assert.ok(rejected.result.rejected, JSON.stringify(extra));
  }
  assert.equal(validateMeetupInput('2026-09', '2026-10-14T21:59:00.000Z', '', new Date(T0)), null, 'the previous crown can still get a drink');
  assert.ok(validateMeetupInput('2026-09', '2026-10-15T17:00:00.000Z', '', new Date(T0)));
});

test('group members can move the shared meeting, while guests and forged player ids cannot; reload preserves it', async () => {
  const db = createMemoryDb();
  const group = await createGroup(db, { name: 'Compagnie', password: 'dragon' }, new Date(T0));
  const mika = await applyGroupAction(db, group, { type: 'addPlayer', name: 'Mika', characterId: 'skater' }, ctx('mika'), null, '1234');
  const lou = await applyGroupAction(db, group, { type: 'addPlayer', name: 'Lou', characterId: 'barde' }, ctx('lou'), null, '0000');
  const tokenMika = await playerForToken(db, group.id, mika.deviceToken);
  const tokenLou = await playerForToken(db, group.id, lou.deviceToken);
  const forbidden = async (promise) => assert.rejects(promise, (error) => error instanceof GroupError && error.status === 403);
  await forbidden(applyGroupAction(db, group, planned(), ctx('guest'), null));
  await forbidden(applyGroupAction(db, group, planned(), ctx('forged'), tokenLou));
  const first = await applyGroupAction(db, group, validateAction(planned()), ctx('first'), tokenMika);
  const moved = await applyGroupAction(db, group, planned({ playerId: 'lou', at: '2026-11-06T18:00:00.000Z', place: 'Chez Lou' }), ctx('move'), tokenLou);
  assert.equal(moved.version, first.version + 1);
  assert.equal(moved.result.meetup.updatedBy, 'lou');
  const reloaded = await loadSnapshot(db, group.id);
  assert.deepEqual(reloaded.state.monthlyMeetups, [moved.result.meetup]);
  assert.equal(reloaded.state.events.length, 0);
  assert.throws(() => validateAction({ type: 'scheduleMeetup', playerId: 'mika', monthKey: [], at: T0, place: '' }), GroupError);
  assert.throws(() => validateAction({ type: 'scheduleMeetup' }), GroupError);
  await assert.rejects(applyGroupAction(db, group, planned({ at: 'not a date' }), ctx('invalid'), tokenMika), (error) => error instanceof GroupError && error.status === 409);
  assert.equal((await loadSnapshot(db, group.id)).version, moved.version, 'invalid input cannot advance the version');
});

test('the local save reload keeps the shared appointment without requiring a migration', () => {
  const storage = new Map();
  const previous = globalThis.window;
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  try {
    const saved = applyAction(state(), planned(), ctx('saved')).state;
    saveState(saved);
    assert.deepEqual(loadState().monthlyMeetups, saved.monthlyMeetups);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
