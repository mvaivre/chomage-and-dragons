import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { racePosition, hiredPosition } = await import('../src/lib/game/progress.ts');
const { worldXFor, biomeAt, WORLD_LENGTH } = await import('../src/lib/game/world.ts');
const { stepsFor, journeySteps } = await import('../src/lib/game/scoring.ts');

test('actions keep their distance beyond both itinerary boundaries and interviews move backwards', () => {
  for (const start of [0, 78, 80, 99, 158, 160, 800]) {
    for (const [kind, delta] of [['candidature', 2], ['refus', 3], ['entretien', -3], ['rejetApresEntretien', 6]]) {
      assert.equal(stepsFor(kind), delta);
      const next = Math.max(0, start + delta);
      const distance = worldXFor(racePosition(next)) - worldXFor(racePosition(start));
      assert.ok(Math.abs(distance - (next - start) * WORLD_LENGTH / 80) < 1e-8);
    }
  }
  assert.equal(journeySteps([{kind:'candidature'}, {kind:'refus'}, {kind:'entretien'}, {kind:'rejetApresEntretien'}]), 8);
});

test('the scenery repeats while hiring always leads to the next tavern', () => {
  for (const steps of [1, 79, 80, 81, 159, 160, 161, 800]) {
    const destination = worldXFor(hiredPosition(steps));
    assert.ok(destination >= worldXFor(racePosition(steps)));
    assert.equal(biomeAt(destination).id, 'taverne');
  }
  for (const x of [500, 4000, 10000]) assert.equal(biomeAt(x).id, biomeAt(x + WORLD_LENGTH).id);
});

const { journeyProgress, untilNextChest } = await import('../src/lib/game/scoring.ts');
const { availablePowers } = await import('../src/lib/game/powers.ts');
test('earned chests survive setbacks without being awarded twice', () => {
  const events = Array.from({length: 55}, () => ({kind: 'candidature'}));
  events.push({kind: 'entretien'});
  const state = journeyProgress(events);
  assert.deepEqual(state, {steps:107, earnedChests:11});
  assert.equal(availablePowers('me', state.earnedChests, []).length, 11);
  assert.equal(untilNextChest(state.steps, state.earnedChests), 13);
  events.push({kind:'refus'});
  assert.deepEqual(journeyProgress(events), {steps:110, earnedChests:11});
  assert.equal(availablePowers('me', 11, [{playerId:'me',slot:10}]).length, 10);
});
test('undo removes the chest only when its unlocking event no longer exists', () => {
  const events = Array.from({length: 5}, () => ({kind:'candidature'}));
  assert.equal(journeyProgress(events).earnedChests, 1);
  assert.equal(journeyProgress(events.slice(0,-1)).earnedChests, 0);
  assert.deepEqual(journeyProgress([{kind:'entretien'}, {kind:'candidature'}]), {steps:2, earnedChests:0});
});

const { reservePigeonFlight, resolvePigeonFlight, pigeonAltitude, pigeonHitsMailbox } = await import('../src/lib/game/pigeon-flight.ts');
const { stepsForEvent, pointsFor } = await import('../src/lib/game/scoring.ts');
const application = (id, playerId = 'me') => ({ id, playerId, kind: 'candidature', at: '2026-09-08T12:00:00Z' });
function enter(state, event) {
  const reserved = reservePigeonFlight(state, event);
  return { ...reserved, state: { ...reserved.state, events: [...state.events, reserved.event] } };
}

test('a pigeon delivery doubles only application travel and can unlock a chest', () => {
  const initial = {players: [], casts: [], events: [application('a'), application('b'), application('c')]};
  const reservation = enter(initial, application('delivery'));
  assert.equal(reservation.offerPigeon, true);
  assert.deepEqual(journeyProgress(reservation.state.events), {steps: 8, earnedChests: 0});
  const awarded = resolvePigeonFlight(reservation.state, 'delivery', 'hit');
  assert.deepEqual(journeyProgress(awarded.events), {steps: 10, earnedChests: 1});
  assert.equal(pointsFor(awarded.events.at(-1).kind), 1);
  assert.equal(resolvePigeonFlight(awarded, 'delivery', 'hit'), awarded, 'Award is idempotent');
  assert.equal(stepsForEvent({kind: 'refus', journeyMultiplier: 2}), 3);
});

test('undo and re-entry restore the earned multiplier without another attempt', () => {
  const first = enter({players: [], casts: [], events: []}, application('original'));
  const awarded = resolvePigeonFlight(first.state, 'original', 'hit');
  const undone = { ...awarded, events: [] };
  assert.equal(journeyProgress(undone.events).steps, 0);
  const replacement = enter(undone, application('replacement'));
  assert.equal(replacement.offerPigeon, false);
  assert.equal(journeyProgress(replacement.state.events).steps, 4);
  assert.equal(resolvePigeonFlight(replacement.state, 'original', 'hit'), replacement.state);
  assert.equal(enter(replacement.state, application('next')).offerPigeon, true);
  assert.equal(enter(replacement.state, application('other', 'companion')).offerPigeon, true);
});

test('missed, skipped and interrupted attempts keep the base and survive reload/undo', () => {
  for (const result of ['miss', 'skipped', 'pending']) {
    const first = enter({players: [], casts: [], events: []}, application('first'));
    const state = result === 'pending' ? first.state : resolvePigeonFlight(first.state, 'first', result);
    assert.equal(journeyProgress(state.events).steps, 2);
    const reloaded = JSON.parse(JSON.stringify(state));
    const retry = enter({...reloaded, events: []}, application('retry'));
    assert.equal(retry.offerPigeon, false);
    assert.equal(journeyProgress(retry.state.events).steps, 2);
    assert.equal(resolvePigeonFlight(retry.state, 'first', 'hit'), retry.state);
    if (result !== 'pending') assert.equal(resolvePigeonFlight(state, 'first', 'hit'), state);
  }
});

test('the moving pigeon stays in the arena and the marked delivery band is hittable', () => {
  let hits = 0;
  for (let ms = 0; ms <= 12000; ms += 50) {
    const y = pigeonAltitude(ms);
    assert.ok(y >= 23 && y <= 77);
    if (pigeonHitsMailbox(y)) hits++;
  }
  assert.ok(hits > 20 && hits < 150);
  assert.equal(pigeonHitsMailbox(41), true);
  assert.equal(pigeonHitsMailbox(59), true);
  assert.equal(pigeonHitsMailbox(40.9), false);
  assert.equal(pigeonHitsMailbox(59.1), false);
});
