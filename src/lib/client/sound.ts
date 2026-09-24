"use client";

/**
 * Every sound of the game is synthesised with WebAudio: nothing to download,
 * a few lines per effect, and the same voice everywhere. Browsers only let a
 * page make noise after a user gesture, which every action click is.
 */

const MUTE_KEY = "louchomage:son:v1";
type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = readMuted();

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // The choice lasts for this visit only.
  }
  if (master) master.gain.value = value ? 0 : 0.32;
  listeners.forEach((listener) => listener(value));
}

export function onMuteChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined" || muted) return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      // No audio device: the game stays silent rather than failing an action.
      muted = true;
      return null;
    }
    master = context.createGain();
    master.gain.value = 0.32;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(context.destination);
  }
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context && master ? { ctx: context, out: master } : null;
}

function whiteNoise(ctx: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

interface ToneOptions {
  freq: number;
  to?: number;
  type?: OscillatorType;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  vibrato?: number;
}

function tone(opts: ToneOptions): void {
  const a = audio();
  if (!a) return;
  const { ctx, out } = a;
  const start = ctx.currentTime + (opts.at ?? 0);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), start + opts.dur);
  if (opts.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 7;
    depth.gain.value = opts.vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + opts.dur + 0.05);
  }
  const peak = opts.gain ?? 0.5;
  const attack = opts.attack ?? 0.01;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + opts.dur + 0.05);
}

interface NoiseOptions {
  at?: number;
  dur: number;
  gain?: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  attack?: number;
}

function hiss(opts: NoiseOptions): void {
  const a = audio();
  if (!a) return;
  const { ctx, out } = a;
  const start = ctx.currentTime + (opts.at ?? 0);
  const source = ctx.createBufferSource();
  source.buffer = whiteNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter ?? "lowpass";
  filter.frequency.setValueAtTime(opts.freq ?? 1200, start);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, start + opts.dur);
  filter.Q.value = opts.q ?? 0.8;
  const env = ctx.createGain();
  const peak = opts.gain ?? 0.4;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + (opts.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
  source.connect(filter).connect(env).connect(out);
  source.start(start, Math.random());
  source.stop(start + opts.dur + 0.05);
}

const NOTE = (semitones: number) => 523.25 * Math.pow(2, semitones / 12);

/**
 * Creating an AudioContext costs a couple of hundred milliseconds on some
 * systems. Browsers allow it on the first user gesture anywhere on the page,
 * so do it then, when nothing is animating, instead of on the first action.
 */
export function warmUpAudio(): () => void {
  if (typeof window === "undefined") return () => {};
  const warm = () => {
    remove();
    // Let the gesture's own work finish first.
    window.setTimeout(() => {
      const a = audio();
      if (a) whiteNoise(a.ctx);
    }, 0);
  };
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const remove = () => events.forEach((name) => window.removeEventListener(name, warm, true));
  events.forEach((name) => window.addEventListener(name, warm, { capture: true, passive: true }));
  return remove;
}

let lastTick = 0;

/** The game's sound palette. Each call is fire-and-forget and silent when muted. */
export const sfx = {
  /** A tap on an action button. */
  press() { tone({ freq: 660, to: 880, dur: 0.07, type: "triangle", gain: 0.18 }); },
  whoosh() { hiss({ dur: 0.32, filter: "bandpass", freq: 500, to: 2400, q: 1.2, gain: 0.35, attack: 0.08 }); },
  /** A pigeon's "hoo-hoo", then its wings. */
  coo() {
    tone({ freq: 360, to: 300, dur: 0.2, type: "sine", gain: 0.35, vibrato: 12, attack: 0.04 });
    tone({ freq: 340, to: 280, dur: 0.24, type: "sine", gain: 0.3, vibrato: 12, attack: 0.04, at: 0.24 });
    for (let i = 0; i < 4; i++) hiss({ at: 0.05 + i * 0.07, dur: 0.05, filter: "bandpass", freq: 900, q: 1, gain: 0.12 });
  },
  flap() { hiss({ dur: 0.06, filter: "bandpass", freq: 700, q: 1.4, gain: 0.18 }); },
  thunder() {
    hiss({ dur: 0.18, filter: "highpass", freq: 1800, gain: 0.7, attack: 0.002 });
    hiss({ at: 0.05, dur: 1.4, filter: "lowpass", freq: 260, to: 90, gain: 0.9, attack: 0.05 });
    tone({ at: 0.03, freq: 70, to: 38, dur: 1.1, type: "sine", gain: 0.5 });
  },
  stamp() {
    tone({ freq: 160, to: 48, dur: 0.22, type: "sine", gain: 0.8, attack: 0.003 });
    hiss({ dur: 0.07, filter: "bandpass", freq: 2500, q: 0.9, gain: 0.35 });
  },
  boom() {
    tone({ freq: 90, to: 30, dur: 0.9, type: "sine", gain: 0.9, attack: 0.004 });
    hiss({ dur: 0.9, filter: "lowpass", freq: 700, to: 120, gain: 0.7 });
    hiss({ dur: 0.1, filter: "highpass", freq: 3000, gain: 0.4 });
  },
  /** A cork, then the fizz. */
  pop() {
    tone({ freq: 700, to: 180, dur: 0.09, type: "sine", gain: 0.6, attack: 0.002 });
    hiss({ at: 0.06, dur: 0.6, filter: "highpass", freq: 5000, gain: 0.12, attack: 0.05 });
  },
  chime() {
    tone({ freq: 1046.5, dur: 1.2, gain: 0.25, attack: 0.005 });
    tone({ freq: 1568, dur: 0.9, gain: 0.12, attack: 0.005 });
  },
  coin() {
    tone({ freq: 988, dur: 0.07, type: "square", gain: 0.14 });
    tone({ at: 0.07, freq: 1319, dur: 0.22, type: "square", gain: 0.14 });
  },
  /** Discreet ticks while a counter climbs; rate-limited. */
  tick() {
    const now = performance.now();
    if (now - lastTick < 70) return;
    lastTick = now;
    tone({ freq: 1760, dur: 0.03, type: "square", gain: 0.05 });
  },
  fanfare() {
    [0, 4, 7, 12].forEach((note, i) => tone({ at: i * 0.11, freq: NOTE(note), dur: 0.16, type: "square", gain: 0.16 }));
    [0, 4, 7, 12].forEach((note) => tone({ at: 0.46, freq: NOTE(note), dur: 0.9, type: "triangle", gain: 0.14, attack: 0.02 }));
  },
  firework() {
    tone({ freq: 500, to: 1900, dur: 0.45, type: "sine", gain: 0.1, attack: 0.05 });
    hiss({ at: 0.45, dur: 0.6, filter: "lowpass", freq: 3000, to: 400, gain: 0.5, attack: 0.002 });
  },
  sad() {
    [0, -1, -2].forEach((note, i) => tone({ at: i * 0.28, freq: NOTE(note - 12), dur: 0.3, type: "sawtooth", gain: 0.12, vibrato: 4 }));
    tone({ at: 0.84, freq: NOTE(-15), to: NOTE(-17), dur: 0.7, type: "sawtooth", gain: 0.12, vibrato: 8 });
  },
  win() {
    [0, 4, 7].forEach((note, i) => tone({ at: i * 0.09, freq: NOTE(note + 12), dur: 0.14, type: "triangle", gain: 0.2 }));
    tone({ at: 0.27, freq: NOTE(24), dur: 0.5, type: "triangle", gain: 0.2 });
  },
  hit() {
    tone({ freq: 220, to: 90, dur: 0.12, type: "square", gain: 0.2 });
    hiss({ dur: 0.08, filter: "lowpass", freq: 900, gain: 0.3 });
  },
  pass() { tone({ freq: 1320, dur: 0.08, type: "triangle", gain: 0.12 }); },
  chest() {
    tone({ freq: 110, to: 160, dur: 0.35, type: "sawtooth", gain: 0.08, vibrato: 20 });
    [0, 4, 7, 11, 14].forEach((note, i) => tone({ at: 0.35 + i * 0.06, freq: NOTE(note + 12), dur: 0.35, gain: 0.12 }));
  },
  /** The recruiter-frog's croak, when the real message lands. */
  croak() {
    tone({ freq: 140, to: 95, dur: 0.22, type: "sawtooth", gain: 0.3, vibrato: 30, attack: 0.02 });
    tone({ at: 0.24, freq: 150, to: 100, dur: 0.26, type: "sawtooth", gain: 0.3, vibrato: 30, attack: 0.02 });
  },
  /** A cold shower from a small cloud. */
  rain() {
    hiss({ dur: 1.6, filter: "bandpass", freq: 3200, q: 0.6, gain: 0.16, attack: 0.25 });
    hiss({ dur: 1.4, filter: "lowpass", freq: 700, gain: 0.12, attack: 0.3 });
  },
  /** A heavy landing at the end of a long run. */
  land() {
    tone({ freq: 120, to: 55, dur: 0.16, type: "sine", gain: 0.35, attack: 0.003 });
    hiss({ dur: 0.12, filter: "lowpass", freq: 900, to: 300, gain: 0.25 });
  },
  /** Knocked back: a cartoon spring. */
  boing() {
    tone({ freq: 180, to: 520, dur: 0.22, type: "triangle", gain: 0.22, vibrato: 18, attack: 0.005 });
    tone({ at: 0.18, freq: 480, to: 260, dur: 0.2, type: "triangle", gain: 0.14, vibrato: 14 });
  },
  /** The mini-game invitation: two bright notes. */
  invite() {
    tone({ freq: NOTE(7), dur: 0.12, type: "triangle", gain: 0.16 });
    tone({ at: 0.1, freq: NOTE(12), dur: 0.25, type: "triangle", gain: 0.16 });
  },
};
