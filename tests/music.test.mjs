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
  setValueAtTime(value, at) { this.events.push({ value, at }); }
  exponentialRampToValueAtTime(value, at) { this.events.push({ value, at }); }
  setTargetAtTime(value, at) { this.events.push({ value, at }); }
  cancelScheduledValues() {}
}

class AudioNode {
  gain = new Param(); frequency = new Param(); detune = new Param();
  delayTime = new Param(); threshold = new Param(); ratio = new Param();
  constructor(context, kind) { this.context = context; this.kind = kind; }
  connect(node) { return node; }
  disconnect() { this.disconnected = true; }
  start(at) { this.started = at; }
  stop(at) { this.stopped = at; }
}

class AudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  nodes = [];
  destination = new AudioNode(this, 'destination');
  node(kind) { const node = new AudioNode(this, kind); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createOscillator() { return this.node('oscillator'); }
  createBiquadFilter() { return this.node('filter'); }
  createDelay() { return this.node('delay'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createBufferSource() { return this.node('noise'); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
}

const { Composer, MOODS, startMusic, setMusicPlace, setMusicPhase, setMusicDucked, setMusicOn } = await import('../src/lib/client/music.ts');
const { primeAudio, audioOutput, setMuted } = await import('../src/lib/client/sound.ts');
const kicks = nodes => nodes.filter(node => node.kind === 'oscillator' && node.frequency.events[0]?.value === 135);

test('selection stays calm; entering the game starts its rhythmic theme and honours sound settings', () => {
  const intervals = new Map(), timeouts = new Map(), listeners = new Map();
  let id = 0;
  globalThis.window = {
    AudioContext, location: { search: '?debug&hour=12' },
    localStorage: { getItem: () => null, setItem() {} },
    setInterval(fn) { intervals.set(++id, fn); return id; },
    clearInterval(key) { intervals.delete(key); },
    setTimeout(fn) { timeouts.set(++id, fn); return id; },
  };
  globalThis.document = { hidden: false,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userActivation: { hasBeenActive: true } } });
  primeAudio();
  const { ctx } = audioOutput();
  const stop = startMusic();
  const tick = [...intervals.values()][0];
  try {
    assert.equal(kicks(ctx.nodes).length, 0);
    setMusicPlace('factory'); // The visible scenery must not override the selection theme.
    ctx.currentTime = 1; tick();
    assert.equal(ctx.nodes.filter(node => node.kind === 'noise').length, 0);

    setMusicPlace('plaine');
    let before = ctx.nodes.length;
    setMusicPhase('adventure');
    assert.equal(kicks(ctx.nodes.slice(before)).length, 1, 'departure starts on its first downbeat');
    assert.ok(ctx.nodes.slice(before).some(node => node.kind === 'noise'), 'percussion joins on entry');
    before = ctx.nodes.length;
    setMusicPhase('adventure');
    assert.equal(ctx.nodes.length, before, 'repeated identity updates must not restart the theme');

    ctx.currentTime = 2; tick();
    const beatTimes = kicks(ctx.nodes).map(node => node.started);
    assert.ok(Math.abs(beatTimes[1] - beatTimes[0] - 120 / 116) < 0.001, 'the departure has a 116 BPM pulse');
    setMusicDucked(true);
    assert.ok(ctx.nodes.some(node => Math.abs((node.gain.events.at(-1)?.value ?? 0) - 0.9) < 0.001));

    before = ctx.nodes.length;
    setMusicOn(false); ctx.currentTime = 3; tick();
    assert.equal(ctx.nodes.length, before);
    setMusicOn(true); setMuted(true); tick();
    assert.equal(ctx.nodes.length, before);
    setMuted(false); tick();
    assert.ok(ctx.nodes.length > before);

    before = ctx.nodes.length;
    setMusicPhase('intro');
    assert.equal(ctx.nodes.slice(before).filter(node => node.kind === 'noise').length, 0);
    assert.equal(kicks(ctx.nodes.slice(before)).length, 0);
  } finally {
    stop();
    for (const fn of timeouts.values()) fn();
    assert.equal(intervals.size, 0);
    assert.equal(listeners.size, 0);
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
    delete globalThis.window; delete globalThis.document;
  }
});

test('nightfall keeps the adventure melody and backbeat', () => {
  const ctx = new AudioContext();
  const piece = new Composer(ctx, ctx.destination, MOODS.plaine, () => 0.5);
  piece.setMood(MOODS.plaine, 1);
  piece.schedule(2);
  assert.ok(kicks(ctx.nodes).length >= 2);
  assert.ok(ctx.nodes.some(node => node.type === 'sawtooth'), 'the plucked lead does not become sparse night bells');
  const frequencies = ctx.nodes.filter(node => node.kind === 'oscillator').flatMap(node => node.frequency.events.map(event => event.value));
  assert.ok(frequencies.every(Number.isFinite));
});

test('changing room on an odd bar resets the chord and phrase for its new metre', () => {
  const ctx = new AudioContext();
  const piece = new Composer(ctx, ctx.destination, MOODS.plaine, () => 0.5);
  piece.schedule(1.8);
  const before = ctx.nodes.length;
  piece.setMood({ root: 60, scale: [0], chords: [[0]], bpm: 90, density: 1, voice: 'lute', jig: true, motif: [0, null, 0, null, 0, null, 0, null, 0, null, 0, null] }, 0);
  piece.schedule(5);
  const notes = ctx.nodes.slice(before).filter(node => node.kind === 'oscillator');
  assert.ok(notes.length > 0);
  assert.ok(notes.every(node => node.frequency.events.every(event => Number.isFinite(event.value))));
  assert.ok(notes.some(node => Math.abs(node.frequency.events[0]?.value - 130.8128) < 0.01), 'the new pad begins with its own tonic');
});
