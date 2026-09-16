import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { corporateAnswer } = await import('../../src/lib/game/personality-quiz.ts');

const url = process.env.GAME_TEST_URL ?? 'http://localhost:3100';
const ready = page => page.waitForFunction(() => {
  const button = document.querySelector('.action-button--entretien');
  return button && !button.disabled;
});

test('real game journeys, rewards, undo and mobile controls', { timeout: 240_000 }, async t => {
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

  async function fixture(steps, reducedMotion = 'no-preference', kinds = Array.from({ length: steps / 2 }, () => 'candidature')) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ kinds }) => {
      if (localStorage.getItem('louchomage:v2')) return;
      const at = new Date().toISOString();
      localStorage.setItem('louchomage:moi:v1', 'test');
      localStorage.setItem('louchomage:v2', JSON.stringify({
        players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }],
        events: kinds.map((kind, i) => ({ id: `event-${i}`, playerId: 'test', kind, at })),
        casts: [],
      }));
    }, { kinds });
    await page.goto(`${url}/local`);
    await ready(page);
    return { context, page, errors };
  }
  // Most actions now offer a game once the travel and loot are done; decline it to get back to the road.
  // The next game can replace the declined one in the same commit, so the element itself is tracked.
  async function declineGames(page, count = 1) {
    for (let i = 0; i < count; i++) {
      const dialog = await page.locator('dialog[open].mini-game').elementHandle();
      await page.getByRole('button', { name: 'Fermer le mini-jeu' }).click();
      await dialog.waitForElementState('hidden');
    }
  }

  await t.test('ordinary actions move directly; setbacks keep earned loot; undo restores travel', async () => {
    const { context, page, errors } = await fixture(104);
    try {
      await page.locator('.action-button--rejetApresEntretien').click();
      assert.equal(await page.locator('.reward-modal').count(), 0);
      await page.getByRole('button', { name: 'Ranger le butin' }).click();
      await declineGames(page, 2); // The ghosting wait, then the chest's slot machine.
      await ready(page);
      assert.match(await page.locator('.power-menu__trigger').innerText(), /11/);
      await page.locator('.action-button--entretien').click();
      await declineGames(page);
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /107/);
      assert.match(await page.locator('.power-menu__trigger').innerText(), /11/);
      await page.locator('.action-button--refus').click();
      await declineGames(page);
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
      await declineGames(page);
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

  // Flies the open course through the real input path, with the same rule as the unit-tested autopilot.
  const fly = page => page.evaluate(() => new Promise(resolve => {
    const arena = document.querySelector('.mini-game__arena');
    const loop = () => {
      const { status, y, vy, target } = arena.dataset;
      if (status === 'delivered' || status === 'crashed') return resolve(status);
      if (status === 'flying' && Number(y) > Number(target) + 4 && Number(vy) > -70) {
        arena.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
      }
      requestAnimationFrame(loop);
    };
    loop();
  }));

  await t.test('pigeon ×2 awards the bonus, opens a chest, and survives undo/reload without replay', async () => {
    const { context, page, errors } = await fixture(6, 'reduce', ['refus', 'refus']); // First application: a pigeon; its bonus crosses the chest.
    try {
      await page.setViewportSize({width: 390, height: 844});
      await page.locator('.action-button--candidature').click();
      await page.getByRole('button', {name: 'Décoller !'}).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 1);
      assert.match(await page.locator('.mini-game__counter').innerText(), /0 \/ 10/);
      await page.getByRole('button', {name: 'Décoller !'}).focus();
      await page.keyboard.press('Space');
      assert.equal(await fly(page), 'delivered');
      assert.match(await page.locator('.mini-game__counter').innerText(), /10 \/ 10/);
      await page.waitForFunction(() => document.querySelector('.mini-game__result')?.textContent?.includes('×2 · +4 pas'));
      assert.match(await page.locator('.journey-card__stats').innerText(), /10/);
      await page.getByRole('button', {name: 'Continuer le voyage'}).click();
      await page.getByRole('button', {name: 'Ranger le butin'}).click();
      // The chest's double bottom: a slot machine, declined here.
      await page.locator('dialog[open].mini-game--slots').waitFor();
      await page.keyboard.press('Escape');
      await ready(page);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('louchomage:v2')));
      assert.equal(saved.events.at(-1).journeyBonus, 2);
      assert.deepEqual(saved.miniGames.map(a => [a.kind, a.result]), [['pigeon', 'won'], ['slots', 'skipped']]);
      await page.locator('.action-undo').click();
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /6/);
      await page.locator('.action-button--candidature').click();
      await page.getByRole('button', {name: 'Ranger le butin'}).click();
      await ready(page);
      assert.equal(await page.locator('.mini-game').count(), 0, 'neither game is replayed');
      await page.reload();
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /10/);
      assert.equal(await page.locator('.mini-game').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  await t.test('skipping, crashing and interrupting keep the base; small-screen dialog stays usable', async () => {
    const { context, page, errors } = await fixture(0, 'reduce');
    try {
      await page.setViewportSize({width: 320, height: 568});
      await page.locator('.action-button--candidature').click();
      await page.locator('dialog[open].mini-game--pigeon').waitFor();
      assert.equal(await page.locator('.mini-game').evaluate(n => n.scrollWidth > n.clientWidth), false);
      await page.waitForFunction(() => document.querySelector('.mini-game__arena')?.dataset.status === 'ready');
      await page.keyboard.press('Escape');
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /2/);
      assert.equal(await page.locator('.leaderboard-sheet').count(), 0, 'Escape stays inside the dialog');
      await page.locator('.action-undo').click();
      await ready(page);
      await page.locator('.action-button--candidature').click();
      await ready(page);
      assert.equal(await page.locator('.mini-game').count(), 0);
      await page.locator('.action-button--candidature').click(); // Second application: the keyword rain.
      await page.locator('dialog[open].mini-game--keywords').waitFor();
      await page.keyboard.press('Escape');
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /4/);
      await page.emulateMedia({reducedMotion: 'no-preference'});
      await page.locator('.action-button--candidature').click();
      await page.getByRole('button', {name: 'Décoller !'}).click(); // Then never flap again: three ground hits.
      await page.waitForFunction(() => document.querySelector('.mini-game__arena')?.dataset.status === 'crashed');
      await page.waitForFunction(() => document.querySelector('.mini-game__result')?.textContent?.includes('2 pas conservés'));
      assert.equal(await page.locator('.mini-game__feather[data-lost="true"]').count(), 3);
      await page.getByRole('button', {name: 'Continuer le voyage'}).click();
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /6/);
      await page.locator('.action-button--candidature').click();
      await page.locator('.mini-game--keywords').waitFor();
      await page.reload(); // Interrupt an unresolved game: preserve base, consume attempt.
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /8/);
      assert.equal(await page.locator('.mini-game').count(), 0);
      await page.locator('.action-undo').click();
      await ready(page);
      await page.locator('.action-button--candidature').click();
      await ready(page);
      assert.equal(await page.locator('.mini-game').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  // Taps the arena whenever the game's own autopilot rule says so, through the real pointer path.
  // The attributes are refreshed by the game's own frame, so the first frame after a click is skipped.
  const playByRule = page => page.evaluate(() => new Promise(resolve => {
    const arena = document.querySelector('.mini-game__arena');
    let warmUp = 2;
    const loop = () => {
      const { status, autopilot } = arena.dataset;
      if (status === 'won' || status === 'lost') return resolve(status);
      if (warmUp-- <= 0 && autopilot === 'true') arena.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }));

  await t.test('the stamp, quiz, ghosting and slot games award their bonuses through the real input path', async () => {
    const { context, page, errors } = await fixture(0);
    try {
      await page.locator('.action-button--refus').click();
      await page.locator('.mini-game--stamp').waitFor();
      await page.getByRole('button', {name: 'Lancer le tapis'}).click();
      assert.equal(await page.evaluate(() => new Promise(resolve => {
        const arena = document.querySelector('.mini-game__arena');
        let warmUp = 2;
        const loop = () => {
          const { status, next, armed } = arena.dataset;
          if (status === 'won' || status === 'lost') return resolve(status);
          if (warmUp-- <= 0 && next && Math.abs(Number(next)) <= 12 && armed === 'true') arena.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      })), 'won');
      await page.waitForFunction(() => document.querySelector('.mini-game__result')?.textContent?.includes('+4 pas'));
      await page.getByRole('button', {name: 'Continuer le voyage'}).click();
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /4/);

      await page.locator('.action-button--entretien').click();
      await page.locator('.mini-game--quiz').waitFor();
      await page.getByRole('button', {name: 'Commencer l’entretien'}).click();
      for (let i = 0; i < 5; i++) {
        await page.waitForFunction(i => document.querySelector('.quiz')?.dataset.status === 'question' && document.querySelector('.quiz')?.dataset.question === String(i), i);
        const prompt = (await page.locator('.quiz__bubble p').innerText()).replace(/[«»]/g, '').trim();
        await page.locator('.quiz__answer', {hasText: corporateAnswer(prompt)}).click();
      }
      await page.waitForFunction(() => document.querySelector('.quiz')?.dataset.status === 'won');
      await page.waitForFunction(() => document.querySelector('.mini-game__result')?.textContent?.includes('-2 pas au lieu de -3'));
      await page.getByRole('button', {name: 'Continuer le voyage'}).click();
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /2/);

      await page.locator('.action-button--rejetApresEntretien').click();
      await page.locator('.mini-game--ghosting').waitFor();
      await page.getByRole('button', {name: 'Attendre (14 jours)'}).click();
      await page.waitForFunction(() => document.querySelector('.chat')?.dataset.status === 'message', null, {timeout: 20_000});
      await page.locator('.chat__send').click();
      await page.waitForFunction(() => document.querySelector('.mini-game__result')?.textContent?.includes('+8 pas'));
      await page.getByRole('button', {name: 'Continuer le voyage'}).click();
      // Ten steps: the first chest, then its double bottom.
      await page.getByRole('button', {name: 'Ranger le butin'}).click();
      await page.locator('.mini-game--slots').waitFor();
      await page.getByRole('button', {name: 'Lancer les rouleaux'}).click();
      assert.equal(await playByRule(page), 'won');
      await page.waitForFunction(() => document.querySelector('.mini-game__result')?.textContent?.includes('Jackpot'));
      await page.getByRole('button', {name: 'Continuer le voyage'}).click();
      await ready(page);
      assert.match(await page.locator('.journey-card__stats').innerText(), /10/);
      assert.match(await page.locator('.power-menu__trigger').innerText(), /2/, 'the chest loot plus the jackpot');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('louchomage:v2')));
      assert.deepEqual(saved.events.map(e => [e.kind, e.journeyBonus]), [['refus', 1], ['entretien', 1], ['rejetApresEntretien', 2]]);
      assert.deepEqual(saved.miniGames.map(a => [a.kind, a.action, a.slot, a.result]), [['stamp', 'refus', 0, 'won'], ['quiz', 'entretien', 0, 'won'], ['ghosting', 'rejetApresEntretien', 0, 'won'], ['slots', 'chest', 0, 'won']]);
      await page.reload();
      await ready(page);
      assert.match(await page.locator('.power-menu__trigger').innerText(), /2/);
      assert.equal(await page.locator('.mini-game').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });

  await t.test('a group is created, joined by invitation with the password, and played from two devices', async () => {
    const host = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const errors = [];
    try {
      const alice = await host.newPage();
      alice.setDefaultTimeout(30_000);
      alice.on('pageerror', error => errors.push(error.message));
      await alice.goto(url);
      await alice.getByLabel('Nom du groupe').fill('Les Chômeurs Magnifiques');
      await alice.getByLabel('Mot de passe du groupe').fill('dragon');
      await alice.getByLabel('Encore une fois').fill('dragon');
      await alice.getByRole('button', { name: 'Créer et entrer' }).click();
      await alice.waitForURL(/\/g\/les-chomeurs-magnifiques-[0-9a-f]{6}$/);
      const slug = new URL(alice.url()).pathname.split('/')[2];
      // Alice forges her character with a PIN and logs an application.
      await alice.getByPlaceholder('Mika').fill('Alice');
      await alice.getByPlaceholder('1234').fill('2468');
      await alice.getByRole('button', { name: 'Entrer dans la partie' }).click();
      await ready(alice);
      await alice.locator('.action-button--candidature').click();
      await alice.locator('dialog[open].mini-game--pigeon').waitFor();
      await alice.keyboard.press('Escape');
      await ready(alice);
      assert.match(await alice.locator('.journey-card__stats').innerText(), /2/);
      // Two software-rendered scenes at once starve each other: Alice's page rests while Bob plays.
      await alice.goto('about:blank');

      // Bob opens the invitation: the game is out of reach until the password is right.
      const bob = await guest.newPage();
      bob.setDefaultTimeout(30_000);
      bob.on('pageerror', error => errors.push(error.message));
      await bob.goto(`${url}/g/${slug}`);
      await bob.waitForURL(/\/rejoindre$/);
      assert.match(await bob.locator('h1').innerText(), /Chômeurs Magnifiques/);
      await bob.getByLabel('Mot de passe du groupe').fill('licorne');
      await bob.getByRole('button', { name: 'Entrer dans le groupe' }).click();
      await bob.locator('form [role="alert"]').waitFor();
      assert.match(await bob.locator('form [role="alert"]').innerText(), /Mauvais mot de passe/);
      await bob.getByLabel('Mot de passe du groupe').fill('dragon');
      await bob.getByRole('button', { name: 'Entrer dans le groupe' }).click();
      await bob.waitForURL(new RegExp(`/g/${slug}$`));
      // Alice is already on the roster; Bob forges his own character.
      await bob.getByRole('button', { name: 'Nouvelle âme en peine' }).click();
      await bob.getByPlaceholder('Mika').fill('Bob');
      await bob.getByPlaceholder('1234').fill('1357');
      await bob.getByRole('button', { name: 'Entrer dans la partie' }).click();
      await ready(bob);
      await bob.locator('.action-button--refus').click();
      await bob.locator('dialog[open].mini-game--stamp').waitFor();
      await bob.keyboard.press('Escape');
      await ready(bob);
      assert.match(await bob.locator('.journey-card__stats').innerText(), /3/);

      // The server holds both journals; Alice's device sees Bob when it comes back.
      const snapshot = await bob.evaluate(async slug => (await fetch(`/api/groups/${slug}`)).json(), slug);
      assert.deepEqual(snapshot.state.players.map(p => p.name), ['Alice', 'Bob']);
      assert.deepEqual(snapshot.state.events.map(e => e.kind), ['candidature', 'refus']);
      assert.equal(snapshot.state.miniGames.length, 2);

      // A device without the token cannot act for a character: the API refuses.
      const refused = await bob.evaluate(async ({ slug, playerId }) => {
        const response = await fetch(`/api/groups/${slug}/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: { type: 'addEvent', playerId, kind: 'refus' } }) });
        return response.status;
      }, { slug, playerId: snapshot.state.players[0].id });
      assert.equal(refused, 403);

      // Bob reclaims Alice's character with her PIN on his device; her device loses it.
      await bob.evaluate(() => localStorage.removeItem(Object.keys(localStorage).find(k => k.startsWith('louchomage:moi:'))));
      await bob.reload();
      await bob.getByRole('button', { name: /Alice/ }).first().click();
      await bob.getByLabel('Code PIN').fill('0000');
      await bob.getByRole('button', { name: 'Reprendre' }).click();
      await bob.locator('[role="dialog"] [role="alert"]').waitFor();
      assert.match(await bob.locator('[role="dialog"] [role="alert"]').innerText(), /PIN/);
      await bob.getByLabel('Code PIN').fill('2468');
      await bob.getByRole('button', { name: 'Reprendre' }).click();
      await ready(bob);
      assert.match(await bob.locator('.journey-card').innerText(), /Alice/);
      await bob.goto('about:blank');
      await alice.goto(`${url}/g/${slug}`);
      await alice.waitForFunction(() => document.body.innerText.includes('repris sur un autre appareil'), null, { timeout: 30_000 });
      assert.match(await alice.locator('body').innerText(), /Bob/, 'the roster now lists Bob too');
      assert.deepEqual(errors, []);
    } finally { await host.close(); await guest.close(); }
  });
});
