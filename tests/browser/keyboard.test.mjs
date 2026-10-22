import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('@/') ? new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context);
} });
const { MINI_GAMES } = await import('../../src/lib/game/mini-games.ts');
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3000';
const kinds = ['pigeonRace', 'paperCut', 'snake', 'maze', 'stack', 'pong'];
const control = page => page.locator('.arcade-arena').evaluate(node => JSON.parse(node.dataset.controlState));
const journal = page => page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('louchomage:v2'));
  return { events: state.events, casts: state.casts, miniGames: state.miniGames ?? [], daily: state.daily ?? [] };
});

test('modal games take the first keyboard input without clicking a direction control', { timeout: 120_000 }, async t => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  t.after(() => browser.close());
  async function fixture(initiation = false) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(initiation => {
      const at = new Date().toISOString();
      if (!initiation) localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
      localStorage.setItem('louchomage:moi:v1', 'test');
      localStorage.setItem('louchomage:v2', JSON.stringify({
        players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }],
        events: [{ id: 'a', playerId: 'test', kind: 'candidature', at }], casts: [],
      }));
    }, initiation);
    await page.goto(`${url}/local?debug`);
    if (initiation) await page.locator('.initiation-card[open]').waitFor();
    else await page.waitForFunction(() => !document.querySelector('.action-button--refus')?.disabled);
    return { context, page, errors };
  }
  async function openGame(page, kind) {
    if (!await page.locator('.adventure-menu[open]').count()) {
      await page.getByRole('button', { name: /Ouvrir le carnet/ }).click();
      await page.getByRole('button', { name: 'Quêtes', exact: true }).click();
    }
    await page.locator('.adventure-menu__games button').filter({ hasText: MINI_GAMES[kind].title }).click();
    await page.locator(`.mini-game--${kind}[open]`).waitFor();
  }
  async function start(page, mode, name = 'C’est parti !') {
    const button = page.getByRole('button', { name, exact: true });
    if (mode === 'mouse') await button.click();
    else { await button.focus(); await page.keyboard.press('Enter'); }
  }
  async function steer(page, kind, second = false) {
    const before = await control(page);
    const key = kind === 'pigeonRace' ? second ? 'ArrowDown' : 'ArrowUp'
      : kind === 'snake' ? second ? 'ArrowLeft' : 'ArrowUp'
      : kind === 'maze' ? second ? 'ArrowUp' : 'ArrowDown'
      : second ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.press(key);
    await page.waitForFunction(({ kind, before, second }) => {
      const current = JSON.parse(document.querySelector('.arcade-arena').dataset.controlState);
      switch (kind) {
        case 'pigeonRace': return current.lane === before.lane + (second ? 1 : -1);
        case 'paperCut': case 'pong': return second ? current.x < before.x : current.x > before.x;
        case 'snake': return second ? current.direction === 'left' && current.x < before.x : current.direction === 'up' && current.y < before.y;
        case 'maze': return second ? current.y < before.y : current.y > before.y;
        case 'stack': return current.x === before.x + (second ? -1 : 1);
      }
    }, { kind, before, second }, { timeout: 2000 });
  }

  for (const mode of ['mouse', 'keyboard']) {
    await t.test(`all six arcades steer immediately after ${mode} start and after arena focus`, async () => {
      const { context, page, errors } = await fixture();
      try {
        const saved = await journal(page);
        for (const kind of kinds) {
          await openGame(page, kind);
          await start(page, mode);
          await page.waitForFunction(() => document.querySelector('.arcade-arena')?.dataset.status === 'running');
          await steer(page, kind); // The first arrow, with no direction-button interaction.
          await page.locator('.arcade-arena').click({ position: { x: 160, y: 100 } });
          // Model a browser dropping focus after disabling the start button. Only
          // DOM focus changes here: tests never receive or mutate the simulation.
          await page.evaluate(() => document.activeElement?.blur());
          await steer(page, kind, true);
          await page.keyboard.press('2');
          assert.deepEqual(await journal(page), saved, `${kind} keeps shortcuts inside its modal`);
          await page.keyboard.press('Escape');
          await page.locator('.adventure-menu[open]').waitFor();
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });

    await t.test(`legacy dragon and CV arrow controls respond after ${mode} start`, async () => {
      const { context, page, errors } = await fixture();
      try {
        const saved = await journal(page);
        await openGame(page, 'dragon'); await start(page, mode, 'Voler le butin');
        await page.keyboard.press('ArrowUp');
        await page.getByLabel('Position 1 sur 3', { exact: true }).waitFor();
        await page.locator('.dragon-arena').click({ position: { x: 20, y: 20 } });
        await page.evaluate(() => document.activeElement?.blur());
        await page.keyboard.press('ArrowDown');
        await page.getByLabel('Position 2 sur 3', { exact: true }).waitFor();
        await page.keyboard.press('Escape'); await page.locator('.adventure-menu[open]').waitFor();

        await openGame(page, 'keywords'); await start(page, mode, 'Lancer le robot');
        await page.waitForFunction(() => document.querySelector('.mini-game__arena')?.dataset.basket !== undefined);
        const basket = await page.locator('.mini-game__arena').evaluate(node => Number(node.dataset.basket));
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(x => Number(document.querySelector('.mini-game__arena').dataset.basket) > x + 10, basket);
        await page.keyboard.press('Escape'); await page.locator('.adventure-menu[open]').waitFor();
        assert.deepEqual(await journal(page), saved); assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });

    await t.test(`dragon initiation keeps arrows after ${mode} start, arena click, pause and restart`, async () => {
      const { context, page, errors } = await fixture(true);
      try {
        const saved = await journal(page);
        await start(page, mode, 'Décoller');
        await page.keyboard.press('ArrowUp');
        assert.equal(await page.locator('.initiation-flight').getAttribute('data-lane'), '0');
        await page.locator('.initiation-flight').click({ position: { x: 20, y: 20 } });
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.locator('.initiation-flight').getAttribute('data-lane'), '1', 'the dialog itself can own focus');
        const pause = page.getByRole('button', { name: 'Mettre le vol en pause', exact: true });
        await pause.focus(); await page.keyboard.press('Space');
        assert.equal(await page.locator('.initiation-flight').getAttribute('data-flying'), 'false');
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.locator('.initiation-flight').getAttribute('data-lane'), '1', 'pause prevents steering');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.initiation-flight').getAttribute('data-flying'), 'true');
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.locator('.initiation-flight').getAttribute('data-lane'), '2');
        await page.getByRole('button', { name: 'Recommencer', exact: true }).click();
        await start(page, mode, 'Décoller'); await page.keyboard.press('ArrowUp');
        assert.equal(await page.locator('.initiation-flight').getAttribute('data-lane'), '0');
        await page.keyboard.press('2'); assert.deepEqual(await journal(page), saved);
        await page.locator('.initiation-flight').click({ position: { x: 20, y: 20 } });
        await page.keyboard.press('Escape'); await page.locator('.initiation-card').waitFor({ state: 'detached' });
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }

  await t.test('held keys release and native Tab, Enter, Space and Escape keep their button behavior', async () => {
    const { context, page, errors } = await fixture();
    try {
      const saved = await journal(page);
      await openGame(page, 'pong');
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('mini-game__primary')), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('mini-game__skip')), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('mini-game__primary')), true);
      await page.keyboard.press('Space');
      await page.waitForFunction(() => document.querySelector('.arcade-arena')?.dataset.status === 'running');
      const before = await control(page);
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(180); await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(50); // Let the final canvas frame publish the stopped paddle.
      const after = await control(page); assert.ok(after.x > before.x + 30);
      await page.waitForTimeout(120); assert.equal((await control(page)).x, after.x, 'keyup stops the held paddle');
      const right = page.getByRole('button', { name: 'Aller à gauche', exact: true });
      await right.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(x => JSON.parse(document.querySelector('.arcade-arena').dataset.controlState).x === x - 24, after.x);
      await page.getByRole('button', { name: 'Fermer le mini-jeu', exact: true }).focus();
      await page.keyboard.press('Space'); await page.locator('.adventure-menu[open]').waitFor();

      // Reopening must not retain a previous modal's handler or double one key.
      await openGame(page, 'stack'); await start(page, 'keyboard');
      await steer(page, 'stack');
      const piece = await control(page);
      await page.getByRole('button', { name: 'Aller à gauche', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(x => JSON.parse(document.querySelector('.arcade-arena').dataset.controlState).x === x - 1, piece.x);
      assert.match(await page.locator('.mini-game__hud').innerText(), /0 points/, 'Enter moved a piece rather than hard-dropping it');
      await page.keyboard.press('Escape'); await page.locator('.adventure-menu[open]').waitFor();
      assert.deepEqual(await journal(page), saved); assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
