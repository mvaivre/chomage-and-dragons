import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.env.GAME_TEST_URL ?? 'http://localhost:3000';

test('lava and fire respect their geometry budget while flames and light stay smooth', {timeout: 60000}, async t => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const at = new Date().toISOString();
    localStorage.setItem('louchomage:moi:v1', 'test');
    localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
    localStorage.setItem('louchomage:v2', JSON.stringify({
      players: [{id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at}],
      events: Array.from({length: 84}, (_, i) => ({id: `a${i}`, playerId: 'test', kind: 'candidature', at})),
      casts: [],
    }));
  });
  await page.goto(`${url}/local?debug&hour=12`);
  await page.waitForFunction(() => window.__pixiApp && document.querySelector('.action-button--refus') && !document.querySelector('.action-button--refus').disabled);
  await page.evaluate(() => { window.__decorScene.exploreCenter = 25250.4; window.__decorScene.pan = 0; });
  const button = page.locator('[data-environment-id^="nest:"]');
  await button.waitFor();
  for (let i = 0; i < 3; i++) { await button.focus(); await page.keyboard.press('Enter'); }
  await page.waitForFunction(() => window.__pixiApp.stage.getChildByLabel('dragon-fire', true)?.visible && window.__pixiApp.stage.getChildByLabel('volcano:lava', true)?.children.at(-1).context.instructions.length > 0);
  const saved = await page.evaluate(() => localStorage.getItem('louchomage:v2'));

  const measurements = await page.evaluate(() => {
    const app = window.__pixiApp, scene = window.__decorScene;
    const fire = app.stage.getChildByLabel('dragon-fire', true);
    const flame = fire.getChildByLabel('dragon-fire-body');
    const light = app.stage.getChildByLabel('volcano:light:ground', true).children[0];
    const target = [...window.__viewportResidents.values()].find(r => r.kind === 'dragon:red').target.current;
    const nodes = {
      lava: app.stage.getChildByLabel('volcano:lava', true).children.at(-1),
      eruption: app.stage.getChildByLabel('volcano:eruption', true).children.at(-1),
      sparks: fire.getChildByLabel('dragon-flames'),
    };
    let counts, blends = 0, pulses = 0, previousBlend = flame.alpha, previousLight = light.alpha;
    const originals = new Map();
    const observe = () => {
      if (flame.alpha !== previousBlend) blends++;
      if (light.alpha !== previousLight) pulses++;
      previousBlend = flame.alpha; previousLight = light.alpha;
    };
    const reduced = scene.reducedMotion, lowPower = scene.lowPower;
    app.ticker.stop();
    for (const [key, node] of Object.entries(nodes)) {
      originals.set(node, node.clear);
      node.clear = function (...args) { counts[key]++; return originals.get(node).apply(this, args); };
    }
    app.ticker.add(observe, undefined, -15);
    const run = (hz, still = false, software = false) => {
      counts = {lava: 0, eruption: 0, sparks: 0}; blends = 0; pulses = 0;
      scene.reducedMotion = still; scene.lowPower = software;
      const start = app.ticker.lastTime;
      for (let i = 1; i <= hz * 2; i++) {
        // Drive the real scene ticker deterministically, independently of the host GPU.
        target.startedAt = performance.now() - 1000;
        scene.lastMotion = performance.now();
        app.ticker.maxFPS = 0;
        app.ticker.update(start + i * 1000 / hz);
      }
      return {...counts, blends, pulses, frames: hz * 2};
    };
    try {
      return {normal: [run(60), run(120)], reduced: run(60, true), software: run(60, false, true), resumed: run(60)};
    } finally {
      for (const [node, clear] of originals) node.clear = clear;
      app.ticker.remove(observe);
      scene.reducedMotion = reduced; scene.lowPower = lowPower;
      app.ticker.start();
    }
  });
  for (const sample of [...measurements.normal, measurements.resumed]) {
    for (const key of ['lava', 'eruption', 'sparks']) {
      assert.ok(sample[key] >= 58 && sample[key] <= 62, `${key}: ${sample[key]} rebuilds over two seconds`);
    }
    assert.ok(sample.blends > sample.frames * .95, 'the flame still blends on every render frame');
    assert.ok(sample.pulses > sample.frames * .95, 'the lighting still pulses on every render frame');
  }
  for (const sample of [measurements.reduced, measurements.software]) {
    for (const key of ['lava', 'eruption', 'sparks', 'blends', 'pulses']) assert.ok(sample[key] <= 1, `${key} stays frozen`);
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:v2')), saved);
  assert.deepEqual(errors, []);
});
