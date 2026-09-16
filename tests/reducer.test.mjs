import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { applyAction, fixedContext } = await import('../src/lib/game/reducer.ts');
const { journeyProgress } = await import('../src/lib/game/scoring.ts');
const { availablePowers } = await import('../src/lib/game/powers.ts');

const T0 = '2026-09-16T10:00:00.000Z';
const empty = () => ({ players: [], casts: [], events: [] });
const withPlayers = () => {
  let state = empty();
  state = applyAction(state, { type: 'addPlayer', name: '  Mika ', characterId: 'skater' }, fixedContext('mika', T0)).state;
  state = applyAction(state, { type: 'addPlayer', name: 'Lou', characterId: 'barde' }, fixedContext('lou', T0)).state;
  return state;
};
const log = (state, playerId, kind, id) => applyAction(state, { type: 'addEvent', playerId, kind }, fixedContext(id, T0));

test('players join with a trimmed name and a free character; bad requests leave the state alone', () => {
  const state = withPlayers();
  assert.deepEqual(state.players.map(p => [p.id, p.name, p.characterId, p.joinedAt]), [['mika', 'Mika', 'skater', T0], ['lou', 'Lou', 'barde', T0]]);
  for (const [action, why] of [
    [{ type: 'addPlayer', name: '   ', characterId: 'fee' }, 'empty name'],
    [{ type: 'addPlayer', name: 'Sam', characterId: 'skater' }, 'character taken'],
    [{ type: 'addPlayer', name: 'Sam', characterId: 'dragon-doré' }, 'unknown character'],
    [{ type: 'removePlayer', playerId: 'nobody' }, 'unknown player'],
    [{ type: 'addEvent', playerId: 'nobody', kind: 'refus' }, 'unknown player'],
    [{ type: 'undoLast', playerId: 'mika' }, 'nothing to undo'],
  ]) {
    const applied = applyAction(state, action, fixedContext('x', T0));
    assert.equal(applied.state, state, why);
    assert.equal(applied.result.rejected, why);
  }
});

test('an action logs an event, offers its game, hires on embauche and reserves a crossed chest', () => {
  let state = withPlayers();
  const first = log(state, 'mika', 'candidature', 'e1');
  assert.deepEqual(first.result.event, { id: 'e1', playerId: 'mika', kind: 'candidature', at: T0, miniGameId: 'e1' });
  assert.equal(first.result.offer, 'pigeon');
  assert.equal(first.result.chestGame, null);
  state = first.state;
  for (let i = 0; i < 3; i++) state = log(state, 'mika', 'candidature', `c${i}`).state;
  const crossing = log(state, 'mika', 'candidature', 'e5');
  assert.equal(journeyProgress(crossing.state.events).earnedChests, 1);
  assert.deepEqual(crossing.result.chestGame, { attemptId: 'e5-chest-0', offer: true });
  const hired = log(crossing.state, 'mika', 'embauche', 'h');
  assert.equal(hired.result.offer, null);
  assert.equal(hired.state.players[0].hiredAt, T0);
  const after = log(hired.state, 'mika', 'refus', 'r');
  assert.equal(after.result.rejected, 'player already hired');
  assert.equal(after.state, hired.state);
});

test('finishing a game awards once and can cross a chest; a stale result changes nothing', () => {
  let state = withPlayers();
  for (let i = 0; i < 4; i++) state = log(state, 'lou', 'candidature', `l${i}`).state;
  assert.equal(journeyProgress(state.events).earnedChests, 0);
  const won = applyAction(state, { type: 'finishMiniGame', attemptId: 'l3', result: 'won' }, fixedContext('x', T0));
  assert.equal(won.result.changed, true);
  assert.deepEqual(won.result.chestGame, { attemptId: 'l3-chest-0', offer: true });
  assert.equal(journeyProgress(won.state.events).steps, 10);
  const again = applyAction(won.state, { type: 'finishMiniGame', attemptId: 'l3', result: 'won' }, fixedContext('x', T0));
  assert.equal(again.result.changed, false);
  assert.equal(again.state, won.state);
});

test('loot is cast once per slot between two distinct players, seen and settled idempotently', () => {
  let state = withPlayers();
  for (let i = 0; i < 5; i++) state = log(state, 'mika', 'candidature', `m${i}`).state;
  assert.equal(availablePowers('mika', 1, state.casts, state.miniGames).length, 1);
  const self = applyAction(state, { type: 'castPower', playerId: 'mika', targetPlayerId: 'mika', kind: 'shot', slot: 0 }, fixedContext('cast0', T0));
  assert.equal(self.result.accepted, false);
  assert.equal(self.state, state);
  const cast = applyAction(state, { type: 'castPower', playerId: 'mika', targetPlayerId: 'lou', kind: 'shot', slot: 0 }, fixedContext('cast1', T0));
  assert.equal(cast.result.accepted, true);
  assert.deepEqual(cast.state.casts, [{ id: 'cast1', playerId: 'mika', targetPlayerId: 'lou', kind: 'shot', slot: 0, at: T0 }]);
  const twice = applyAction(cast.state, { type: 'castPower', playerId: 'mika', targetPlayerId: 'lou', kind: 'shot', slot: 0 }, fixedContext('cast2', T0));
  assert.equal(twice.result.rejected, 'loot already cast');
  const T1 = '2026-09-17T10:00:00.000Z';
  const seen = applyAction(cast.state, { type: 'markCastSeen', castId: 'cast1' }, fixedContext('x', T1)).state;
  assert.equal(seen.casts[0].seenAt, T1);
  const settled = applyAction(seen, { type: 'settleShots', castIds: ['cast1'] }, fixedContext('x', '2026-09-18T10:00:00.000Z')).state;
  assert.equal(settled.casts[0].seenAt, T1, 'seenAt is kept');
  assert.equal(settled.casts[0].settledAt, '2026-09-18T10:00:00.000Z');
  assert.deepEqual(applyAction(settled, { type: 'settleShots', castIds: ['cast1'] }, fixedContext('x', '2026-09-19T10:00:00.000Z')).state.casts, settled.casts);
});

test('undo removes the last event of a kind and reopens the race; removal purges a player everywhere', () => {
  let state = withPlayers();
  state = log(state, 'mika', 'candidature', 'a').state;
  state = log(state, 'lou', 'refus', 'b').state;
  state = log(state, 'mika', 'embauche', 'c').state;
  assert.equal(state.players[0].hiredAt, T0);
  const undone = applyAction(state, { type: 'undoLast', playerId: 'mika' }, fixedContext('x', T0));
  assert.equal(undone.result.removed.id, 'c');
  assert.equal(undone.state.players[0].hiredAt, undefined);
  assert.deepEqual(undone.state.events.map(e => e.id), ['a', 'b']);
  const byKind = applyAction(undone.state, { type: 'undoLast', playerId: 'lou', kind: 'candidature' }, fixedContext('x', T0));
  assert.equal(byKind.result.rejected, 'nothing to undo');
  for (let i = 0; i < 5; i++) state = log(state, 'lou', 'candidature', `l${i}`).state;
  state = applyAction(state, { type: 'castPower', playerId: 'lou', targetPlayerId: 'mika', kind: 'shot', slot: 0 }, fixedContext('cast', T0)).state;
  const removed = applyAction(state, { type: 'removePlayer', playerId: 'lou' }, fixedContext('x', T0)).state;
  assert.deepEqual(removed.players.map(p => p.id), ['mika']);
  assert.ok(removed.events.every(e => e.playerId === 'mika'));
  assert.equal(removed.casts.length, 0, 'casts from or to the player are gone');
  assert.ok(removed.miniGames.every(a => a.playerId === 'mika'));
});

test('the reducer is deterministic: the same action on the same state gives the same answer', () => {
  const state = withPlayers();
  const a = applyAction(state, { type: 'addEvent', playerId: 'mika', kind: 'rejetApresEntretien' }, fixedContext('same', T0));
  const b = applyAction(state, { type: 'addEvent', playerId: 'mika', kind: 'rejetApresEntretien' }, fixedContext('same', T0));
  assert.deepEqual(a, b);
  assert.notEqual(a.state, state, 'a new state object');
  assert.deepEqual(state, withPlayers(), 'the input is never mutated');
});
