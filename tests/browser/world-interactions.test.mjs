import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.GAME_TEST_URL ?? 'http://127.0.0.1:3100';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Use a local test server.');

test('signs celebrate and a 2D player bounces home when passed', { timeout: 90_000 }, async t => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (localStorage.getItem('louchomage:v2')) return;
    const at = new Date().toISOString();
    localStorage.setItem('louchomage:renderer-choice:v1', '1');
    localStorage.setItem('louchomage:renderer:v1', '2d');
    localStorage.setItem('louchomage:language:v1', 'fr');
    localStorage.setItem('louchomage:moi:v1', 'mika');
    localStorage.setItem('chomage:welcome:rites-v2:local%3Amika', 'seen');
    localStorage.setItem('louchomage:v2', JSON.stringify({
      players: [
        { id: 'mika', name: 'Mika', characterId: 'skater', joinedAt: at },
        { id: 'lou', name: 'Lou', characterId: 'barde', joinedAt: at },
      ],
      events: [{ id: 'before', kind: 'refus', playerId: 'lou', at }],
      casts: [],
    }));
  });
  await page.goto(`${url}/local?debug&hour=12&variant=classic`);
  await page.waitForFunction(() => window.__worldView?.().phase === 'ready' && window.__decorScene?.heroContacts.has('lou'));
  const capture = async name => {
    if (!process.env.INTERACTION_SCREENSHOTS) return;
    await mkdir(process.env.INTERACTION_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.INTERACTION_SCREENSHOTS}/${name}.png` });
  };
  const home = await page.evaluate(() => window.__decorScene.heroes.get('lou').x);
  await page.locator('.action-button--candidature').click();
  await page.waitForFunction(() => window.__pixiApp.stage.getChildByLabel('hero-rig:lou', true)?.y < -58);
  await capture('2d-player-bump');
  await page.locator('.roadside-invite[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const rig = window.__pixiApp.stage.getChildByLabel('hero-rig:lou', true);
    return rig && Math.abs(rig.x) < .01 && Math.abs(rig.y) < .01;
  });
  assert.equal(await page.evaluate(() => window.__decorScene.heroes.get('lou').x), home);

  const journal = () => page.evaluate(() => localStorage.getItem('louchomage:v2'));
  const saved = await journal();
  await page.evaluate(() => { window.__decorScene.exploreCenter = 14465.8; });
  const sign = page.getByRole('button', { name: /Lire le panneau.*Transforme tes refus en confettis/ });
  await sign.click();
  await page.waitForFunction(() => window.__pixiApp.stage.getChildByLabel('fx:confetti', true)?.visible);
  await capture('2d-sign-confetti');
  assert.equal(await journal(), saved);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.waitForFunction(() => window.__worldView?.().phase === 'ready' && window.__worldView().mode === '3d');
  await sign.click();
  await page.waitForFunction(() => window.__voxelWorld.signEffects.includes('sign-burst:confetti'));
  if (process.env.INTERACTION_SCREENSHOTS) await page.waitForTimeout(450);
  await capture('3d-sign-confetti');
  assert.equal(await journal(), saved);
  assert.deepEqual(errors, []);
});
