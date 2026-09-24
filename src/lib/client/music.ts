"use client";

import { currentDaylight } from "./daylight";
import { audioOutput, onMuteChange } from "./sound";

/**
 * Discreet background music, composed live with WebAudio: no file to download,
 * a new phrase every two bars, and a mood for each land. A soft pad holds the
 * chords, a plucked voice improvises on the scale with short repeated motifs, a
 * low note marks the bars. At night the tempo slows and the notes thin out.
 */

const MUSIC_KEY = "louchomage:musique:v1";

export interface Mood {
  /** MIDI note of the key's root. */
  root: number;
  /** Scale degrees the melody may use, in semitones from the root. */
  scale: number[];
  /** Chords, two bars each, in semitones from the root. */
  chords: number[][];
  bpm: number;
  /** Chance of a note on each eighth. */
  density: number;
  voice: "lute" | "flute" | "bell" | "harp";
  /** Six eighths to the bar for a jig, eight otherwise. */
  jig?: boolean;
  drum?: boolean;
}

const MAJOR_PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const MINOR_PENTA = [0, 3, 5, 7, 10, 12, 15, 17];

export const MOODS: Record<string, Mood> = {
  plaine: { root: 62, scale: MAJOR_PENTA, chords: [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]], bpm: 84, density: 0.42, voice: "lute" },
  foret: { root: 64, scale: [0, 2, 3, 7, 9, 10, 12, 14], chords: [[0, 3, 7], [5, 9, 12], [0, 3, 7], [-2, 2, 5]], bpm: 74, density: 0.36, voice: "flute" },
  marais: { root: 57, scale: MINOR_PENTA, chords: [[0, 3, 7], [-4, 0, 3], [5, 8, 12], [0, 3, 7]], bpm: 64, density: 0.28, voice: "harp" },
  lac: { root: 65, scale: [0, 2, 4, 6, 7, 11, 12, 14], chords: [[0, 4, 7], [2, 6, 9], [0, 4, 7], [7, 11, 14]], bpm: 70, density: 0.32, voice: "bell" },
  cascade: { root: 60, scale: MINOR_PENTA, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], bpm: 70, density: 0.36, voice: "harp" },
  montagne: { root: 67, scale: [0, 2, 4, 5, 7, 9, 10, 12], chords: [[0, 4, 7], [-2, 2, 5], [5, 9, 12], [0, 4, 7]], bpm: 78, density: 0.34, voice: "flute" },
  desert: { root: 62, scale: [0, 1, 4, 5, 7, 8, 10, 12], chords: [[0, 7, 12], [0, 7, 12], [1, 5, 8], [0, 7, 12]], bpm: 88, density: 0.38, voice: "lute", drum: true },
  taverne: { root: 67, scale: MAJOR_PENTA, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bpm: 108, density: 0.55, voice: "lute", jig: true, drum: true },
};

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type Rand = () => number;

/** One running piece: a clock, the current chord and the phrase being repeated. */
export class Composer {
  private next = 0;
  private step = 0;
  private chord = -1;
  private motif: Array<number | null> = [];
  private mood: Mood;
  private night = 0;
  private pending: { mood: Mood; night: number } | null = null;

  constructor(private ctx: BaseAudioContext, private dest: AudioNode, mood: Mood, private random: Rand = Math.random) {
    this.mood = mood;
  }

  setMood(mood: Mood, night: number) {
    // Changes wait for the next bar, so a new land never cuts a phrase.
    this.pending = { mood, night };
  }

  private get perBar() { return this.mood.jig ? 6 : 8; }

  private get eighth() {
    const bpm = this.mood.bpm * (1 - this.night * 0.18);
    return this.mood.jig ? 60 / bpm / 3 : 60 / bpm / 2;
  }

  /** Schedule every note that starts before `until`, in the context's time. */
  schedule(until: number) {
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + 0.08;
    while (this.next < until) {
      this.play(this.next);
      this.next += this.eighth;
      this.step += 1;
    }
  }

  private play(t: number) {
    const position = this.step % this.perBar;
    const bar = Math.floor(this.step / this.perBar);
    if (position === 0) {
      if (this.pending) {
        this.mood = this.pending.mood;
        this.night = this.pending.night;
        this.pending = null;
      }
      if (bar % 2 === 0) this.changeChord(t);
      this.bass(t);
    }
    if (!this.mood.jig && position === 4) this.bass(t, 0.6);
    if (this.mood.drum) this.drum(t, position);

    const phrase = this.step % (this.perBar * 2);
    if (phrase === 0) this.compose();
    const note = this.motif[phrase];
    if (note !== null && note !== undefined) this.melody(t, note, position === 0);
  }

  private changeChord(t: number) {
    this.chord = (this.chord + 1) % this.mood.chords.length;
    const length = this.eighth * this.perBar * 2;
    for (const interval of this.mood.chords[this.chord]) this.pad(t, hz(this.mood.root - 12 + interval), length);
  }

  /** A two-bar phrase, repeated with small changes half of the time: music, not noise. */
  private compose() {
    const length = this.perBar * 2;
    const density = this.mood.density * (1 - this.night * 0.45);
    if (this.motif.length === length && this.random() < 0.5) {
      this.motif = this.motif.map((note) => (this.random() < 0.2 ? this.pick(note) : note));
      return;
    }
    let previous = 2;
    this.motif = Array.from({ length }, (_, i) => {
      const strong = i % (this.mood.jig ? 3 : 4) === 0;
      if (this.random() > (strong ? density * 1.5 : density)) return null;
      // A melodic walk: mostly neighbouring degrees, sometimes a leap.
      const leap = this.random() < 0.2 ? Math.floor(this.random() * 5) - 2 : Math.floor(this.random() * 3) - 1;
      previous = Math.max(0, Math.min(this.mood.scale.length - 1, previous + leap));
      return previous;
    });
    // The phrase comes home: its last strong beat is the root.
    this.motif[length - (this.mood.jig ? 3 : 4)] = 0;
  }

  private pick(note: number | null): number | null {
    if (note === null) return this.random() < 0.3 ? Math.floor(this.random() * this.mood.scale.length) : null;
    return Math.max(0, Math.min(this.mood.scale.length - 1, note + (this.random() < 0.5 ? -1 : 1)));
  }

  private envelope(t: number, peak: number, attack: number, length: number) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    return gain;
  }

  private voice(type: OscillatorType, freq: number, t: number, length: number, into: AudioNode, detune = 0) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime(detune, t);
    osc.connect(into);
    osc.start(t);
    osc.stop(t + length + 0.05);
    return osc;
  }

  private pad(t: number, freq: number, length: number) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 650 - this.night * 200;
    const gain = this.envelope(t, 0.022, Math.min(1.4, length * 0.3), length + 1.2);
    filter.connect(gain).connect(this.dest);
    this.voice("triangle", freq, t, length + 1.2, filter, -6);
    this.voice("triangle", freq, t, length + 1.2, filter, 6);
  }

  private bass(t: number, weight = 1) {
    const root = this.mood.chords[Math.max(0, this.chord)][0];
    const gain = this.envelope(t, 0.07 * weight, 0.02, this.eighth * 3.5);
    gain.connect(this.dest);
    this.voice("sine", hz(this.mood.root - 24 + root), t, this.eighth * 3.5, gain);
  }

  private melody(t: number, degree: number, accent: boolean) {
    const freq = hz(this.mood.root + this.mood.scale[degree]);
    const peak = (accent ? 0.075 : 0.055) * (1 - this.night * 0.3);
    const { voice } = this.mood;
    if (voice === "flute") {
      const length = this.eighth * 1.8;
      const gain = this.envelope(t, peak * 1.1, 0.07, length);
      gain.connect(this.dest);
      const osc = this.voice("sine", freq, t, length, gain);
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = 5;
      depth.gain.value = freq * 0.006;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + length + 0.05);
      return;
    }
    if (voice === "bell" || this.night > 0.6) {
      const length = 2.2;
      const gain = this.envelope(t, peak * 0.7, 0.004, length);
      gain.connect(this.dest);
      this.voice("sine", freq, t, length, gain);
      const partial = this.envelope(t, peak * 0.18, 0.004, length * 0.4);
      partial.connect(this.dest);
      this.voice("sine", freq * 2.76, t, length * 0.4, partial);
      return;
    }
    // Lute and harp: a plucked string, bright at the attack and quickly muted.
    const length = voice === "harp" ? 1.6 : 0.9;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(voice === "harp" ? 2600 : 3200, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + length * 0.6);
    const gain = this.envelope(t, peak, 0.004, length);
    filter.connect(gain).connect(this.dest);
    this.voice("triangle", freq, t, length, filter);
    this.voice("sawtooth", freq, t, length * 0.3, filter, 4);
  }

  private drum(t: number, position: number) {
    const strong = this.mood.jig ? position % 3 === 0 : position % 4 === 0;
    if (!strong && this.random() > 0.3) return;
    const gain = this.envelope(t, strong ? 0.09 : 0.03, 0.003, strong ? 0.22 : 0.08);
    gain.connect(this.dest);
    const osc = this.voice("sine", strong ? 110 : 220, t, 0.25, gain);
    osc.frequency.exponentialRampToValueAtTime(strong ? 55 : 160, t + 0.2);
  }
}

/** The echo that gives the room: a short delay, darkened, fed back a little. */
export function musicBus(ctx: BaseAudioContext, out: AudioNode): { input: GainNode; level: GainNode } {
  const level = ctx.createGain();
  const input = ctx.createGain();
  const delay = ctx.createDelay(1);
  const feedback = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  const wet = ctx.createGain();
  delay.delayTime.value = 0.34;
  feedback.gain.value = 0.3;
  tone.type = "lowpass";
  tone.frequency.value = 1800;
  wet.gain.value = 0.28;
  input.connect(level);
  input.connect(delay);
  delay.connect(tone).connect(feedback).connect(delay);
  tone.connect(wet).connect(level);
  level.connect(out);
  return { input, level };
}

/* ------------------------------------------------------------------ player */

let enabled = readEnabled();
const listeners = new Set<(on: boolean) => void>();
let composer: Composer | null = null;
let bus: { input: GainNode; level: GainNode } | null = null;
let timer: number | null = null;
let land = "plaine";
let night = { value: 0, at: 0 };
let duck = 1;
/** The music's gain into the master: about 10 dB under the effects' peaks. */
const LEVEL = 3;

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(MUSIC_KEY) !== "0";
  } catch {
    return true;
  }
}

export function isMusicOn(): boolean {
  return enabled;
}

export function onMusicChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMusicOn(value: boolean): void {
  enabled = value;
  try {
    window.localStorage.setItem(MUSIC_KEY, value ? "1" : "0");
  } catch {
    // The choice lasts for this visit only.
  }
  applyLevel(0.6);
  listeners.forEach((listener) => listener(value));
  if (value) run();
}

function applyLevel(fade: number) {
  if (!bus) return;
  const { context } = bus.level;
  const target = enabled ? LEVEL * duck : 0.0001;
  bus.level.gain.cancelScheduledValues(context.currentTime);
  bus.level.gain.setTargetAtTime(Math.max(0.0001, target), context.currentTime, fade / 3);
}

function tick() {
  if (!enabled || document.hidden) return;
  const output = audioOutput();
  if (!output) return;
  const { ctx, out } = output;
  if (!bus) {
    bus = musicBus(ctx, out);
    bus.level.gain.value = 0.0001;
    applyLevel(3);
  }
  // The hour moves slowly: read it twice a minute.
  if (performance.now() - night.at > 30_000) night = { value: currentDaylight().night, at: performance.now() };
  const mood = MOODS[land] ?? MOODS.plaine;
  if (!composer) composer = new Composer(ctx, bus.input, mood);
  composer.setMood(mood, night.value);
  composer.schedule(ctx.currentTime + 0.9);
}

function run() {
  if (timer !== null || typeof window === "undefined") return;
  timer = window.setInterval(tick, 250);
  tick();
}

/**
 * Start the music once the page may make sound; it waits for the first gesture.
 * The land and the hour steer it, and it steps back under a mini-game.
 */
export function startMusic(): () => void {
  // Diagnostics only: `?debug` can render a few seconds of any land offline.
  if (new URLSearchParams(window.location.search).has("debug")) {
    (window as unknown as { __musicPreview?: typeof renderPreview }).__musicPreview = renderPreview;
  }
  run();
  const offMute = onMuteChange((muted) => { if (!muted) run(); });
  const onVisible = () => { if (!document.hidden) tick(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    offMute();
    document.removeEventListener("visibilitychange", onVisible);
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    if (bus) {
      const { level } = bus;
      level.gain.setTargetAtTime(0.0001, level.context.currentTime, 0.2);
      window.setTimeout(() => level.disconnect(), 1200);
    }
    bus = null;
    composer = null;
  };
}

/** A few seconds of a land's music, rendered offline at the game's own levels. */
export async function renderPreview(where: string, seconds: number, dark = 0): Promise<AudioBuffer> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, rate * seconds, rate);
  const master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);
  const preview = musicBus(ctx, master);
  preview.level.gain.value = LEVEL;
  const mood = MOODS[where] ?? MOODS.plaine;
  const composer = new Composer(ctx, preview.input, mood);
  composer.setMood(mood, dark);
  composer.schedule(seconds);
  return ctx.startRendering();
}

export function steerMusic(where: string, ducked: boolean): void {
  land = where;
  const nextDuck = ducked ? 0.3 : 1;
  if (nextDuck !== duck) {
    duck = nextDuck;
    applyLevel(0.8);
  }
}
