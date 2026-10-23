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

  await t.test('all five MP3s are served as audio and decode to non-silent samples', async () => {
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
    assert.equal(playing.track, 'peaceful');
    const firstTime = playing.voices.find(voice => voice.id === playing.track).time;
    await page.getByRole('button', {name: /Ouvrir le carnet/}).click();
    const toggle = page.locator('.sound-toggle');
    await toggle.click();
    await page.waitForFunction(() => !window.__musicState().enabled && window.__musicState().voices.every(voice => voice.paused));
    assert.equal(await toggle.getAttribute('data-state'), 'effects');
    const pausedTime = await page.evaluate(() => window.__musicState().voices.find(voice => voice.id === 'peaceful').time);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.__musicState().voices.find(voice => voice.id === 'peaceful').time), pausedTime);
    await toggle.click();
    assert.equal(await toggle.getAttribute('data-state'), 'none');
    await toggle.click();
    await page.waitForFunction(time => window.__musicState().enabled && window.__musicState().voices.some(voice => voice.id === 'peaceful' && !voice.paused && voice.time > time), pausedTime);
    assert.equal(await toggle.getAttribute('data-state'), 'all');
    assert.ok(pausedTime >= firstTime);
    assert.equal(await page.evaluate(() => localStorage.getItem('louchomage:musique:v1')), '1');
    assert.deepEqual(errors, []);
  });
});

test('the first mobile touch starts the intro; the same decks keep playing through selection and arrival without an NPC click', {timeout:60000}, async t=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=document-user-activation-required']});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    // Safari versions without this API still receive trusted click/touch gestures.
    Object.defineProperty(navigator,'userActivation',{configurable:true,value:undefined});
    window.__testMusicElements=[];
    const Original=window.Audio;
    window.Audio=class extends Original {constructor(...args){super(...args);window.__testMusicElements.push(this);}};
  });
  await page.goto(`${url}/?debug`);
  await page.getByLabel('Nom du groupe',{exact:true}).tap();
  await page.waitForFunction(()=>window.__musicState?.().context==='running'&&window.__musicState().track==='firelit'&&window.__musicState().voices.some(v=>!v.paused&&v.time>1&&v.gain>0));
  const allocated=await page.evaluate(()=>window.__testMusicElements.length);
  assert.ok(allocated<=3,'two persistent decks plus a disposed StrictMode mount');
  await page.getByRole('link',{name:'Mode solo',exact:true}).tap();
  await page.locator('.hero-roster').waitFor();
  assert.equal(await page.evaluate(()=>window.__musicState().track),'firelit','the intro continues through navigation');
  await page.getByPlaceholder('Mika').fill('Camille');
  await page.getByRole('button',{name:'Entrer dans la partie',exact:true}).tap();
  await page.locator('.initiation-card[open]').waitFor();
  await page.getByRole('button',{name:'Passer l’initiation',exact:true}).tap();
  await page.waitForFunction(()=>window.__musicState().track==='peaceful'&&window.__musicState().context==='running'&&window.__musicState().voices.some(v=>v.id==='peaceful'&&!v.paused&&v.time>1&&v.gain>0));
  assert.equal(await page.evaluate(()=>window.__testMusicElements.length),allocated,'arriving in the game never replaces the unlocked audio elements');
  assert.equal(await page.locator('.dialogue-bubble').count(),0);
  assert.deepEqual(errors,[]);
});
