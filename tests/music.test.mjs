import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

class Param {
  value = 0;
  events = [];
  setValueAtTime(value, at) { this.value = value; this.events.push({ kind: 'set', value, at }); }
  linearRampToValueAtTime(value, at) { this.value = value; this.events.push({ kind: 'linear', value, at }); }
  exponentialRampToValueAtTime(value, at) { this.value = value; this.events.push({ kind: 'exponential', value, at }); }
  setTargetAtTime(value, at) { this.value = value; this.events.push({ kind: 'target', value, at }); }
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
}

class AudioNode {
  gain = new Param();
  threshold = new Param();
  ratio = new Param();
  connections = [];
  constructor(context, kind, media) { this.context = context; this.kind = kind; this.media = media; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; this.connections = []; }
}

class AudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  nodes = [];
  destination = new AudioNode(this, 'destination');
  node(kind, media) { const node = new AudioNode(this, kind, media); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createMediaElementSource(media) { return this.node('media', media); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

class Media {
  static instances = [];
  static nextPlay = [];
  static playLog = [];
  static requiresGesture = false;
  static inGesture = false;
  _src = '';
  currentTime = 0;
  duration = 120;
  readyState = 4;
  error = null;
  paused = true;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  unlocked = false;
  listeners = new Map();
  constructor(src = '') { this.src = src; Media.instances.push(this); }
  get src() { return this._src; }
  set src(value) {
    if (value !== this._src) { this.currentTime = 0; this.error = null; }
    this._src = value;
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(listener);
  }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  emit(name) { for (const listener of [...(this.listeners.get(name) ?? [])]) listener(); }
  play() {
    this.playCalls += 1;
    Media.playLog.push({ media: this, src: this.src });
    if (Media.requiresGesture && !Media.inGesture && !this.unlocked) return Promise.reject(new DOMException('Gesture required for this element', 'NotAllowedError'));
    if (Media.inGesture) this.unlocked = true;
    const request = this.loadCalls, src = this.src;
    const next = Media.nextPlay.shift();
    const result = typeof next === 'function' ? next(this) : this.error ? Promise.reject(new DOMException('Media failed', 'NotSupportedError')) : Promise.resolve();
    return result.then(() => { if (request === this.loadCalls && src === this.src) this.paused = false; });
  }
  pause() { this.pauseCalls += 1; this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() { this.loadCalls += 1; this.error = null; this.currentTime = 0; this.paused = true; }
}

const { MusicPlayer, TRACKS, trackForPlace, startMusic, setMusicPlace, setMusicPhase, setMusicDucked, setMusicOn, isMusicOn, onMusicChange } = await import('../src/lib/client/music.ts');
const { primeAudio, audioOutput, setMuted } = await import('../src/lib/client/sound.ts');
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function environment() {
  const intervals = new Map(), timeouts = new Map(), windowListeners = new Map(), documentListeners = new Map(), storage = new Map();
  let id = 0;
  const on = registry => (name, listener) => {
    if (!registry.has(name)) registry.set(name, new Set());
    registry.get(name).add(listener);
  };
  const off = registry => (name, listener) => {
    registry.get(name)?.delete(listener);
    if (!registry.get(name)?.size) registry.delete(name);
  };
  const descriptors = Object.fromEntries(['window', 'document', 'navigator', 'Audio'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const window = {
    AudioContext, Audio: Media, location: { search: '?debug' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setInterval(fn) { intervals.set(++id, fn); return id; },
    clearInterval(key) { intervals.delete(key); },
    setTimeout(fn) { timeouts.set(++id, fn); return id; },
    clearTimeout(key) { timeouts.delete(key); },
    addEventListener: on(windowListeners), removeEventListener: off(windowListeners),
  };
  const document = { hidden: false, addEventListener: on(documentListeners), removeEventListener: off(documentListeners) };
  for (const [key, value] of Object.entries({ window, document, Audio: Media, navigator: { userActivation: { hasBeenActive: true } } })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Media.instances = [];
  Media.nextPlay = [];
  Media.playLog = [];
  Media.requiresGesture = false;
  Media.inGesture = false;
  return {
    window, document, intervals, timeouts, windowListeners, documentListeners, storage,
    tick() { for (const fn of [...intervals.values()]) fn(); },
    flushTimeouts() { const pending = [...timeouts.entries()]; for (const [key, fn] of pending) { timeouts.delete(key); fn(); } },
    dispatch(name) { for (const registry of [windowListeners, documentListeners]) for (const fn of [...(registry.get(name) ?? [])]) fn(); },
    restore() {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
      }
    },
  };
}

function fixture(t) {
  const env = environment(), ctx = new AudioContext(), player = new MusicPlayer(ctx, ctx.destination);
  t.after(() => { player.dispose(); env.flushTimeouts(); env.restore(); });
  return { env, ctx, player };
}

async function play(player, track) {
  player.select(track);
  player.resume();
  await settle();
  return Media.playLog.filter(entry => entry.src === track.src).at(-1)?.media;
}

function finishFade({ env, ctx, player }) {
  ctx.currentTime += 10;
  player.update();
  env.flushTimeouts();
}

test('recorded tracks follow the menu and the landscape', () => {
  for (const place of ['plaine', 'orp', 'factory', 'marais', 'desert', 'taverne']) assert.equal(trackForPlace(place, 'intro'), TRACKS.firelit);
  for (const place of ['taverne', 'tavern']) assert.equal(trackForPlace(place), TRACKS.firelit);
  for (const place of ['plaine', 'foret', 'lac']) assert.equal(trackForPlace(place), TRACKS.peaceful);
  for (const place of ['orp', 'factory']) assert.equal(trackForPlace(place), TRACKS.funny);
  for (const place of ['marais', 'desert', 'cascade']) assert.equal(trackForPlace(place), TRACKS.ambient);
  for (const place of ['volcan', 'montagne', 'unknown']) assert.equal(trackForPlace(place), TRACKS.medieval);
  assert.equal(new Set(Object.values(TRACKS).map(track => track.src)).size, 5);
  for (const track of Object.values(TRACKS)) assert.match(track.src, /^\/.*\.mp3$/);
});

test('streamed music fades between tracks and keeps the same piece running across related lands', async t => {
  const f = fixture(t), { ctx, player } = f;
  const first = await play(player, TRACKS.firelit);
  assert.equal(first.paused, false);
  const source = ctx.nodes.find(node => node.media === first);
  assert.ok(source, 'recorded audio enters WebAudio through a media element source');
  assert.equal(source.connections[0]?.kind, 'gain');
  const voiceGain = source.connections[0];
  assert.ok(voiceGain.gain.events.some(event => event.value > 0));
  assert.ok(voiceGain.connections[0]?.connections.includes(ctx.destination), 'voice and music volume both feed the shared sound output');
  const deckCount = Media.instances.length;
  first.currentTime = 32;
  player.select(TRACKS.firelit);
  player.resume();
  await settle();
  assert.equal(Media.instances.length, deckCount);
  assert.equal(first.currentTime, 32);

  const second = await play(player, TRACKS.medieval);
  assert.equal(second.paused, false);
  assert.equal(first.paused, false, 'outgoing music remains alive during the crossfade');
  assert.ok(voiceGain.gain.events.some(event => event.value < 0.01), 'the outgoing voice fades down');
  finishFade(f);
  assert.equal(first.paused, true);
  assert.equal(voiceGain.gain.value, 0, 'the idle deck is silent and can be reused');
  assert.equal(second.paused, false);
  const level = ctx.nodes.find(node => node.kind === 'gain' && node.connections.includes(ctx.destination));
  player.setDucked(true);
  const ducked = level.gain.events.at(-1).value;
  player.setDucked(false);
  assert.ok(ducked < level.gain.events.at(-1).value, 'a moment lowers only the music bus');
  second.currentTime = 47;
  player.pause();
  assert.equal(second.paused, true);
  player.resume();
  await settle();
  assert.equal(second.paused, false);
  assert.equal(second.currentTime, 47, 'resuming retains the listening position');
});

test('an autoplay rejection keeps the outgoing track and retries inside the next gesture', async t => {
  const f = fixture(t), { player } = f;
  const first = await play(player, TRACKS.firelit);
  Media.nextPlay.push(() => Promise.reject(new DOMException('Gesture required', 'NotAllowedError')));
  const second = await play(player, TRACKS.medieval);
  assert.equal(first.paused, false, 'blocked incoming playback must not cut the old track');
  assert.equal(second.paused, true);
  const attempts = second.playCalls;
  player.resume(); await settle();
  assert.equal(second.playCalls, attempts, 'polling must not repeatedly hit the autoplay gate');
  player.resume(true); await settle();
  assert.equal(second.playCalls, attempts + 1);
  assert.equal(second.paused, false);
  finishFade(f);
  assert.equal(first.paused, true);
});

test('one gesture unlocks two persistent decks for later automatic changes and loops', async t => {
  const f = fixture(t), { player, ctx } = f;
  Media.requiresGesture = true;
  player.select(TRACKS.firelit);
  await settle();
  assert.equal(player.snapshot().pending, 'firelit');
  assert.ok(player.snapshot().voices.every(voice => voice.blocked));
  Media.inGesture = true;
  player.resume(true);
  Media.inGesture = false;
  assert.equal(Media.instances.length, 2);
  assert.ok(Media.instances.every(media => media.unlocked), 'both elements call play synchronously inside the initial gesture');
  await settle();
  assert.equal(player.snapshot().track, 'firelit');
  assert.equal(Media.instances.filter(media => !media.paused).length, 1, 'priming the spare deck stays silent and then pauses');
  for (const track of [TRACKS.medieval, TRACKS.funny, TRACKS.ambient]) {
    const current = await play(player, track);
    assert.equal(current.paused, false, `${track.id} can start outside a new user gesture`);
    assert.equal(player.snapshot().track, track.id);
    finishFade(f);
  }
  const current = Media.instances.find(media => !media.paused);
  current.currentTime = TRACKS.ambient.loopEnd - 2;
  player.update(); await settle();
  assert.equal(player.snapshot().pending, null, 'the next loop starts without another gesture');
  finishFade(f);
  assert.equal(player.snapshot().voices.length, 1);
  assert.equal(Media.instances.length, 2, 'track changes and loops reuse the two authorized elements');
  assert.equal(ctx.nodes.filter(node => node.kind === 'media').length, 2);
});

test('a transient media failure reloads the incoming recording on the next gesture', async t => {
  const f = fixture(t), { player } = f;
  const first = await play(player, TRACKS.firelit);
  Media.nextPlay.push(media => {
    media.error = { code: 2 };
    media.emit('error');
    return Promise.reject(new DOMException('Network error', 'NotSupportedError'));
  });
  const incoming = await play(player, TRACKS.medieval);
  assert.equal(first.paused, false);
  assert.equal(player.snapshot().pending, 'medieval');
  const loads = incoming.loadCalls, attempts = incoming.playCalls;
  player.resume(); await settle();
  assert.equal(incoming.playCalls, attempts, 'failed downloads wait for an explicit retry');
  player.resume(true); await settle();
  assert.equal(incoming.loadCalls, loads + 1);
  assert.equal(incoming.error, null);
  assert.equal(incoming.paused, false);
  assert.equal(player.snapshot().track, 'medieval');
  finishFade(f);
  assert.equal(first.paused, true);
});

test('the end of a recording overlaps its next loop and a returning piece remembers its position', async t => {
  const f = fixture(t), { player } = f;
  const first = await play(player, TRACKS.medieval);
  first.currentTime = TRACKS.medieval.loopEnd - 2;
  player.update(); await settle();
  const loop = Media.instances.at(-1);
  assert.notEqual(loop, first);
  assert.equal(loop.src, first.src);
  assert.equal(loop.currentTime, TRACKS.medieval.loopStart, 'soft loops skip only the recorded leading silence');
  assert.equal(first.paused, false, 'the tail overlaps the next loop');
  finishFade(f);
  assert.equal(first.paused, true);
  loop.currentTime = 38;
  await play(player, TRACKS.funny);
  finishFade(f);
  const returning = await play(player, TRACKS.medieval);
  assert.equal(returning.currentTime, 38, 'a short visit to another room does not replay the introduction');
});

test('late play promises cannot resurrect an abandoned or disposed track', async t => {
  const f = fixture(t), { player } = f;
  await play(player, TRACKS.firelit);
  const incoming = deferred();
  Media.nextPlay.push(() => incoming.promise);
  const abandoned = await play(player, TRACKS.medieval);
  const latest = await play(player, TRACKS.funny);
  assert.equal(latest, abandoned, 'the canceled incoming deck serves the latest destination');
  const pauses = latest.pauseCalls;
  incoming.resolve(); await settle();
  finishFade(f);
  assert.equal(latest.pauseCalls, pauses, 'an old play promise must not pause a reassigned deck');
  assert.equal(player.snapshot().track, 'funny');
  assert.equal(latest.paused, false);
  const pending = deferred();
  Media.nextPlay.push(() => pending.promise);
  const last = await play(player, TRACKS.ambient);
  player.dispose();
  pending.resolve(); await settle();
  assert.ok(Media.instances.every(media => media.paused), 'disposing cancels even playback that resolves later');
  assert.equal(last.src, '');
  assert.ok(f.ctx.nodes.filter(node => node.kind === 'media').every(node => node.disconnected));
});

test('the game honours phase, sound settings, page visibility and cleanup', async () => {
  const env = environment();
  let stop;
  try {
    setMuted(false);
    setMusicOn(true);
    setMusicPlace('factory');
    stop = startMusic();
    primeAudio(); env.dispatch('pointerdown'); env.tick(); await settle();
    const intro = Media.instances.find(media => media.src === TRACKS.firelit.src && !media.paused);
    assert.equal(intro?.src, TRACKS.firelit.src, 'scenery does not override the selection theme');
    assert.equal(intro.paused, false);
    setMusicPlace('plaine');
    setMusicPhase('adventure'); env.tick(); await settle();
    const adventure = Media.instances.find(media => media.src === TRACKS.peaceful.src && !media.paused);
    assert.equal(adventure.src, TRACKS.peaceful.src);
    const count = Media.instances.length;
    adventure.currentTime = 24;
    setMusicPlace('foret'); setMusicPhase('adventure'); env.tick(); await settle();
    assert.equal(Media.instances.length, count);
    assert.equal(adventure.currentTime, 24);
    setMusicDucked(true); setMusicDucked(false);

    const changes = [];
    const off = onMusicChange(on => changes.push(on));
    setMusicOn(false); await settle();
    assert.equal(isMusicOn(), false);
    assert.ok(Media.instances.every(media => media.paused));
    assert.equal(env.storage.get('louchomage:musique:v1'), '0');
    setMusicOn(true); env.tick(); await settle();
    assert.equal(adventure.paused, false);
    assert.equal(adventure.currentTime, 24);
    setMuted(true); await settle();
    assert.ok(Media.instances.every(media => media.paused));
    setMuted(false); env.tick(); await settle();
    assert.equal(adventure.paused, false);
    env.document.hidden = true; env.dispatch('visibilitychange'); await settle();
    assert.ok(Media.instances.every(media => media.paused));
    env.document.hidden = false; env.dispatch('visibilitychange'); await settle();
    assert.equal(adventure.paused, false);
    assert.deepEqual(changes, [false, true]);
    off();
    stop(); stop = undefined;
    env.flushTimeouts();
    assert.equal(env.intervals.size, 0);
    assert.equal(env.timeouts.size, 0);
    assert.equal(env.windowListeners.size, 0);
    assert.equal(env.documentListeners.size, 0);
    assert.ok(Media.instances.every(media => media.paused && media.src === ''));
    assert.ok(audioOutput().ctx.nodes.filter(node => node.kind === 'media').every(node => node.disconnected));
  } finally {
    stop?.();
    setMuted(false);
    env.flushTimeouts(); env.restore();
  }
});

test('a gesture retries an unresolved autoplay request; its late rejection cannot silence the new play', async t => {
  const {player}=fixture(t);
  let reject;
  Media.nextPlay.push(()=>new Promise((_,no)=>{reject=no;}));
  player.select(TRACKS.firelit);
  Media.inGesture=true;player.resume(true);Media.inGesture=false;
  await settle();assert.equal(player.snapshot().track,'firelit');
  reject(new DOMException('Autoplay blocked','NotAllowedError'));await settle();
  assert.ok(player.snapshot().voices.every(v=>!v.blocked&&!v.paused));
});

test('the first click unlocks music without userActivation and resumes an interrupted phone context', async()=>{
  const env=environment();let stop;
  try {
    delete navigator.userActivation;Media.requiresGesture=true;
    setMuted(false);setMusicOn(true);stop=startMusic();await settle();
    assert.equal(window.__musicState().track,null);
    const ctx=audioOutput().ctx;ctx.state='interrupted';
    assert.equal(audioOutput().ctx.state,'interrupted','polling the output never retries a blocked resume');
    Media.inGesture=true;env.dispatch('click');Media.inGesture=false;await settle();
    assert.equal(ctx.state,'running');assert.equal(window.__musicState().track,'firelit');
    assert.ok(Media.instances.every(m=>m.unlocked));
  } finally {stop?.();env.restore();}
});
