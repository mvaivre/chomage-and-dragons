import test from 'node:test';
import assert from 'node:assert/strict';
import { Ticker } from 'pixi.js';
import { heroFrame } from '../src/components/game/animation.ts';
import { subscribeTick } from '../src/components/game/tickSubscription.ts';
import { frameComposition, chestXForStep } from '../src/components/game/projection.ts';

test('all animation states address valid poses and movement has four distinct drawings', () => {
  for (const motion of ['idle', 'walk', 'send', 'hurt', 'celebrate']) {
    for (let step = 0; step <= 100; step++) {
      const frame = heroFrame(motion, step * 0.1, step / 100);
      assert.ok(Number.isInteger(frame) && frame >= 0 && frame < 16);
    }
  }
  assert.equal(new Set([0, 1, 2, 3].map(i => heroFrame('walk', i / 9))).size, 4);
  assert.notEqual(heroFrame('idle', 4.6), heroFrame('idle', 0));
});

test('lowest lane and name plate stay above the action dock in portrait, tall and landscape views', () => {
  for (const [w, h, top, bottom] of [[320, 568, 215, 220], [320, 740, 170, 210], [390, 844, 175, 230], [900, 1400, 235, 275], [1280, 720, 200, 180], [1920, 900, 235, 210], [844, 390, 90, 100]]) {
    const { scale, screenOffsetY } = frameComposition(w, h, top, bottom, 602);
    const feet = (602 + 48) * scale + screenOffsetY;
    const labelBottom = feet + 38 * scale;
    assert.ok(labelBottom + 12 <= h - bottom, `${w}×${h}: label overlaps dock`);
    assert.ok(feet - (164 + 48) * scale > top, `${w}×${h}: character overlaps the HUD`);
  }
});

test('chest milestones keep advancing after each itinerary traversal', () => {
  for (let steps = 10; steps <= 200; steps += 10) {
    const x = chestXForStep(steps, 15120, 80);
    assert.equal(x, steps / 80 * 15120 + 110);
  }
  assert.ok(chestXForStep(90, 15120, 80) > chestXForStep(80, 15120, 80));
});

test('ticker cleanup remains safe when the application is destroyed before its children', () => {
  const ticker = new Ticker();
  const release = subscribeTick(ticker, () => {});
  assert.equal(ticker.count, 1);
  ticker.destroy();
  assert.doesNotThrow(release);
});

test('ticker subscriptions preserve priority and remove only their own callback', () => {
  const ticker = new Ticker();
  const order = [];
  const releaseLayer = subscribeTick(ticker, () => order.push('layer'), 0);
  const releaseCamera = subscribeTick(ticker, () => order.push('camera'), 50);
  const releaseHero = subscribeTick(ticker, () => order.push('hero'), 100);
  ticker.update(performance.now());
  assert.deepEqual(order, ['hero', 'camera', 'layer']);
  releaseCamera();
  assert.equal(ticker.count, 2);
  releaseLayer(); releaseHero();
  assert.equal(ticker.count, 0);
  ticker.destroy();
});

test('every playable character has a compiled animation sheet with matching scale metadata', async () => {
  const { CHARACTERS } = await import('../src/lib/game/characters.ts');
  const { CHARACTER_ANIMATIONS, poseFacing } = await import('../src/components/game/animation.ts');
  const { readFile, stat } = await import('node:fs/promises');
  for (const character of CHARACTERS) {
    const animation = CHARACTER_ANIMATIONS[character.id];
    assert.ok(animation, `Missing animation for ${character.id}`);
    const file = new URL(`../public${animation.url}`, import.meta.url);
    assert.ok((await stat(file)).size > 0);
    const meta = JSON.parse(await readFile(new URL(file.href.replace('.webp', '.json')), 'utf8'));
    assert.equal(meta.count, 16);
    assert.equal(animation.referenceHeight, meta.referenceHeight);
    assert.equal(animation.baseline, meta.baseline);
  }
  assert.equal(poseFacing('squelette', 0), -1);
  assert.equal(poseFacing('squelette', 2), 1);
});
