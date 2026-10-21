import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';

registerHooks({ resolve(s, c, next) {
  if (s.startsWith('@/')) return next(new URL(`../../src/${s.slice(2)}.ts`, import.meta.url).href, c);
  if (c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`, c);
  return next(s, c);
} });
const { dragonNests, dragonVariantAt, DRAGON_VARIANTS } = await import('../../src/lib/game/dragon.ts');
const { surfaceAt, WORLD_LENGTH } = await import('../../src/lib/game/world.ts');
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3000';
const nests = dragonNests(0, WORLD_LENGTH);
const inspect = page => page.evaluate(() => {
  const root = window.__pixiApp.stage.getChildByLabel('dragon-nest', true);
  const body = root.getChildByLabel('dragon-body');
  const foot = root.toGlobal({ x: 0, y: 0 });
  return { x: root.x, y: root.y, bodyY: body.y, rotation: body.rotation,
    anchor: body.anchor.y * body.texture.orig.height,
    frame: body.texture.frame.x / 512 + body.texture.frame.y / 512 * 4,
    alpha: body.alpha, scaleY: body.scale.y, footY: foot.y,
    projectedGround: (root.y - window.__decorScene.camera.y) * window.__decorScene.camera.scale + window.__decorScene.camera.screenOffsetY,
    source: body.texture.source.label,
  };
});
function grounded(pose, x) {
  assert.equal(pose.y, surfaceAt(x));
  assert.equal(pose.bodyY, 0);
  assert.equal(pose.rotation, 0);
  assert.equal(pose.anchor, 476);
  assert.ok(Math.abs(pose.footY - pose.projectedGround) < 0.5, 'the rendered foot pivot stays on the road');
  assert.ok(pose.source.endsWith(DRAGON_VARIANTS[dragonVariantAt(x)].art));
}

test('resident dragons stand on the road and respond to visitors', { timeout: 90_000 }, async t => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: process.env.PLAYWRIGHT_WEBGL === 'metal'
      ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  t.after(() => browser.close());
  async function fixture(viewport) {
    const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const at = new Date().toISOString();
      localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
      localStorage.setItem('louchomage:moi:v1', 'test');
      localStorage.setItem('louchomage:v2', JSON.stringify({
        players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }], events: [], casts: [],
      }));
    });
    await page.goto(`${url}/local?debug&hour=12`);
    await page.waitForFunction(() => window.__decorScene && window.__pixiApp && !document.querySelector('.action-button--refus')?.disabled);
    return { context, page, errors };
  }
  async function explore(page, x) {
    await page.evaluate(x => { window.__decorScene.exploreCenter = x; window.__decorScene.pan = 0; }, x);
    await page.waitForFunction(x => {
      const root = window.__pixiApp.stage.getChildByLabel('dragon-nest', true);
      return root && Math.abs(root.x - x) < 1 && root.getChildByLabel('dragon-body')?.texture.width > 1;
    }, x);
  }

  await t.test('all five colours keep their feet anchored at desktop, mobile and wide sizes', async () => {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
      const { context, page, errors } = await fixture(viewport);
      try {
        for (const x of nests) { await explore(page, x); grounded(await inspect(page), x); }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  });

  await t.test('a brief nap ends immediately when spoken to; reduced motion holds an awake pose', async () => {
    const { context, page, errors } = await fixture({ width: 390, height: 844 });
    const x = nests[1];
    try {
      const saved = await page.evaluate(() => localStorage.getItem('louchomage:v2'));
      await explore(page, x);
      assert.equal((await inspect(page)).frame, 6, 'the resident starts awake');
      await page.waitForFunction(() => {
        const body = window.__pixiApp.stage.getChildByLabel('dragon-body', true);
        return body.texture.frame.x === 1536 && body.texture.frame.y === 512 && body.alpha > 0.99;
      }, null, { timeout: 45_000 });
      grounded(await inspect(page), x);
      await page.getByRole('button', { name: 'Parler au dragon', exact: true }).click();
      await page.waitForFunction(() => {
        const body = window.__pixiApp.stage.getChildByLabel('dragon-body', true);
        return body.texture.frame.x === 1024 && body.texture.frame.y === 512 && body.alpha > 0.99;
      });
      await page.locator('.environment-speech').waitFor();
      grounded(await inspect(page), x);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(150);
      const frozen = await inspect(page);
      await page.waitForTimeout(500);
      const after = await inspect(page);
      assert.equal(after.frame, 6);
      assert.equal(after.scaleY, frozen.scaleY);
      grounded(after, x);
      assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:v2')), saved);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
