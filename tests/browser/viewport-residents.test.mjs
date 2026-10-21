import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
registerHooks({ resolve(s, c, next) {
  if (s.startsWith('@/')) return next(new URL(`../../src/${s.slice(2)}.ts`, import.meta.url).href, c);
  if (c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`, c);
  return next(s, c);
} });
const { BIOMES, WORLD_LENGTH } = await import('../../src/lib/game/world.ts');
const { JOURNEY_TARGET } = await import('../../src/lib/config.ts');
const { environmentSites } = await import('../../src/lib/game/environment.ts');
const forest = environmentSites(0, WORLD_LENGTH, 1).find(site => site.kind === 'troll').x;
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3000';
const folder = process.env.RESIDENT_SCREENSHOTS;
const inspect = page => page.evaluate(() => {
  const drawn = node => {
    if (!node) return false;
    for (let p = node; p; p = p.parent) if (!p.visible || !p.renderable || p.alpha <= 0) return false;
    return true;
  };
  const counts = {}, hiddenTargets = [], visible = [], eligible = [];
  let suppressed = 0;
  for (const resident of window.__viewportResidents.values()) {
    const node = resident.body.current;
    if (node && node.visible && node.alpha > 0) {
      const bounds = node.getBounds(), camera = window.__decorScene.camera;
      if (bounds.maxX > 0 && bounds.minX < camera.viewW * camera.scale && bounds.maxY > window.__decorScene.topInset && bounds.minY < camera.viewH * camera.scale - window.__decorScene.bottomInset) eligible.push(resident.id);
    }
    if (drawn(node)) { counts[resident.kind] = (counts[resident.kind] ?? 0) + 1; visible.push(resident.id); }
    else if (node && !node.renderable) {
      suppressed++;
      if (resident.target?.current.visible) hiddenTargets.push(resident.id);
      for (const ref of [resident.shadow, resident.accent]) if (drawn(ref?.current)) hiddenTargets.push(`${resident.id}:orphan-shadow`);
    }
  }
  return { counts, hiddenTargets, visible, eligible, suppressed };
});

test('each NPC appearance is unique in the rendered viewport, across layers and camera moves', { timeout: 180_000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  if (folder) await mkdir(folder, { recursive: true });
  for (const [name, viewport] of [['desktop', { width: 1280, height: 720 }], ['mobile', { width: 390, height: 844 }], ['wide', { width: 1920, height: 1080 }]]) await t.test(name, async () => {
    const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(count => {
      const at = new Date().toISOString();
      localStorage.setItem('louchomage:moi:v1', 'test');
      localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
      localStorage.setItem('louchomage:v2', JSON.stringify({ players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }],
        events: Array.from({ length: count }, (_, i) => ({ id: `past${i}`, kind: 'candidature', playerId: 'test', at })), casts: [] }));
    }, Math.round((forest + 280) / WORLD_LENGTH * JOURNEY_TARGET / 2));
    try {
      await page.goto(`${url}/local?debug&hour=12`);
      await page.waitForFunction(() => window.__viewportResidents?.size > 2 && window.__pixiApp && !document.querySelector('.action-button--refus')?.disabled);
      const saved = await page.evaluate(() => localStorage.getItem('louchomage:v2'));
      const explore = async x => {
        await page.evaluate(x => { window.__decorScene.exploreCenter = x; window.__decorScene.pan = 0; }, x);
        await page.waitForFunction(x => Math.abs(window.__decorScene.camera.x + window.__decorScene.camera.viewW / 2 - x) < 3, x);
        await page.waitForTimeout(160);
      };
      let seen = 0, hidden = 0;
      const biomes = process.env.RESIDENT_ONLY ? BIOMES.filter(b => b.id === process.env.RESIDENT_ONLY) : [BIOMES.find(b => b.id === 'foret'), ...BIOMES.filter(b => b.id !== 'foret')];
      for (const biome of biomes) {
        const center = biome.id === 'foret' ? forest : (biome.from + biome.to) / 2 * WORLD_LENGTH;
        await explore(center);
        const pose = await inspect(page);
        for (const [kind, count] of Object.entries(pose.counts)) assert.equal(count, 1, `${name}, ${biome.id}, ${kind}`);
        assert.deepEqual(pose.hiddenTargets, []);
        seen += Object.keys(pose.counts).length; hidden += pose.suppressed;
        if (folder) await page.screenshot({ path: `${folder}/${biome.id}-${name}.png` });
        // A small camera movement must retain an individual still on screen.
        await explore(center + 12);
        const after = await inspect(page);
        for (const count of Object.values(after.counts)) assert.equal(count, 1);
        assert.deepEqual(after.hiddenTargets, []);
        for (const id of pose.visible) if (after.eligible.includes(id)) assert.ok(after.visible.includes(id), `${id} should stay selected while still on screen`);
      }
      assert.ok(seen > 0); assert.ok(hidden > 0, 'duplicates are suppressed, rather than only removing hit areas');
      await explore(forest);
      const button = page.getByRole('button', { name: 'Parler au troll', exact: true });
      await button.focus(); await page.keyboard.press('Enter');
      await page.locator('.environment-speech').waitFor();
      const before = await inspect(page);
      await explore(forest + 12);
      const after = await inspect(page);
      const speaker = await page.locator('.environment-speech').getAttribute('data-target');
      assert.ok(before.visible.includes(speaker) && after.visible.includes(speaker));
      assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:v2')), saved);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
