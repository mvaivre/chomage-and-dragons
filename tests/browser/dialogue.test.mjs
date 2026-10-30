import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.GAME_TEST_URL ?? 'http://localhost:3100';

test('2D residents type their dialogue and accept reveal/close without dragging or declaring actions', { timeout: 30000 }, async t => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('louchomage:renderer-choice:v1', '1');localStorage.setItem('louchomage:language:v1', 'fr');
    const at = new Date().toISOString();
    localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
    localStorage.setItem('louchomage:moi:v1', 'test');
    localStorage.setItem('louchomage:v2', JSON.stringify({ players: [{ id: 'test', name: 'Camille', characterId: 'barde', joinedAt: at }], events: [0, 1].map(i => ({ id: `seed-${i}`, playerId: 'test', kind: 'candidature', at })), casts: [] }));
  });
  await page.goto(`${url}/local?debug&hour=12`);
  await page.waitForFunction(() => window.__decorScene?.heroes.has('test') && !document.querySelector('.action-button--refus')?.disabled);
  await page.getByRole('button', { name: 'Saluer le hérisson', exact: true }).first().click();
  const speech = page.locator('.travel-speech');
  await speech.waitFor();
  assert.equal(await speech.getAttribute('data-typing'), 'true');
  const fullText = await speech.getAttribute('data-line');
  assert.ok(fullText.length > 15);
  await speech.getByRole('button', { name: 'Tout afficher ▾', exact: true }).click();
  assert.equal(await speech.getAttribute('data-typing'), 'false');
  assert.equal(await speech.locator('[aria-hidden="true"]').textContent(), fullText);
  assert.equal(await page.evaluate(() => window.__decorScene.dragging), false);
  await mkdir('/tmp/louchomage-2d-dialogue', { recursive: true });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1920, height: 1080 }]) {
    if (await speech.count()) await speech.getByRole('button', { name: 'Fermer le dialogue', exact: true }).click();
    await page.setViewportSize(viewport);
    await page.waitForTimeout(950); // Let the previous resident reaction finish.
    await page.getByRole('button', { name: 'Saluer le hérisson', exact: true }).first().click();
    if (await speech.getAttribute('data-typing') === 'true') await speech.getByRole('button', { name: 'Tout afficher ▾', exact: true }).click();
    await page.waitForFunction(() => {
      const bubble = document.querySelector('.environment-speech')?.getBoundingClientRect();
      const close = document.querySelector('.travel-speech__close')?.getBoundingClientRect();
      const text = document.querySelector('.travel-speech p')?.getBoundingClientRect();
      return bubble && close && text && bubble.left >= 0 && bubble.right <= innerWidth && close.top >= bubble.top && close.top - bubble.top < 22 && bubble.right - close.right >= 0 && bubble.right - close.right < 22 && close.bottom <= text.top;
    });
    await page.screenshot({ path: `/tmp/louchomage-2d-dialogue/${viewport.width}.png` });
  }
  await speech.getByRole('button', { name: 'Fermer le dialogue', exact: true }).click();
  assert.equal(await speech.count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('louchomage:v2')).events.length), 2);
  assert.deepEqual(errors, []);
});
