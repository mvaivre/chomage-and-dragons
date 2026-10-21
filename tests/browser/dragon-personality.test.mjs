import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

registerHooks({ resolve(s, c, next) {
  if (s.startsWith('@/')) return next(new URL(`../../src/${s.slice(2)}.ts`, import.meta.url).href, c);
  if (c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`, c);
  return next(s, c);
} });
const { dragonNests, DRAGON_REPLIES } = await import('../../src/lib/game/dragon.ts');
const { WORLD_LENGTH } = await import('../../src/lib/game/world.ts');
const { JOURNEY_TARGET } = await import('../../src/lib/config.ts');
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3000';
const screenshotDir = process.env.DRAGON_QA_DIR;
const nests = dragonNests(0, WORLD_LENGTH);

test('the resident eats on the fourth click and restores the hero without changing the save', { timeout: 120_000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: process.env.PLAYWRIGHT_WEBGL === 'metal'
      ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  t.after(() => browser.close());
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  for (const [name, viewport, reducedMotion, distant] of [
    ['desktop', { width: 1280, height: 720 }, 'no-preference', false],
    ['mobile', { width: 390, height: 844 }, 'no-preference', false],
    ['wide', { width: 1920, height: 1080 }, 'reduce', true],
  ]) await t.test(name, async () => {
    const context = await browser.newContext({ viewport, reducedMotion });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.addInitScript(({ nest, distant, world, target }) => {
        const at = new Date().toISOString();
        const count = distant ? 0 : Math.round((nest + 80) / world * target / 2);
        localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
        localStorage.setItem('louchomage:moi:v1', 'test');
        localStorage.setItem('louchomage:v2', JSON.stringify({
          players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }],
          events: Array.from({ length: count }, (_, i) => ({ id: `past-${i}`, playerId: 'test', kind: 'candidature', at })), casts: [],
        }));
      }, { nest: nests[0], distant, world: WORLD_LENGTH, target: JOURNEY_TARGET });
      await page.goto(`${url}/local?debug&hour=12`);
      await page.waitForFunction(() => window.__decorScene && window.__pixiApp && !document.querySelector('.action-button--refus')?.disabled);
      const saved = await page.evaluate(() => localStorage.getItem('louchomage:v2'));
      const explore = async x => {
        await page.evaluate(x => { window.__decorScene.exploreCenter = x; window.__decorScene.pan = 0; }, x);
        await page.waitForFunction(x => {
          const scene = window.__decorScene;
          return Math.abs(scene.camera.x + scene.camera.viewW / 2 - x) < 2;
        }, x);
        await page.getByRole('button', { name: 'Parler au dragon', exact: true }).waitFor();
      };
      await explore(nests[0]);
      const dragon = page.getByRole('button', { name: 'Parler au dragon', exact: true });
      // Dragging over the dragon pans instead of advancing its dialogue.
      const bounds = await dragon.boundingBox(), cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 35, cy, { steps: 5 }); await page.mouse.up();
      await explore(nests[0]);
      await dragon.click();
      assert.equal(await page.locator('.environment-speech p').textContent(), DRAGON_REPLIES[0]);
      // Culling and mounting a different nest must retain the exchange.
      await explore(nests[1]);
      await explore(nests[0]);
      await dragon.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.environment-speech p').textContent(), DRAGON_REPLIES[1]);
      await page.waitForTimeout(950);
      await dragon.click();
      assert.equal(await page.locator('.environment-speech p').textContent(), DRAGON_REPLIES[2]);
      await page.waitForFunction(() => {
        const body = window.__pixiApp.stage.getChildByLabel('dragon-body', true);
        return body.texture.frame.x === 1024 && body.texture.frame.y === 0 && body.alpha > 0.99;
      });
      if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/${name}-warning.png` });
      await page.waitForTimeout(950);
      await dragon.click();
      await page.waitForFunction(() => window.__decorScene.dragonMeal !== null);
      assert.equal(await page.locator('.action-button--refus').isDisabled(), true);
      await page.waitForFunction(() => {
        const body = window.__pixiApp.stage.getChildByLabel('dragon-meal', true);
        return window.__decorScene.heroEffects.get('test')?.alpha === 0 && body?.texture.frame.y === 512 && body?.texture.frame.x === 0;
      });
      const swallowed = await page.evaluate(() => {
        const scene = window.__decorScene, body = window.__pixiApp.stage.getChildByLabel('dragon-meal', true);
        const resident = window.__pixiApp.stage.getChildByLabel('dragon-nest', true);
        return { frame: body.texture.frame.x / 512 + body.texture.frame.y / 512 * 4,
          y: body.y, foot: body.anchor.y * 512, residentVisible: resident.visible,
          effect: { ...scene.heroEffects.get('test'), owner: undefined } };
      });
      assert.equal(swallowed.frame, 4);
      assert.equal(swallowed.foot, 476);
      assert.equal(swallowed.residentVisible, false, 'one dragon is drawn during the meal');
      if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/${name}-swallowed.png` });
      await page.waitForFunction(() => window.__decorScene.dragonMeal === null && !window.__decorScene.heroEffects.has('test'));
      await page.waitForFunction(() => !document.querySelector('.action-button--refus')?.disabled);
      assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:v2')), saved);
      await explore(nests[0]);
      await dragon.click();
      assert.equal(await page.locator('.environment-speech p').textContent(), DRAGON_REPLIES[0], 'the next exchange starts with a joke');
      if (name === 'desktop') {
        // Every click counts, even if the player immediately ignores the warning.
        await dragon.click({ clickCount: 3, delay: 40 });
        await page.waitForFunction(() => window.__decorScene.dragonMeal !== null);
        await page.waitForFunction(() => window.__decorScene.dragonMeal === null && !window.__decorScene.heroEffects.has('test'));
        assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:v2')), saved);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
