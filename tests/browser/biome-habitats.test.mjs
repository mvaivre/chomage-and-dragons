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
const { environmentSites } = await import('../../src/lib/game/environment.ts');
const { WORLD_LENGTH, WALKABLE_GROUND_Y } = await import('../../src/lib/game/world.ts');
const { JOURNEY_TARGET } = await import('../../src/lib/config.ts');
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3000';
const folder = process.env.BIOME_SCREENSHOTS;

test('forest trolls remain visible, grounded and interactive after their tree clearance check', { timeout: 60_000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close());
  const site = environmentSites(0, WORLD_LENGTH, 1).find(site => site.kind === 'troll');
  assert.ok(site);
  const context = await browser.newContext(), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(count => {
    const at = new Date().toISOString();
    localStorage.setItem('louchomage:moi:v1', 'test');
    localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
    localStorage.setItem('louchomage:v2', JSON.stringify({
      players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }],
      events: Array.from({ length: count }, (_, i) => ({ id: `a${i}`, playerId: 'test', kind: 'candidature', at })), casts: [],
    }));
  }, Math.round((site.x + 280) / WORLD_LENGTH * JOURNEY_TARGET / 2));
  if (folder) await mkdir(folder, { recursive: true });
  try {
    await page.goto(`${url}/local?debug&hour=12`);
    await page.waitForFunction(() => window.__decorScene && window.__pixiApp && !document.querySelector('.action-button--refus')?.disabled);
    const saved = await page.evaluate(() => localStorage.getItem('louchomage:v2'));
    for (const [name, viewport] of [['desktop', { width: 1280, height: 720 }], ['mobile', { width: 390, height: 844 }], ['wide', { width: 1920, height: 1080 }]]) {
      await page.setViewportSize(viewport);
      await page.evaluate(x => { window.__decorScene.exploreCenter = x; window.__decorScene.pan = 0; }, site.x);
      const label = `environment:${site.id}`;
      await page.waitForFunction(label => window.__pixiApp.stage.getChildByLabel(label, true)?.children.some(child => child.anchor && child.texture?.width > 1), label);
      await page.waitForTimeout(700);
      const pose = await page.evaluate(label => {
        const root = window.__pixiApp.stage.getChildByLabel(label, true);
        const body = root.children.find(child => child.anchor && child.texture);
        const camera = window.__decorScene.camera;
        return { visible: body.visible, foot: body.getGlobalPosition().y,
          ground: camera.screenOffsetY + (body.y - camera.y) * camera.scale,
          y: body.y, anchor: body.anchor.y * body.texture.orig.height, source: body.texture.source.label };
      }, label);
      assert.equal(pose.visible, true);
      assert.equal(pose.y, WALKABLE_GROUND_Y + 10);
      assert.equal(pose.anchor, 476);
      assert.ok(Math.abs(pose.foot - pose.ground) < 1);
      assert.match(pose.source, /environment-troll(?:-walk)?\.webp$/);
      if (folder) await page.screenshot({ path: `${folder}/troll-${name}.png` });
      // The same troll is greeted again after each resize; respect its cooldown.
      if (name !== 'desktop') await page.waitForTimeout(950);
      const button = page.locator(`[data-environment-id="${site.id}"]`);
      await button.focus(); await page.keyboard.press('Enter');
      await page.locator('.environment-speech').waitFor();
      assert.equal(await page.locator('.environment-speech').getAttribute('data-target'), site.id);
      await page.getByRole('button', { name: 'Fermer le dialogue', exact: true }).click();
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:v2')), saved);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
