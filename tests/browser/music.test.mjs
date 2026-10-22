import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const { TRACKS } = await import('../../src/lib/client/music.ts');
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3100';

test('the supplied recordings decode and play through the game sound controls', { timeout: 120000 }, async t => {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: process.env.PLAYWRIGHT_WEBGL === 'metal'
      ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  t.after(() => context.close());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const at = new Date().toISOString();
    localStorage.setItem('chomage:welcome:steps-v1', 'seen');
    localStorage.setItem('chomage:welcome:rites-v2:local%3Atest', 'seen');
    localStorage.setItem('louchomage:moi:v1', 'test');
    localStorage.setItem('louchomage:v2', JSON.stringify({
      players: [{ id: 'test', name: 'Mika', characterId: 'skater', joinedAt: at }],
      events: [{ id: 'start', playerId: 'test', kind: 'candidature', at }], casts: [],
    }));
  });
  await page.goto(`${url}/local?debug&hour=12&variant=classic`);
  await page.waitForFunction(() => window.__voxelWorld?.ready && window.__musicState);

  await t.test('all four MP3s are served as audio and decode to non-silent samples', async () => {
    for (const [id, track] of Object.entries(TRACKS)) {
      const decoded = await page.evaluate(async src => {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`${src}: HTTP ${response.status}`);
        const type = response.headers.get('content-type');
        const ctx = new AudioContext();
        try {
          const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
          let peak = 0, finite = true;
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const samples = buffer.getChannelData(channel);
            for (let i = 0; i < samples.length; i += 64) {
              finite &&= Number.isFinite(samples[i]);
              peak = Math.max(peak, Math.abs(samples[i]));
            }
          }
          return { type, duration: buffer.duration, channels: buffer.numberOfChannels, finite, peak };
        } finally { await ctx.close(); }
      }, track.src);
      assert.match(decoded.type, /^audio\//, id);
      assert.ok(decoded.duration > 15 && decoded.channels > 0 && decoded.channels <= 2, id);
      assert.ok(decoded.finite && decoded.peak > 0 && decoded.peak <= 1, id);
    }
  });

  await t.test('a gesture starts the recording and the three sound states pause and resume it', async () => {
    // A harmless key provides the gesture browsers require for recorded audio.
    await page.keyboard.press('Shift');
    await page.waitForFunction(() => window.__musicState().voices.some(voice => !voice.paused && voice.time > 0.2));
    const playing = await page.evaluate(() => window.__musicState());
    assert.equal(playing.track, 'medieval');
    const firstTime = Math.max(...playing.voices.map(voice => voice.time));
    await page.getByRole('button', {name: /Ouvrir le carnet/}).click();
    const toggle = page.locator('.sound-toggle');
    await toggle.click();
    await page.waitForFunction(() => !window.__musicState().enabled && window.__musicState().voices.every(voice => voice.paused));
    assert.equal(await toggle.getAttribute('data-state'), 'effects');
    const pausedTime = await page.evaluate(() => Math.max(...window.__musicState().voices.map(voice => voice.time)));
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => Math.max(...window.__musicState().voices.map(voice => voice.time))), pausedTime);
    await toggle.click();
    assert.equal(await toggle.getAttribute('data-state'), 'none');
    await toggle.click();
    await page.waitForFunction(time => window.__musicState().enabled && window.__musicState().voices.some(voice => !voice.paused && voice.time > time), pausedTime);
    assert.equal(await toggle.getAttribute('data-state'), 'all');
    assert.ok(pausedTime >= firstTime);
    assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:musique:v1')), '1');
    assert.deepEqual(errors, []);
  });
});
