import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const url = process.env.GAME_TEST_URL ?? 'http://localhost:3100';
const ready = page => page.waitForFunction(() => {
  const button = document.querySelector('.action-button--entretien');
  return button && !button.disabled;
});

test('real game journeys, rewards, undo and mobile controls', { timeout: 180_000 }, async t => {
  const server = process.env.GAME_TEST_URL ? null : spawn(process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--port', '3100'], { stdio: 'ignore' });
  t.after(() => server?.kill());
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch { /* Server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  t.after(() => browser.close());

  async function fixture(steps, reducedMotion = 'no-preference') {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ steps }) => {
      const at = new Date().toISOString();
      localStorage.setItem('louchomage:moi:v1', 'test');
      localStorage.setItem('louchomage:v2', JSON.stringify({
        players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }],
        events: Array.from({ length: steps / 2 }, (_, i) => ({ id: `event-${i}`, playerId: 'test', kind: 'candidature', at })),
        casts: [],
      }));
    }, { steps });
    await page.goto(url);
    await ready(page);
    return { context, page, errors };
  }

  await t.test('ordinary actions move directly; setbacks keep earned loot; undo restores travel', async () => {
    const { context, page, errors } = await fixture(104);
    try {
      await page.locator('.action-button--rejetApresEntretien').click();
      assert.equal(await page.locator('.reward-modal').count(), 0);
      await page.getByRole('button', { name: 'Ranger le butin' }).click();
      await ready(page);
      assert.match(await page.locator('.power-menu__trigger').innerText(), /11/);
      await page.locator('.action-button--entretien').click();
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /107/);
      assert.match(await page.locator('.power-menu__trigger').innerText(), /11/);
      await page.locator('.action-button--refus').click();
      await ready(page);
      assert.equal(await page.locator('.reward-modal').count(), 0, 'No duplicate chest at 110');
      await page.locator('.action-undo').click();
      await ready(page);
      await page.locator('.action-button--embauche').click();
      await page.getByRole('button', { name: 'Continuer l’aventure' }).click();
      await page.locator('.action-undo').click();
      await ready(page); // Requires the return journey to finish, including zero step delta.
      assert.match(await page.locator('.journey-card__stats').innerText(), /107/);
      assert.equal(await page.locator('.reward-modal').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  await t.test('zero-distance actions and undo finish with reduced motion; map pauses and closes', async () => {
    const { context, page, errors } = await fixture(0, 'reduce');
    try {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.locator('.action-button--entretien').click();
      assert.equal(await page.locator('.action-dock__prompt').isVisible(), true);
      await ready(page);
      await page.locator('.action-undo').click();
      await ready(page);
      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(300);
      const clearHeight = await page.evaluate(() => document.querySelector('.hud-bottom').getBoundingClientRect().top - document.querySelector('.hud-journey').getBoundingClientRect().bottom);
      assert.ok(clearHeight > 210, `Only ${clearHeight}px left for the hero`);
      const overflow = await page.locator('.action-button__label').evaluateAll(nodes => nodes.some(node => node.scrollWidth > node.clientWidth + 1));
      assert.equal(overflow, false);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.locator('.company-camera').click();
      assert.equal(await page.locator('.hud-layer').isVisible(), false);
      await page.waitForTimeout(300);
      const before = await page.locator('canvas').screenshot();
      await page.waitForTimeout(600);
      assert.deepEqual(await page.locator('canvas').screenshot(), before);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('button', { name: 'Fermer la carte' }).count(), 0);
      await ready(page);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
