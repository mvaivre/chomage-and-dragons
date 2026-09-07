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
