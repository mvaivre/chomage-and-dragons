import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) {
  if (c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`, c);
  return next(s, c);
} });
const { createDragonLesson, advanceDragonLesson, steerDragonLesson, DRAGON_RITE_LANES, DRAGON_RITE,
  INITIATION_ENCOUNTERS, initiationSteps, answerInitiation, createInitiationProgress, parseInitiationProgress, initiationStorageKey } = await import('../src/lib/game/initiation.ts');

test('the dragon rite requires steering into every ring and cannot fail', () => {
  const run = createDragonLesson();
  const ready = structuredClone(run);
  steerDragonLesson(run, -1); advanceDragonLesson(run, 10);
  assert.deepEqual(run, ready, 'ready flight does not move');
  run.status = 'flying';
  run.ringX = DRAGON_RITE.heroX + 1;
  advanceDragonLesson(run, .1);
  assert.equal(run.misses, 1);
  assert.equal(run.collected, 0);
  assert.equal(run.ringX, DRAGON_RITE.startX);
  for (const target of DRAGON_RITE_LANES) {
    while (run.lane !== target) steerDragonLesson(run, target - run.lane);
    run.ringX = DRAGON_RITE.heroX + 1;
    advanceDragonLesson(run, .1);
  }
  assert.equal(run.status, 'done');
  const won = structuredClone(run);
  steerDragonLesson(run, 1); advanceDragonLesson(run, 10);
  assert.deepEqual(run, won);
});

test('dragon flight stays bounded, rejects malformed input and caps background-frame jumps', () => {
  const run = createDragonLesson(); run.status = 'flying';
  steerDragonLesson(run, -999); steerDragonLesson(run, -999);
  assert.equal(run.lane, 0);
  steerDragonLesson(run, 999); steerDragonLesson(run, 999); steerDragonLesson(run, 999);
  assert.equal(run.lane, 2);
  const old = structuredClone(run);
  steerDragonLesson(run, NaN); advanceDragonLesson(run, Infinity); advanceDragonLesson(run, -2);
  assert.deepEqual(run, old);
  advanceDragonLesson(run, 999);
  assert.equal(run.ringX, DRAGON_RITE.startX - DRAGON_RITE.speed * .1);
});

test('practice teaches the official steps, including the interview retreat and chest threshold', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(initiationSteps), [2, 4, 7, 4, 10]);
  INITIATION_ENCOUNTERS.forEach((encounter, i) => {
    assert.equal(answerInitiation(i, encounter.kind), true);
    assert.equal(answerInitiation(i, 'embauche'), false);
  });
  assert.equal(answerInitiation(20, 'refus'), false);
});

test('resume isolates players and never bypasses an unfinished rite', () => {
  assert.notEqual(initiationStorageKey('group:one'), initiationStorageKey('group:two'));
  for (const value of [null, '{', '[]', 'null', '{"stage":2,"crownDone":true}']) {
    assert.deepEqual(parseInitiationProgress(value), createInitiationProgress());
  }
  const saved = { stage: 2, dragonDone: true, encounters: 4, chestOpen: true, powerCast: true, crownDone: false };
  assert.deepEqual(parseInitiationProgress(JSON.stringify(saved)), saved);
  const interrupted = { ...saved, encounters: 2, powerCast: true, crownDone: true };
  assert.deepEqual(parseInitiationProgress(JSON.stringify(interrupted)), { stage: 1, dragonDone: true, encounters: 2, chestOpen: false, powerCast: false, crownDone: false });
});
