import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { chromium, request } from 'playwright';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { prisonMaze, prisonStart, prisonMove, prisonWon, PRISON_DIRECTIONS } = await import('../../src/lib/game/prison.ts');
const { monthKey } = await import('../../src/lib/game/calendar.ts');
const { availablePowers } = await import('../../src/lib/game/powers.ts');
const url = process.env.GAME_TEST_URL ?? 'http://127.0.0.1:3100';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Use a local test server.');
const readSave = page => page.evaluate(() => JSON.parse(localStorage.getItem('louchomage:v2')));
const ready = (page, mode) => page.waitForFunction(mode =>
  window.__worldView?.().phase === 'ready' && window.__worldView().mode === mode
  && !document.querySelector('.hud-layer')?.inert, mode);

function winningPath(castId) {
  const maze = prisonMaze(castId);
  const queue = [{ run: prisonStart(), path: [] }];
  const visited = new Set();
  for (const { run, path } of queue) {
    if (prisonWon(maze, run)) return path;
    for (const direction of Object.keys(PRISON_DIRECTIONS)) {
      const next = prisonMove(maze, run, direction);
      const key = `${next.cell}:${next.keys}`;
      if (next === run || visited.has(key)) continue;
      visited.add(key);
      queue.push({ run: next, path: [...path, direction] });
    }
  }
  throw new Error('The maze has no solution');
}

test('the shared group enforces imprisonment and accepts a win only from its target', async t => {
  const host = await request.newContext({ baseURL: url });
  const guest = await request.newContext({ baseURL: url });
  t.after(() => Promise.all([host.dispose(), guest.dispose()]));
  const password = 'dragon';
  const created = await host.post('/api/groups', { data: { name: 'Le cachot de test', password } });
  assert.equal(created.status(), 201);
  const { slug } = await created.json();
  const group = `/api/groups/${slug}`;
  const joined = await guest.post(`${group}/join`, { data: { password } });
  assert.equal(joined.status(), 200);
  // Explicitly carry the issued cookies over the loopback HTTP connection.
  const cookie = response => response.headers()['set-cookie'].split(';')[0];
  const sessions = new Map([[host, cookie(created)], [guest, cookie(joined)]]);
  const act = (client, action, deviceToken, pin) => client.post(`${group}/actions`, {
    data: { action, pin },
    headers: { cookie: sessions.get(client), ...(deviceToken ? { 'x-player-token': deviceToken } : {}) },
  });
  const enroll = async (client, name, characterId) => {
    const response = await act(client, { type: 'addPlayer', name, characterId }, undefined, '4321');
    assert.equal(response.status(), 200);
    return response.json();
  };
  const attacker = await enroll(host, 'Mika', 'skater');
  const victim = await enroll(guest, 'Lou', 'barde');
  const playerId = attacker.result.player.id;
  const targetPlayerId = victim.result.player.id;
  for (let i = 0; i < 2; i++) {
    assert.equal((await act(host, { type: 'addEvent', playerId, kind: 'candidature' }, attacker.deviceToken)).status(), 200);
  }
  const cage = availablePowers(playerId, 1, []).find(power => power.kind === 'cage');
  const cast = await act(host, { type: 'castPower', playerId, targetPlayerId, ...cage }, attacker.deviceToken);
  assert.equal(cast.status(), 200);
  const castId = (await cast.json()).result.cast.id;
  const escape = { type: 'escapeCage', castId, path: winningPath(castId).join('') };
  const travel = { type: 'addEvent', playerId: targetPlayerId, kind: 'refus' };
  assert.equal((await act(guest, travel, victim.deviceToken)).status(), 409);
  assert.equal((await act(host, escape, attacker.deviceToken)).status(), 403);
  assert.equal((await act(guest, { ...escape, path: 'r' }, victim.deviceToken)).status(), 409);
  assert.equal((await act(guest, escape, victim.deviceToken)).status(), 200);
  assert.equal((await act(guest, travel, victim.deviceToken)).status(), 200);
  const saved = await (await host.get(group, { headers: { cookie: sessions.get(host) } })).json();
  assert.ok(saved.state.casts[0].escapedAt);
  assert.equal(saved.state.events.at(-1).journeyBase, 12);
});

test('live language, shared drinks and persistent pranks on both renderers', { timeout: 120_000 }, async t => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const now = Date.now();
  const at = new Date(now).toISOString();
  await page.addInitScript(({ at, meetup }) => {
    if (localStorage.getItem('louchomage:v2')) return;
    localStorage.setItem('louchomage:renderer-choice:v1', '1');
    localStorage.setItem('louchomage:renderer:v1', '2d');
    localStorage.setItem('louchomage:language:v1', 'fr');
    localStorage.setItem('louchomage:moi:v1', 'mika');
    for (const id of ['mika', 'lou']) localStorage.setItem(`chomage:welcome:rites-v2:local%3A${id}`, 'seen');
    localStorage.setItem('louchomage:v2', JSON.stringify({
      players: [
        { id: 'mika', name: 'Mika', characterId: 'skater', joinedAt: at },
        { id: 'lou', name: 'Lou', characterId: 'barde', joinedAt: at },
      ],
      events: Array.from({ length: 12 }, (_, i) => ({ id: `old-${i}`, kind: 'candidature', playerId: 'mika', at })),
      casts: [],
      monthlyMeetups: [meetup],
    }));
  }, { at, meetup: { monthKey: monthKey(new Date(now)), place: 'La Tanière', updatedBy: 'mika',
    updatedAt: new Date(now - 3_600_000).toISOString(), at: new Date(now + 3_600_000).toISOString() } });
  const game = `${url}/local?debug&hour=12`;
  await page.goto(game);
  await ready(page, '2d');
  const language = page.locator('.hud-company .language-picker select');
  const before = await readSave(page);
  await language.selectOption('en');
  await page.getByRole('button', { name: 'Next drinks', exact: true }).tap();
  const drinks = page.getByRole('dialog', { name: 'Next drinks' });
  assert.match(await drinks.innerText(), /La Tanière/);
  const fill = await page.locator('.meetup-mug__fill').evaluate(node => parseFloat(node.style.height));
  assert.ok(fill >= 50 && fill < 55);
  await page.keyboard.press('Escape');
  assert.deepEqual(await readSave(page), before);
  await page.reload();
  await ready(page, '2d');
  assert.equal(await language.inputValue(), 'en');
  await language.selectOption('fr');
  await page.getByRole('button', { name: 'Prochain verre', exact: true }).tap();
  await page.locator('.meetup-editor__save').click();
  await page.getByPlaceholder('Lieu du rendez-vous').fill('Chez le troll');
  await page.locator('.meetup-editor__save').click();
  assert.match(await page.locator('.meetup-summary').innerText(), /Chez le troll/);
  await page.keyboard.press('Escape');

  for (const [name, kind] of [['Au cachot !', 'cage'], ['Troll à dos', 'miniTroll'], ['Fièvre du recruteur', 'feuSacré']]) {
    await page.locator('.company-loot').tap();
    await page.locator('.power-choice').filter({ hasText: name }).click();
    await page.locator('.power-target').filter({ hasText: 'Lou' }).click();
    assert.equal((await readSave(page)).casts.at(-1).kind, kind);
  }
  const casts = (await readSave(page)).casts;
  for (const cast of casts.slice(1)) assert.equal(Date.parse(cast.expiresAt) - Date.parse(cast.at), 3 * 24 * 60 * 60 * 1000);

  await page.evaluate(() => localStorage.setItem('louchomage:moi:v1', 'lou'));
  await page.reload();
  await ready(page, '2d');
  const capture = async name => {
    if (!process.env.PRANK_SCREENSHOTS) return;
    await mkdir(process.env.PRANK_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.PRANK_SCREENSHOTS}/${name}.png` });
  };
  await page.waitForFunction(() => document.querySelector('.cage-banner'));
  await page.getByRole('button', { name: 'J’ai compris' }).click();
  assert.ok((await readSave(page)).casts.every(cast => cast.seenAt));
  await page.waitForFunction(() => {
    const hero = window.__pixiApp.stage.getChildByLabel('hero-rig:lou', true);
    return hero?.getChildByLabel('backpack-troll')?.visible && hero?.getChildByLabel('hero-flame')?.visible;
  });
  await page.waitForTimeout(3800);
  await capture('2d-mobile');
  await page.setViewportSize({ width: 1280, height: 800 });
  await capture('2d-desktop');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await capture('2d-wide');
  assert.equal(await page.locator('.action-button--candidature').isDisabled(), true);
  await page.keyboard.press('1');
  assert.equal((await readSave(page)).events.length, 12);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await ready(page, '3d');
  await capture('3d-wide');
  await page.setViewportSize({ width: 1280, height: 800 });
  await capture('3d-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('3d-mobile');
  await language.selectOption('it');
  await page.getByRole('button', { name: 'Tentare la fuga' }).tap();
  await page.getByRole('dialog', { name: 'Labirinto della prigione' }).waitFor();
  await capture('maze-mobile');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.action-button--candidature').isDisabled(), true);
  await page.getByRole('button', { name: 'Tentare la fuga' }).tap();
  const [first, ...remaining] = winningPath(casts[0].id);
  await page.locator(`.prison-controls [data-direction="${first}"]`).tap();
  const keys = { u: 'ArrowUp', l: 'ArrowLeft', d: 'ArrowDown', r: 'ArrowRight' };
  await page.evaluate(keys => {
    for (const key of keys) window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }, remaining.map(direction => keys[direction]));
  await page.locator('.prison-dialog').waitFor({ state: 'detached' });
  assert.ok((await readSave(page)).casts[0].escapedAt);
  assert.equal(await page.locator('.action-button--candidature').isEnabled(), true);
  await page.reload();
  await ready(page, '3d');
  assert.equal(await page.locator('.cage-banner').count(), 0);
  assert.equal(await language.inputValue(), 'it');
  await language.selectOption('fr');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const steps of [12, 24]) {
    await page.locator('.action-button--refus').tap();
    await page.getByRole('button', { name: 'Ranger le butin' }).tap();
    await page.locator('.roadside-invite[open], .wild-encounter[open]').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(steps => window.__worldView().players.find(player => player.id === 'lou')?.steps === steps
      && !document.querySelector('.action-button--refus')?.disabled, steps);
  }
  assert.equal(await page.locator('.journey-card__place').innerText(), 'Bois du Broyage');
  assert.deepEqual(errors, []);
});
