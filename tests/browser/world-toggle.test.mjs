import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3100';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

async function fixture(browser, steps = 4, viewport = { width: 1280, height: 800 }, prepare = async () => {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(steps => {
    localStorage.setItem('louchomage:renderer-choice:v1', '1');
    if (localStorage.getItem('louchomage:v2')) return;
    const at = new Date().toISOString();
    localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
    localStorage.setItem('louchomage:moi:v1', 'test');
    localStorage.setItem('louchomage:v2', JSON.stringify({
      players: [{ id: 'test', name: 'Camille', characterId: 'barde', joinedAt: at }, { id: 'lou', name: 'Lou', characterId: 'skater', joinedAt: at }],
      events: Array.from({ length: steps / 2 }, (_, i) => ({ id: `seed-${i}`, playerId: 'test', kind: 'candidature', at })), casts: [],
      discoveries: [{ playerId: 'test', itemId: 'hidden:0:plaine', at }],
      daily: [{ id: 'daily', playerId: 'test', day: '2026-10-29', kind: 'snake', score: 7, at }],
      miniGames: [{ id: 'played', playerId: 'test', eventId: 'seed-0', kind: 'pigeon', action: 'candidature', slot: 1, result: 'skipped', score: 3 }],
      encounters: [{ id: 'captured', playerId: 'test', eventId: 'seed-0', slot: 1, monster: 'cv', rare: true, place: 'plaine', at, capturedAt: at, status: 'captured', hp: 0, energy: 3, turn: 2, balls: 1, braced: false, message: 'Capturé' }],
    }));
  }, steps);
  await prepare(page);
  await page.goto(`${url}/local?debug&hour=12&variant=classic`);
  await ready(page, '2d');
  const recap = page.locator('.recap__close');
  if (await recap.count()) await recap.click();
  return { page, context, errors };
}
async function ready(page, mode) {
  await page.waitForFunction(mode => window.__worldView?.().phase === 'ready' && window.__worldView().mode === mode, mode, { timeout: 60000 });
}
async function snapshot(page) {
  return page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem('louchomage:v2')), world: window.__worldView() }));
}
async function change(page, mode) {
  await page.evaluate(() => {
    const canvas = document.querySelector('.world-view canvas');
    window.__previousGL = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
  });
  await page.getByRole('button', { name: mode.toUpperCase(), exact: true }).click();
  await ready(page, mode);
  const result = await page.evaluate(() => ({
    ...window.__worldView(), canvases: document.querySelectorAll('.world-view canvas').length,
    pixi: Boolean(window.__pixiApp), voxel: Boolean(window.__voxelWorld),
  }));
  assert.equal(result.canvases, 1);
  assert.equal(await page.evaluate(() => window.__previousGL?.isContextLost() ?? true), true, 'old GPU context is lost');
  await page.evaluate(() => { delete window.__previousGL; });
  assert.equal(result.pixi, mode === '2d');
  assert.equal(result.voxel, mode === '3d');
  assert.ok(Object.values(result.lastRelease).every(value => value === 0), JSON.stringify(result.lastRelease));
  return result;
}

test('world toggle preserves one game, frees old resources, fits the viewport and survives reload', { timeout: 180000 }, async t => {
  const browser = await chromium.launch({ executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  const { page, context, errors } = await fixture(browser);
  const initial = await snapshot(page);
  await mkdir('/tmp/louchomage-world-toggle', { recursive: true });
  await page.evaluate(() => {
    window.__sawWorldLoader = false;
    window.__loaderObserver = new MutationObserver(() => { if (document.querySelector('.world-loader')) window.__sawWorldLoader = true; });
    window.__loaderObserver.observe(document.querySelector('.world-view'), { childList: true, subtree: true });
  });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['3d', '2d']) {
      const world = await change(page, mode);
      assert.deepEqual(world.players, initial.world.players);
      assert.deepEqual((await snapshot(page)).saved, initial.saved);
      const layout = await page.locator('.world-mode-switch').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
      });
      assert.ok(layout.left >= 0 && layout.right <= layout.width && layout.top >= 0 && layout.bottom <= layout.height);
      if (mode === '3d') {
        const x = await page.evaluate(() => window.__voxelWorld.actors.find(actor => actor.id === 'test').x);
        assert.ok(Math.abs(x - initial.world.players[0].x) < .01);
      }
      await page.screenshot({ path: `/tmp/louchomage-world-toggle/${viewport.width}-${mode}.png` });
    }
  }
  assert.equal(await page.evaluate(() => window.__sawWorldLoader), true);
  // Camera browsing is transient view state; it survives the switch without moving a player.
  await page.evaluate(() => { window.__decorScene.exploreCenter = 900; });
  await change(page, '3d');
  assert.equal(await page.evaluate(() => window.__worldView().exploreCenter), 900);
  await change(page, '2d');
  assert.equal(await page.evaluate(() => window.__worldView().exploreCenter), 900);
  await change(page, '3d');
  await page.reload(); await ready(page, '3d');
  assert.equal(await page.getByRole('button', { name: '3D', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual((await snapshot(page)).saved, initial.saved);
  assert.deepEqual(errors, []); await context.close();
});

test('interiors and repeated laps keep the same canonical position in both renderers', { timeout: 240000 }, async t => {
  const browser = await chromium.launch({ executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  for (const [steps, room] of [[12, 'orp'], [34, 'factory'], [48, null], [68, null], [92, null], [116, null], [140, null], [158, null], [172, null], [190, 'tavern'], [212, 'orp']]) {
    const { page, context, errors } = await fixture(browser, steps);
    const initial = await snapshot(page);
    assert.equal(initial.world.players[0].room, room);
    const world = await change(page, '3d');
    assert.deepEqual(world.players, initial.world.players);
    const rendered = await page.evaluate(() => ({ x: window.__voxelWorld.actors.find(a => a.id === 'test').x, room: window.__voxelWorld.room }));
    assert.ok(Math.abs(rendered.x - initial.world.players[0].x) < .01);
    assert.equal(rendered.room, room);
    await change(page, '2d');
    assert.equal(await page.evaluate(() => window.__decorScene.room?.id ?? null), room);
    assert.deepEqual((await snapshot(page)).saved, initial.saved);
    assert.deepEqual(errors, []); await context.close();
  }
});

test('a switch requested during an action waits for completion and keeps the resulting progress', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  const { page, context, errors } = await fixture(browser, 10);
  await page.locator('.action-button--refus').click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.locator('.world-switch-pending').waitFor();
  assert.equal(await page.evaluate(() => window.__worldView().mode), '2d');
  await page.locator('.wild-encounter[open], .roadside-invite[open]').waitFor();
  await page.keyboard.press('Escape');
  await ready(page, '3d');
  assert.equal((await snapshot(page)).world.players[0].steps, 13);
  assert.equal(await page.evaluate(() => window.__voxelWorld.room), 'orp');
  await page.locator('.action-button--candidature').click();
  await page.locator('.wild-encounter[open], .roadside-invite[open]').waitFor();
  await page.keyboard.press('Escape');
  await change(page, '2d');
  assert.equal((await snapshot(page)).world.players[0].steps, 15);
  await page.locator('.action-undo').click();
  await page.waitForFunction(() => Math.abs(window.__decorScene.heroes.get('test').x - (13 * 30240 / 200 - 80)) < .5);
  assert.equal((await snapshot(page)).world.players[0].steps, 13);
  assert.deepEqual(errors, []); await context.close();
});

test('a failed 3D initialization offers a working 2D fallback without touching the save', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  const { page, context, errors } = await fixture(browser);
  const initial = await snapshot(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    window.__restoreContext = () => { HTMLCanvasElement.prototype.getContext = original; };
    HTMLCanvasElement.prototype.getContext = function(kind, ...options) { return kind === 'webgl2' ? null : original.call(this, kind, ...options); };
  });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: 'Ouvrir en 2D', exact: true }).waitFor();
  await page.evaluate(() => window.__restoreContext());
  await page.getByRole('button', { name: 'Ouvrir en 2D', exact: true }).click();
  await ready(page, '2d');
  assert.equal(await page.getByRole('button', { name: '2D', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual((await snapshot(page)).saved, initial.saved);
  assert.deepEqual(errors, []); await context.close();
});


test('slow scenery downloads do not trap the switch or reanimate a retired 2D renderer', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  const delayed = [];
  const { page, context, errors } = await fixture(browser, 4, undefined, async page => {
    await page.route('**/art/world-v3/runtime/plaine-*.webp', route => { delayed.push(route); });
  });
  assert.ok(delayed.length > 0);
  const started = Date.now();
  await change(page, '3d');
  assert.ok(Date.now() - started < 12000, 'scenery downloads must not hold the transition hostage');
  await page.unroute('**/art/world-v3/runtime/plaine-*.webp');
  await Promise.all(delayed.map(route => route.continue().catch(() => {})));
  await change(page, '2d');
  assert.equal((await snapshot(page)).world.players[0].steps, 4);
  assert.deepEqual(errors, []); await context.close();
});

test('losing the active GPU context releases the renderer and can recover the same game', { timeout: 90000 }, async t => {
  const browser = await chromium.launch({ executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  const { page, context, errors } = await fixture(browser);
  const initial = await snapshot(page);
  await change(page, '3d');
  await page.evaluate(() => document.querySelector('.voxel-world canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByRole('button', { name: 'Ouvrir en 2D', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ouvrir en 2D', exact: true }).click();
  await ready(page, '2d');
  assert.deepEqual((await snapshot(page)).saved, initial.saved);
  assert.deepEqual(errors, []); await context.close();
});

test('a new character can enter, finish onboarding and play in either initial renderer', { timeout: 120000 }, async t => {
  const browser = await chromium.launch({ executablePath, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  for (const mode of ['2d', '3d']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(mode => { localStorage.setItem('louchomage:renderer:v1', mode); localStorage.setItem('louchomage:renderer-choice:v1', '1'); }, mode);
    await page.goto(`${url}/local?debug&hour=12&variant=classic`);
    await page.getByPlaceholder('Mika').fill('Camille');
    await page.getByRole('button', { name: 'Entrer dans la partie', exact: true }).click();
    await page.getByRole('button', { name: 'Passer l’initiation' }).click();
    await page.waitForFunction(() => document.querySelector('.action-button--candidature')?.disabled === false);
    await page.locator('.action-button--candidature').click();
    await page.locator('.wild-encounter[open], .roadside-invite[open]').waitFor();
    await page.keyboard.press('Escape');
    const other = mode === '2d' ? '3d' : '2d';
    await change(page, other);
    assert.equal((await snapshot(page)).world.players[0].steps, 2);
    assert.deepEqual(errors, []); await context.close();
  }
});
