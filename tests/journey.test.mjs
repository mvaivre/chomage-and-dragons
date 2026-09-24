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

const { COURSE, courseSeed, generateTowers, createPigeonSim, stepPigeon, flapPigeon, pigeonAutopilot, towersPassed } = await import('../src/lib/game/pigeon-flight.ts');
const { reserveMiniGame, resolveMiniGame, reserveChestGame, miniGameForAction } = await import('../src/lib/game/mini-games.ts');
const { migrateMiniGames } = await import('../src/lib/data/local-store.ts');
const { stepsForEvent, pointsFor } = await import('../src/lib/game/scoring.ts');
const application = (id, playerId = 'me') => ({ id, playerId, kind: 'candidature', at: '2026-09-08T12:00:00Z' });
function enter(state, event) {
  const reserved = reserveMiniGame(state, event);
  return { ...reserved, state: { ...reserved.state, events: [...state.events, reserved.event] } };
}

test('a won application game doubles only application travel and can unlock a chest', () => {
  const initial = {players: [], casts: [], events: [application('a'), application('b'), application('c')]};
  const reservation = enter(initial, application('delivery'));
  assert.equal(reservation.offer, 'keywords', 'applications alternate between the two courier games');
  assert.equal(miniGameForAction('candidature', 0), 'pigeon');
  assert.deepEqual(journeyProgress(reservation.state.events), {steps: 8, earnedChests: 0});
  const awarded = resolveMiniGame(reservation.state, 'delivery', 'won');
  assert.deepEqual(journeyProgress(awarded.events), {steps: 10, earnedChests: 1});
  assert.equal(pointsFor(awarded.events.at(-1).kind), 1);
  assert.equal(resolveMiniGame(awarded, 'delivery', 'won'), awarded, 'Award is idempotent');
  assert.equal(stepsForEvent({kind: 'refus', journeyBonus: 1}), 4);
  assert.equal(stepsForEvent({kind: 'entretien', journeyBonus: 1}), -2);
  assert.equal(stepsForEvent({kind: 'candidature', journeyMultiplier: 2}), 4, 'legacy journals keep their doubled travel');
});

test('every action but hiring has a game; each ordinal is offered once', () => {
  const state = {players: [], casts: [], events: []};
  for (const [kind, expected] of [['refus', 'stamp'], ['entretien', 'quiz'], ['rejetApresEntretien', 'ghosting'], ['embauche', null]]) {
    const first = enter(state, {id: `${kind}-1`, playerId: 'me', kind, at: '2026-09-08T12:00:00Z'});
    assert.equal(first.offer, expected, kind);
    if (!expected) continue;
    const won = resolveMiniGame(first.state, `${kind}-1`, 'won');
    assert.ok(won.events.at(-1).journeyBonus > 0);
    const again = enter({...won, events: []}, {id: `${kind}-2`, playerId: 'me', kind, at: '2026-09-08T12:00:00Z'});
    assert.equal(again.offer, null, 'same ordinal, no replay');
    assert.equal(again.state.events.at(-1).journeyBonus, won.events.at(-1).journeyBonus, 'the earned bonus follows the ordinal');
  }
});

test('a chest has one slot-machine attempt; a jackpot adds loot only while the chest is owned', () => {
  const state = {players: [], casts: [], events: [], miniGames: []};
  const first = reserveChestGame(state, 'me', 0, 'event-x');
  assert.equal(first.offer, true);
  assert.equal(reserveChestGame(first.state, 'me', 0, 'event-y').offer, false, 'the chest index is what counts');
  const won = resolveMiniGame(first.state, first.attempt.id, 'won');
  assert.equal(won.events.length, 0, 'a chest game never adds journey steps');
  assert.deepEqual(availablePowers('me', 1, [], won.miniGames).map(p => p.slot), [0, 1000]);
  assert.deepEqual(availablePowers('me', 0, [], won.miniGames), [], 'undoing the chest hides the jackpot');
  assert.deepEqual(availablePowers('me', 1, [{playerId: 'me', slot: 1000}], won.miniGames).map(p => p.slot), [0], 'a cast jackpot is spent');
  assert.equal(resolveMiniGame(first.state, first.attempt.id, 'lost').events.length, 0);
});

test('undo and re-entry restore the earned bonus without another attempt', () => {
  const first = enter({players: [], casts: [], events: []}, application('original'));
  assert.equal(first.offer, 'pigeon');
  const awarded = resolveMiniGame(first.state, 'original', 'won');
  const undone = { ...awarded, events: [] };
  assert.equal(journeyProgress(undone.events).steps, 0);
  const replacement = enter(undone, application('replacement'));
  assert.equal(replacement.offer, null);
  assert.equal(journeyProgress(replacement.state.events).steps, 4);
  assert.equal(resolveMiniGame(replacement.state, 'original', 'won'), replacement.state);
  assert.equal(enter(replacement.state, application('next')).offer, 'keywords');
  assert.equal(enter(replacement.state, application('other', 'companion')).offer, 'pigeon');
});

test('lost, skipped and interrupted attempts keep the base and survive reload/undo', () => {
  for (const result of ['lost', 'skipped', 'pending']) {
    const first = enter({players: [], casts: [], events: []}, application('first'));
    const state = result === 'pending' ? first.state : resolveMiniGame(first.state, 'first', result);
    assert.equal(journeyProgress(state.events).steps, 2);
    const reloaded = JSON.parse(JSON.stringify(state));
    const retry = enter({...reloaded, events: []}, application('retry'));
    assert.equal(retry.offer, null);
    assert.equal(journeyProgress(retry.state.events).steps, 2);
    assert.equal(resolveMiniGame(retry.state, 'first', 'won'), retry.state);
    if (result !== 'pending') assert.equal(resolveMiniGame(state, 'first', 'won'), state);
  }
});

test('journals of the first pigeon game are migrated into the shared attempt list', () => {
  const legacy = {players: [], casts: [], events: [{...application('old'), journeyMultiplier: 2, pigeonFlightId: 'old'}],
    pigeonFlights: [{id: 'old', playerId: 'me', slot: 0, eventId: 'old', result: 'hit'}, {id: 'gone', playerId: 'me', slot: 1, eventId: 'gone', result: 'miss'}]};
  const migrated = migrateMiniGames(legacy);
  assert.equal(migrated.pigeonFlights, undefined);
  assert.deepEqual(migrated.miniGames.map(a => [a.kind, a.action, a.slot, a.result]), [['pigeon', 'candidature', 0, 'won'], ['pigeon', 'candidature', 1, 'lost']]);
  assert.equal(migrated.events[0].miniGameId, 'old');
  assert.equal(journeyProgress(migrated.events).steps, 4, 'the legacy double still counts');
  assert.equal(enter(migrated, application('second')).offer, null, 'a migrated attempt is not replayed');
  assert.equal(migrateMiniGames({players: [], casts: [], events: []}).miniGames, undefined);
});

const GROUND_Y = COURSE.height - COURSE.ground;
function fly(seed, { frameMs = 16.7, jitter = 0, speedScale = 1, pilot = pigeonAutopilot } = {}) {
  const sim = createPigeonSim(seed, { speedScale });
  let noise = seed * 7 + 1;
  const events = [];
  for (let frames = 0; sim.status !== 'delivered' && sim.status !== 'crashed' && frames < 6000; frames++) {
    if (pilot(sim, frames)) events.push(...flapPigeon(sim));
    noise = (noise * 1103515245 + 12345) & 0x7fffffff;
    events.push(...stepPigeon(sim, frameMs + (noise / 0x7fffffff - 0.5) * 2 * jitter));
  }
  return { sim, events };
}

test('every course keeps its gaps inside the arena and within one climb of each other', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const towers = generateTowers(seed);
    assert.equal(towers.length, COURSE.towers);
    let previous = GROUND_Y / 2;
    towers.forEach((tower, i) => {
      assert.ok(tower.gapY - tower.gapHeight / 2 >= COURSE.gapMargin, 'gap below the ceiling margin');
      assert.ok(tower.gapY + tower.gapHeight / 2 <= GROUND_Y - COURSE.gapMargin, 'gap above the ground margin');
      assert.ok(Math.abs(tower.gapY - previous) <= COURSE.maxClimb + 1e-9, 'next gap is reachable');
      assert.equal(tower.x, COURSE.firstTowerX + i * COURSE.towerSpacing);
      previous = tower.gapY;
    });
    assert.ok(towers[0].gapHeight > towers.at(-1).gapHeight, 'towers tighten along the course');
  }
  assert.deepEqual(generateTowers(courseSeed('event-42')), generateTowers(courseSeed('event-42')));
  assert.notDeepEqual(generateTowers(courseSeed('event-42')), generateTowers(courseSeed('event-43')));
});

test('a careful courier delivers every course at any frame rate; a lazy one crashes', () => {
  for (const options of [{}, { frameMs: 33.3, jitter: 8 }, { frameMs: 8.3, jitter: 2 }, { speedScale: 0.75, jitter: 6 }]) {
    for (let seed = 1; seed <= 120; seed++) {
      const { sim, events } = fly(seed, options);
      assert.equal(sim.status, 'delivered', `seed ${seed} ${JSON.stringify(options)}`);
      assert.equal(sim.feathers, COURSE.feathers);
      assert.equal(towersPassed(sim), COURSE.towers);
      assert.equal(events.filter(e => e === 'pass').length, COURSE.towers);
      assert.equal(events.at(-1), 'delivered');
      assert.ok(sim.t > 10_000 && sim.t < 25_000, `a flight lasts a while: ${sim.t}`);
    }
  }
  const lazy = fly(7, { pilot: (sim, frame) => frame === 0 });
  assert.equal(lazy.sim.status, 'crashed');
  assert.equal(lazy.sim.feathers, 0);
  assert.equal(lazy.events.filter(e => e === 'hit').length, COURSE.feathers);
  assert.ok(lazy.sim.y + COURSE.pigeonRadius <= GROUND_Y + 1e-9, 'never below the ground');
  const frantic = fly(7, { pilot: () => true });
  assert.equal(frantic.sim.status, 'crashed');
  assert.ok(frantic.sim.y >= COURSE.pigeonRadius, 'never above the ceiling');
});

test('hits cost one feather each, with a grace period, and the simulation is deterministic', () => {
  const { sim, events } = fly(11, { pilot: (sim, frame) => frame === 0 });
  const hits = [];
  const probe = createPigeonSim(11);
  flapPigeon(probe);
  while (probe.status === 'flying') {
    if (stepPigeon(probe, 8).includes('hit')) hits.push(probe.t);
  }
  assert.equal(hits.length, COURSE.feathers);
  assert.ok(hits[1] - hits[0] >= COURSE.invulnerableMs, 'a second hit waits for the grace period');
  assert.equal(sim.status, probe.status);
  assert.equal(events.filter(e => e === 'hit').length, hits.length);

  const coarse = createPigeonSim(3);
  const fine = createPigeonSim(3);
  flapPigeon(coarse); flapPigeon(fine);
  stepPigeon(coarse, 50);
  for (let i = 0; i < 3; i++) stepPigeon(fine, 16.7);
  assert.equal(coarse.t, fine.t);
  assert.equal(coarse.y, fine.y);
  assert.equal(coarse.distance, fine.distance);
  assert.deepEqual(flapPigeon(createPigeonSim(1)), ['flap']);
  const done = fly(1).sim;
  assert.deepEqual(flapPigeon(done), [], 'a finished flight ignores taps');
});

const { DESK, createDeskSim, stepDesk, slamStamp, deskAutopilot, stampedCount } = await import('../src/lib/game/stamp-desk.ts');
const { RAIN, createRainSim, startRain, steerBasket, stepRain, rainAutopilot } = await import('../src/lib/game/keyword-rain.ts');
const { SLOTS, SLOT_SYMBOLS, createSlotsSim, stepSlots, stopReel, slotsAutopilot, paylineSymbol } = await import('../src/lib/game/slot-machine.ts');
const { GHOSTING, generateGhosting, ghostingPhase, ghostingVerdict, waitingDay } = await import('../src/lib/game/ghosting.ts');
const { QUIZ, QUIZ_BANK, dealQuiz, corporateAnswer, quizPassed } = await import('../src/lib/game/personality-quiz.ts');
const jitterSource = seed => { let a = seed * 7 + 1; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; };
const FRAMES = [{ frameMs: 16.7, jitter: 0 }, { frameMs: 33.3, jitter: 8 }, { frameMs: 8.3, jitter: 2 }];

test('the stamping desk: a punctual clerk clears every belt, a sleeping one is suspended', () => {
  for (const { frameMs, jitter } of FRAMES) {
    for (let seed = 1; seed <= 80; seed++) {
      const sim = createDeskSim(seed);
      const noise = jitterSource(seed);
      for (let frames = 0; sim.status !== 'won' && sim.status !== 'lost' && frames < 5000; frames++) {
        if (deskAutopilot(sim)) slamStamp(sim);
        stepDesk(sim, frameMs + (noise() - 0.5) * 2 * jitter);
      }
      assert.equal(sim.status, 'won', `seed ${seed} at ${frameMs}ms`);
      assert.equal(sim.misses, 0);
      assert.equal(stampedCount(sim), DESK.dossiers);
      assert.ok(sim.t > 8000 && sim.t < 14000, `a belt lasts a while: ${sim.t}`);
    }
  }
  const lazy = createDeskSim(3);
  assert.deepEqual(slamStamp(lazy), ['start']);
  while (lazy.status === 'running') stepDesk(lazy, 16.7);
  assert.equal(lazy.status, 'lost');
  assert.equal(lazy.misses, DESK.missesAllowed);
  const frantic = createDeskSim(3);
  slamStamp(frantic);
  stepDesk(frantic, 200);
  assert.deepEqual(slamStamp(frantic), ['void'], 'stamping the empty belt is a miss');
  assert.deepEqual(slamStamp(frantic), [], 'the stamp needs to lift before the next slam');
});

test('the keyword rain: a reader catches the ad, an idle folder does not; traps need a square landing', () => {
  for (const { frameMs, jitter } of FRAMES) {
    for (let seed = 1; seed <= 80; seed++) {
      const sim = createRainSim(seed);
      startRain(sim);
      const noise = jitterSource(seed);
      for (let frames = 0; sim.status === 'running' && frames < 8000; frames++) {
        const target = rainAutopilot(sim);
        if (target !== null) steerBasket(sim, target);
        stepRain(sim, frameMs + (noise() - 0.5) * 2 * jitter);
      }
      assert.equal(sim.status, 'won', `seed ${seed} at ${frameMs}ms`);
      assert.equal(sim.caught.length, RAIN.required);
      assert.ok(sim.badCaught <= RAIN.badAllowed);
    }
  }
  const idle = createRainSim(5);
  startRain(idle);
  while (idle.status === 'running') stepRain(idle, 16.7);
  assert.equal(idle.status, 'lost');
  assert.ok(idle.caught.length < RAIN.required);
  assert.equal(new Set(createRainSim(9).required).size, RAIN.required, 'five distinct words are asked for');
  const half = RAIN.basketWidth / 2;
  steerBasket(createRainSim(1), -500);
  const clamped = createRainSim(1);
  steerBasket(clamped, 10_000);
  assert.equal(clamped.targetX, RAIN.width - half);
});

test('the slot machine: timing lands the jackpot, blind stops almost never do', () => {
  for (const { frameMs, jitter } of FRAMES) {
    for (let seed = 1; seed <= 80; seed++) {
      const sim = createSlotsSim(seed);
      const noise = jitterSource(seed);
      for (let frames = 0; sim.status !== 'won' && sim.status !== 'lost' && frames < 5000; frames++) {
        if (slotsAutopilot(sim)) stopReel(sim);
        stepSlots(sim, frameMs + (noise() - 0.5) * 2 * jitter);
      }
      assert.equal(sim.status, 'won', `seed ${seed} at ${frameMs}ms`);
      assert.ok(sim.reels.every(reel => paylineSymbol(reel) === 'CHF'));
      assert.ok(sim.t < 5000, 'three timed stops are quick');
    }
  }
  let blind = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const sim = createSlotsSim(seed);
    stopReel(sim);
    for (let reel = 0; reel < SLOTS.reels; reel++) { stepSlots(sim, 400 + seed * 3 + reel * 170); stopReel(sim); }
    if (sim.status === 'won') blind++;
  }
  assert.ok(blind < 20, `luck alone: ${blind}/300`);
  const sim = createSlotsSim(2);
  assert.ok(sim.reels.every(reel => reel.symbols.filter(s => s === 'CHF').length === 2 && reel.symbols.length === SLOT_SYMBOLS.length + 1));
  assert.deepEqual(stopReel(sim), ['start']);
  assert.deepEqual(stopReel(sim), ['stop']);
  assert.equal(sim.reels[0].stopped, true);
  assert.equal(Number.isInteger(sim.reels[0].offset), true, 'a stopped reel snaps to a symbol');
});

test('the ghosting wait: bursts never touch the real message; only the window wins', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const schedule = generateGhosting(seed);
    assert.ok(schedule.messageAt >= GHOSTING.messageAt[0] && schedule.messageAt <= GHOSTING.messageAt[1]);
    const bursts = [...schedule.fakes].sort((a, b) => a.at - b.at);
    assert.ok(bursts.length >= GHOSTING.fakes[0] && bursts.length <= GHOSTING.fakes[1]);
    bursts.forEach((burst, i) => {
      assert.ok(burst.at >= 1000);
      assert.ok(burst.at + burst.duration < schedule.messageAt - 1000, 'a burst ends well before the message');
      if (i) assert.ok(burst.at >= bursts[i - 1].at + bursts[i - 1].duration, 'bursts do not overlap');
    });
    assert.equal(ghostingPhase(schedule, bursts[0].at + 10), 'typing');
    assert.equal(ghostingVerdict(schedule, bursts[0].at + 10), 'early');
    assert.equal(ghostingVerdict(schedule, schedule.messageAt + GHOSTING.windowMs / 2), 'won');
    assert.equal(ghostingVerdict(schedule, schedule.messageAt + GHOSTING.windowMs + 1), 'late');
    assert.equal(ghostingPhase(schedule, schedule.messageAt + GHOSTING.windowMs + 1), 'gone');
  }
  assert.equal(waitingDay(0), 1);
  assert.equal(waitingDay(GHOSTING.msPerDay * 13), 14);
});

test('the personality test deals distinct questions whose corporate answer is findable', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const dealt = dealQuiz(seed);
    assert.equal(dealt.length, QUIZ.questions);
    assert.equal(new Set(dealt.map(q => q.prompt)).size, QUIZ.questions, 'no repeated question');
    for (const question of dealt) {
      assert.equal(question.answers.length, 4);
      assert.equal(question.answers[question.correct], corporateAnswer(question.prompt));
      seen.add(question.correct);
    }
  }
  assert.equal(seen.size, 4, 'the corporate answer moves around');
  assert.ok(QUIZ_BANK.length >= 20);
  assert.equal(quizPassed(QUIZ.needed), true);
  assert.equal(quizPassed(QUIZ.needed - 1), false);
  assert.deepEqual(dealQuiz(7), dealQuiz(7), 'the same attempt always shows the same test');
});

const { eventsInMonth, eventMonthKey } = await import('../src/lib/game/standings.ts');
test('month keys follow Zurich time and are cached per instant', () => {
  const events = [
    { id: 'a', kind: 'refus', at: '2026-08-31T21:59:00Z' },
    { id: 'b', kind: 'refus', at: '2026-08-31T22:01:00Z' },
    { id: 'c', kind: 'refus', at: '2026-09-15T12:00:00Z' },
  ];
  assert.equal(eventMonthKey('2026-08-31T22:01:00Z'), '2026-09', 'midnight in Zurich is 22:00 UTC in summer');
  assert.deepEqual(eventsInMonth(events, '2026-08').map(e => e.id), ['a']);
  assert.deepEqual(eventsInMonth(events, '2026-09').map(e => e.id), ['b', 'c']);
  assert.equal(eventMonthKey('2026-08-31T21:59:00Z'), '2026-08', 'a cached answer stays right');
});

const { VARIANTS, variantFor, RARITY_ODDS } = await import('../src/lib/game/variants.ts');
test('variants are drawn from the event id with the promised rarity odds', () => {
  for (const [action, variants] of Object.entries(VARIANTS)) {
    assert.ok(variants.length >= 3, `${action} has several stagings`);
    assert.equal(new Set(variants.map(v => v.id)).size, variants.length);
    assert.ok(variants.every(v => v.action === action));
  }
  const counts = { common: 0, rare: 0, legendary: 0 };
  const seen = new Set();
  for (let i = 0; i < 6000; i++) {
    const variant = variantFor(`event-${i}`, 'refus');
    counts[variant.rarity]++;
    seen.add(variant.id);
  }
  for (const rarity of ['common', 'rare', 'legendary']) {
    const share = counts[rarity] / 6000;
    assert.ok(Math.abs(share - RARITY_ODDS[rarity]) < 0.025, `${rarity}: ${share}`);
  }
  assert.equal(seen.size, VARIANTS.refus.length, 'every variant can happen');
  assert.deepEqual(variantFor('abc', 'candidature'), variantFor('abc', 'candidature'), 'the same event shows the same variant everywhere');
});

const { daylightAt, zurichHour } = await import('../src/lib/game/daylight.ts');
test('the world follows the time of day in Zurich', () => {
  assert.equal(zurichHour(new Date('2026-09-24T20:30:00Z')), 22.5, 'Zurich is two hours ahead in summer');
  assert.equal(zurichHour(new Date('2026-12-24T20:30:00Z')), 21.5, 'and one in winter');
  assert.ok(daylightAt(23).night > 0.99 && daylightAt(3).night > 0.99, 'night');
  assert.ok(daylightAt(13).night < 0.01 && daylightAt(13).warm < 0.01, 'plain day at noon');
  assert.ok(daylightAt(19.6).warm > 0.99, 'golden evening');
  assert.ok(daylightAt(6.5).warm > 0.99, 'warm dawn');
  let previous = daylightAt(0);
  for (let hour = 0.25; hour <= 24; hour += 0.25) {
    const next = daylightAt(hour);
    assert.ok(Math.abs(next.night - previous.night) < 0.3 && Math.abs(next.warm - previous.warm) < 0.3, `smooth at ${hour}`);
    previous = next;
  }
});
