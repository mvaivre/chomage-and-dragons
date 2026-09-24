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

test('friends cheer an action once each, can change or take back their emoji, never their own', () => {
  let state = withPlayers();
  state = log(state, 'mika', 'refus', 'r1').state;
  const own = applyAction(state, { type: 'cheer', playerId: 'mika', eventId: 'r1', emoji: '👏' }, fixedContext('c0', T0));
  assert.equal(own.result.rejected, 'own action');
  const first = applyAction(state, { type: 'cheer', playerId: 'lou', eventId: 'r1', emoji: '👏' }, fixedContext('c1', T0));
  assert.deepEqual(first.state.cheers.map(c => [c.playerId, c.emoji]), [['lou', '👏']]);
  const changed = applyAction(first.state, { type: 'cheer', playerId: 'lou', eventId: 'r1', emoji: '🍺' }, fixedContext('c2', T0));
  assert.deepEqual(changed.state.cheers.map(c => [c.id, c.emoji]), [['c2', '🍺']], 'one cheer per friend and per action');
  const back = applyAction(changed.state, { type: 'cheer', playerId: 'lou', eventId: 'r1', emoji: '🍺' }, fixedContext('c3', T0));
  assert.deepEqual(back.state.cheers, [], 'the same emoji twice takes it back');
  assert.equal(applyAction(state, { type: 'cheer', playerId: 'lou', eventId: 'nope', emoji: '👏' }, fixedContext('x', T0)).result.rejected, 'unknown event');
  assert.equal(applyAction(state, { type: 'cheer', playerId: 'lou', eventId: 'r1', emoji: '💩' }, fixedContext('x', T0)).result.rejected, 'unknown emoji');
  const undone = applyAction(changed.state, { type: 'undoLast', playerId: 'mika' }, fixedContext('x', T0));
  assert.deepEqual(undone.state.cheers, [], 'undoing an action removes its cheers');
  const gone = applyAction(changed.state, { type: 'removePlayer', playerId: 'lou' }, fixedContext('x', T0));
  assert.deepEqual(gone.state.cheers, [], 'a leaving friend takes their cheers');
});

const { dailyChallenge, zurichDay, dailyRanking, DAILY_GAMES } = await import('../src/lib/game/daily.ts');
const { SCORE_CAPS } = await import('../src/lib/game/scores.ts');
test('the daily challenge is the same game for everyone, reserved on open, played once a day', () => {
  assert.equal(zurichDay(new Date('2026-09-24T22:30:00Z')), '2026-09-25', 'the day turns at midnight in Zurich');
  assert.deepEqual(dailyChallenge('2026-09-24'), dailyChallenge('2026-09-24'));
  const kinds = new Set(Array.from({ length: 60 }, (_, i) => dailyChallenge(`2026-10-${String(i % 28 + 1).padStart(2, '0')}`).kind));
  assert.ok(kinds.size >= 4 && [...kinds].every(k => DAILY_GAMES.includes(k)));
  let state = withPlayers();
  const day = '2026-09-16';
  const kind = dailyChallenge(day).kind;
  const run = (playerId, extra, id = 'x', now = T0) => applyAction(state, { type: 'dailyRun', playerId, day, kind, ...extra }, fixedContext(id, now));
  assert.equal(run('mika', { score: 50 }).result.rejected, 'not started', 'a score needs an opened run');
  state = run('mika', { start: true }, 'd1').state;
  assert.equal(state.daily[0].pending, true);
  assert.equal(run('mika', { start: true }).result.rejected, 'already played today', 'reopening is not a second chance');
  state = run('mika', { score: 42.4 }, 'd2').state;
  assert.deepEqual([state.daily[0].score, state.daily[0].pending], [42, false]);
  assert.equal(run('mika', { score: 180 }).result.rejected, 'already played today', 'the first score stands');
  assert.equal(applyAction(state, { type: 'dailyRun', playerId: 'lou', day: '9999-12-31', kind, start: true }, fixedContext('x', T0)).result.rejected, 'not today', 'no writing into another day');
  assert.equal(applyAction(state, { type: 'dailyRun', playerId: 'lou', day: '2026-13-01', kind, start: true }, fixedContext('x', T0)).result.rejected, 'not today', 'an impossible day is refused, not thrown');
  assert.equal(applyAction(state, { type: 'dailyRun', playerId: 'lou', day, kind: kind === 'quiz' ? 'stamp' : 'quiz', start: true }, fixedContext('x', T0)).result.rejected, "not today's game");
  state = run('lou', { start: true }, 'd3', '2026-09-16T11:00:00.000Z').state;
  state = run('lou', { score: 1e9 }, 'd4', '2026-09-16T11:05:00.000Z').state;
  assert.equal(state.daily.find(r => r.playerId === 'lou').score, SCORE_CAPS[kind], 'scores are capped per game');
  assert.deepEqual(dailyRanking(state.daily, day).map(r => r.playerId), ['lou', 'mika']);
  assert.equal(applyAction(state, { type: 'removePlayer', playerId: 'lou' }, fixedContext('x', T0)).state.daily.length, 1);
});

test('the journal refuses what a device should never send', () => {
  const state = withPlayers();
  for (const [action, why] of [
    [{ type: 'addEvent', playerId: 'mika', kind: 'x' }, 'unknown action'],
    [{ type: 'addEvent', playerId: 'mika', kind: '__proto__' }, 'unknown action'],
    [{ type: 'castPower', playerId: 'mika', targetPlayerId: 'lou', kind: 'nuke', slot: 0 }, 'unknown loot'],
    [{ type: 'castPower', playerId: 'mika', targetPlayerId: 'lou', kind: 'shot', slot: -1 }, 'unknown loot'],
    [{ type: 'finishMiniGame', attemptId: { evil: true }, result: 'won' }, 'bad result'],
    [{ type: 'finishMiniGame', attemptId: 'a', result: 'jackpot' }, 'bad result'],
  ]) {
    const applied = applyAction(state, action, fixedContext('x', T0));
    assert.equal(applied.state, state, why);
    assert.equal(applied.result.rejected, why);
  }
  let played = log(state, 'mika', 'refus', 'r1').state;
  played = applyAction(played, { type: 'finishMiniGame', attemptId: 'r1', result: 'won', score: 99999 }, fixedContext('x', T0)).state;
  assert.ok(played.miniGames[0].score <= 145, 'a mini-game score is capped at what the game allows');
});

