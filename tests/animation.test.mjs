import test from 'node:test';
import assert from 'node:assert/strict';
import { Ticker } from 'pixi.js';
import { heroFrame } from '../src/components/game/animation.ts';
import { gnomeFrame, crownedChickenFrame } from '../src/components/game/ambient-animation.ts';
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

test('background gestures stay in their own atlas row and leave quiet intervals', () => {
  for (const [pose, start, count] of [[t => gnomeFrame(0, t), 0, 4], [t => gnomeFrame(1, t), 4, 4], [crownedChickenFrame, 0, 4]]) {
    const observed = new Set();
    let idle = 0;
    for (let i = 0; i < 2600; i++) {
      const frame = pose(i / 20);
      assert.ok(Number.isInteger(frame) && frame >= start && frame < start + count);
      observed.add(frame);
      if (frame === start) idle++;
    }
    assert.equal(observed.size, count);
    assert.ok(idle > 400, 'gestures must leave a rest interval');
  }
});

test('ambient atlases have transparent gutters and registered feet across character poses', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const sharp = require(require.resolve('sharp', { paths: [require.resolve('next/package.json')] }));
  const { readFile } = await import('node:fs/promises');
  for (const name of ['gnomes', 'tavern-life']) {
    const base = new URL(`../public/art/world-v3/animations/${name}`, import.meta.url);
    const meta = JSON.parse(await readFile(`${base.pathname}.json`, 'utf8'));
    const { data, info } = await sharp(`${base.pathname}.webp`).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    assert.equal(info.width, meta.columns * meta.width);
    assert.equal(info.height, meta.rows * meta.height);
    assert.equal(meta.heights.length, 8);
    const feet = [];
    for (let cell = 0; cell < 8; cell++) {
      let bottom = 0, opaque = 0;
      for (let y = 0; y < meta.height; y++) for (let x = 0; x < meta.width; x++) {
        const alpha = data[(((Math.floor(cell / 4) * meta.height + y) * info.width + cell % 4 * meta.width + x) * 4) + 3];
        if (x === 0 || x === meta.width - 1 || y === 0 || y === meta.height - 1) assert.equal(alpha, 0, `${name}:${cell} touches gutter`);
        if (alpha > 128) { bottom = y; opaque++; }
      }
      assert.ok(opaque > 300, `${name}:${cell} is empty`);
      feet.push(bottom);
    }
    for (const row of name === 'gnomes' ? [0, 1] : [0]) {
      const baseline = feet.slice(row * 4, row * 4 + 4);
      assert.ok(Math.max(...baseline) - Math.min(...baseline) <= 8, `${name}: feet jump between poses`);
      assert.ok(Math.max(...baseline) <= meta.baseline + 2);
    }
  }
});

test('lowest lane and name plate stay above the action dock in portrait, tall and landscape views', () => {
  for (const [w, h, top, bottom] of [[320, 568, 215, 220], [320, 740, 170, 210], [390, 844, 175, 230], [900, 1400, 235, 275], [1280, 720, 200, 180], [1920, 900, 235, 210], [844, 390, 90, 100]]) {
    const { scale, screenOffsetY } = frameComposition(w, h, top, bottom, 602);
    const feet = (602 + 48) * scale + screenOffsetY;
    const labelBottom = feet + 38 * scale;
    assert.ok(labelBottom + (w <= 760 || h <= 500 ? 40 : 12) <= h - bottom, `${w}×${h}: label overlaps dock`);
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
