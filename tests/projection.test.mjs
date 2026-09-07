import test from 'node:test';
import assert from 'node:assert/strict';
import { parallaxX, visibleTiles, renderResolution } from '../src/components/game/projection.ts';

test('the point at the camera centre remains centred in all depth planes and aspect ratios', () => {
  for (const width of [560, 960, 1280, 2560]) {
    for (const factor of [0.16, 0.36, 0.76, 1, 1.12]) {
      assert.equal(parallaxX(7500, 7500 - width / 2, width, factor), width / 2);
    }
  }
});

test('camera travel moves each layer at its declared speed', () => {
  for (const factor of [0.16, 0.36, 0.76, 1, 1.12]) {
    const before = parallaxX(1000, 200, 1280, factor);
    const after = parallaxX(1000, 400, 1280, factor);
    assert.ok(Math.abs(before - after - 200 * factor) < 1e-9);
  }
});

test('slow layers can show a biome several world screens away', () => {
  assert.ok(parallaxX(4400, 0, 1280, 0.16) < 1280);
  assert.ok(parallaxX(4400, 0, 1280, 1) > 1280);
});

test('ground tiles cover the complete viewport, including world edges and wide cameras', () => {
  for (const width of [560, 1280, 2560]) {
    for (const tileWidth of [1672, 2065]) {
      for (let camera = -240; camera < 15500; camera += 137) {
        const [first, last] = visibleTiles(camera, width, tileWidth, -1280);
        assert.ok(-1280 + first * tileWidth <= camera);
        assert.ok(-1280 + (last + 1) * tileWidth >= camera + width);
        assert.ok(last - first + 1 <= Math.ceil(width / tileWidth) + 3);
      }
    }
  }
});

test('framebuffer stays within three million pixels across resize and retina devices', () => {
  for (const [width, height] of [[390, 844], [844, 390], [1280, 720], [1920, 900], [3440, 1440]]) {
    for (const ratio of [1, 2, 3]) {
      const resolution = renderResolution(width, height, ratio);
      assert.ok(width * height * resolution ** 2 <= 3_000_001);
      assert.ok(resolution <= ratio);
    }
  }
});
