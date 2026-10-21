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
const sites = ['fox', 'yeti'].filter(kind => !process.env.GESTURE_KIND || process.env.GESTURE_KIND === kind).map(kind => environmentSites(0, WORLD_LENGTH, 1).find(s => s.kind === kind));
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3000', folder = process.env.GESTURE_SCREENSHOTS;

test('resident gestures alternate, blend briefly and keep their feet and unique identity', { timeout: 180_000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  t.after(() => browser.close()); if (folder) await mkdir(folder, { recursive: true });
  for (const site of sites) for (const [name, viewport] of [['desktop', { width: 1280, height: 720 }], ['mobile', { width: 390, height: 844 }], ['wide', { width: 1920, height: 1080 }]]) await t.test(`${site.kind}-${name}`, async () => {
    const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(count => {
      const at = new Date().toISOString();
      localStorage.setItem('louchomage:moi:v1', 'test'); localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
      localStorage.setItem('louchomage:v2', JSON.stringify({ players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }],
        events: Array.from({ length: count }, (_, i) => ({ id: `a${i}`, playerId: 'test', kind: 'candidature', at })), casts: [] }));
    }, Math.round((site.x + 280) / WORLD_LENGTH * JOURNEY_TARGET / 2));
    const inspect = () => page.evaluate(({ kind, x }) => {
      const root = window.__pixiApp.stage.getChildByLabel(`biome-resident:${kind}:${x}`, true);
      const body = root.getChildByLabel(`biome-body:${kind}`,true), old = root.getChildByLabel(`biome-previous:${kind}`,true);
      const camera = window.__decorScene.camera;
      return { frame: body.texture.frame.x / 384 + body.texture.frame.y / 384 * 2, source: body.texture.source.label,
        alpha: body.alpha, oldAlpha: old.alpha, oldVisible: old.visible, y: body.y, anchor: body.anchor.y * 384,
        foot: body.getGlobalPosition().y, ground: camera.screenOffsetY + (body.y - camera.y) * camera.scale,
        scale: body.scale.y, oldY: old.y };
    }, { kind: site.kind, x: site.x });
    try {
      await page.goto(`${url}/local?debug&hour=12`);
      await page.waitForFunction(() => window.__viewportResidents && !document.querySelector('.action-button--refus')?.disabled);
      await page.evaluate(x => { window.__decorScene.exploreCenter = x; window.__decorScene.pan = 0; }, site.x);
      const button = page.locator(`[data-environment-id="${site.id}"]`);
      await button.waitFor({ state: 'visible' });
      await page.waitForTimeout(600);
      const saved = await page.evaluate(() => localStorage.getItem('louchomage:v2'));
      // Sample on every actual scene frame rather than missing the short blend at 30 fps.
      await page.evaluate(({ kind, x }) => {
        window.__gestureSamples = [];
        const app = window.__pixiApp;
        window.__sampleGestures = () => {
          const root = app.stage.getChildByLabel(`biome-resident:${kind}:${x}`, true);
          const body = root?.getChildByLabel(`biome-body:${kind}`,true), old = root?.getChildByLabel(`biome-previous:${kind}`,true);
          if (body) window.__gestureSamples.push({ alpha: body.alpha, oldAlpha: old.alpha, oldVisible: old.visible, foot: body.getGlobalPosition().y, oldFoot: old.getGlobalPosition().y, y: body.y });
        };
        app.ticker.add(window.__sampleGestures, undefined, -15);
      }, { kind: site.kind, x: site.x });
      for (const [index, gesture] of ['finger', 'shrug', 'snicker'].entries()) {
        await button.focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(({ kind, x, frame }) => {
          const body = window.__pixiApp.stage.getChildByLabel(`biome-resident:${kind}:${x}`, true)?.getChildByLabel(`biome-body:${kind}`,true);
          return body?.texture.source.label.includes('gestures') && body.texture.frame.x / 384 + body.texture.frame.y / 384 * 2 === frame && body.alpha > .99;
        }, { kind: site.kind, x: site.x, frame: index + 1 });
        const pose = await inspect();
        assert.equal(pose.y, WALKABLE_GROUND_Y + 10); assert.equal(pose.oldY, pose.y); assert.equal(pose.anchor, 356);
        assert.ok(Math.abs(pose.foot - pose.ground) < 1);
        if (folder) await page.screenshot({ path: `${folder}/${site.kind}-${name}-${gesture}.png` });
        await page.waitForFunction(({ kind, x }) => {
          const body = window.__pixiApp.stage.getChildByLabel(`biome-resident:${kind}:${x}`, true)?.getChildByLabel(`biome-body:${kind}`,true);
          return !body?.texture.source.label.includes('gestures') && body?.alpha > .99;
        }, { kind: site.kind, x: site.x });
        await page.waitForTimeout(450);
      }
      const samples = await page.evaluate(() => { window.__pixiApp.ticker.remove(window.__sampleGestures); return window.__gestureSamples; });
      assert.ok(samples.some(s => s.alpha > 0 && s.alpha < 1 && s.oldVisible && s.oldAlpha > 0), 'the transition includes intermediate frames');
      for (const s of samples) {
        assert.equal(s.y, WALKABLE_GROUND_Y + 10);
        if (s.oldVisible) assert.ok(Math.abs(s.foot - s.oldFoot) < .01, 'both poses share the same foot pivot');
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await button.focus(); await page.keyboard.press('Enter');
      await page.waitForTimeout(150); const a = await inspect(); await page.waitForTimeout(250); const b = await inspect();
      assert.equal(a.frame, 1); assert.equal(b.frame, a.frame); assert.equal(b.alpha, 1); assert.equal(b.oldVisible, false); assert.equal(b.scale, a.scale);
      assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:v2')), saved); assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
