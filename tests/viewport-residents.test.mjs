import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseViewportResidents } from '../src/lib/game/viewport-residents.ts';
const resident = (id, kind, left, right, depth = 1, reacting = false) => ({ id, kind, left, right, top: 150, bottom: 400, depth, reacting });
const select = (candidates, previous = new Map(), width = 1280) => chooseViewportResidents(candidates, previous, width, 100, 600);

test('one individual per appearance across layers, with room for distinct species', () => {
  const picked = select([resident('back', 'goat', 200, 280, .76), resident('front', 'goat', 400, 500), resident('yeti', 'yeti', 700, 800)]);
  assert.deepEqual([...picked], [['goat', 'front'], ['yeti', 'yeti']]);
});
test('panning keeps the same individual until its full silhouette leaves the viewport', () => {
  const prior = new Map([['squirrel', 'old']]);
  const next = resident('next', 'squirrel', 650, 700);
  assert.equal(select([resident('old', 'squirrel', -40, 1), next], prior).get('squirrel'), 'old');
  assert.equal(select([resident('old', 'squirrel', -41, 0), next], prior).get('squirrel'), 'next');
  assert.equal(select([next], prior).get('squirrel'), 'next', 'unmounted actors never reserve their type');
});
test('an offscreen or HUD-hidden resident cannot suppress an in-view character', () => {
  const candidates = [resident('right', 'fox', 1280, 1400), resident('left', 'fox', -100, 0),
    { ...resident('hud', 'fox', 300, 400), bottom: 100 }, { ...resident('dock', 'fox', 400, 500), top: 600 }, resident('visible', 'fox', 200, 300)];
  assert.deepEqual([...select(candidates, new Map([['fox', 'right']]))], [['fox', 'visible']]);
  assert.equal(select([resident('x', 'fox', 500, 600)], new Map(), 390).size, 0);
});
test('a conversation keeps its resident ahead of an otherwise preferred duplicate', () => {
  const background = resident('speaker', 'ghost', 200, 300, .76, true);
  const foreground = resident('other', 'ghost', 500, 600);
  const picked = select([foreground, background]);
  assert.equal(picked.get('ghost'), 'speaker');
  assert.equal(select([{ ...foreground, reacting: true }, background], picked).get('ghost'), 'speaker');
});
