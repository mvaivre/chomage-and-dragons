"use client";

import { audioOutput, isMuted, onMuteChange, primeAudio } from "./sound";

const MUSIC_KEY = "louchomage:musique:v1";
const LEVEL = 1.2;
const FADE = 2.5;

export interface MusicTrack {
  id: string;
  src: string;
  title: string;
  artist: string;
  /** Match the supplied recordings to approximately -20 LUFS without re-encoding. */
  gain: number;
  /** Skip only silence; the original files and their musical fades are preserved. */
  loopStart: number;
  loopEnd: number;
}

export const TRACKS: Record<"firelit" | "medieval" | "ambient" | "funny", MusicTrack> = {
  firelit: { id: "firelit", src: "/audio/music/firelit-tavern.mp3", title: "Fantasy Worlds — Firelit Tavern", artist: "vadim_makes_sound", gain: 0.481, loopStart: 0.54, loopEnd: 134.88 },
  medieval: { id: "medieval", src: "/audio/music/medieval.mp3", title: "Medieval", artist: "SigmaMusicArt", gain: 0.689, loopStart: 0.45, loopEnd: 110.97 },
  ambient: { id: "ambient", src: "/audio/music/city-tavern-ambient.mp3", title: "Medieval City / Tavern Ambient", artist: "DEUSLOWER", gain: 1.39, loopStart: 6.95, loopEnd: 161.97 },
  funny: { id: "funny", src: "/audio/music/funny-medieval.mp3", title: "Funny Medieval Instrumental", artist: "VifotoFreeSounds", gain: 0.433, loopStart: 0.14, loopEnd: 112.248 },
};

export type MusicPhase = "intro" | "adventure";

export function trackForPlace(where: string, phase: MusicPhase = "adventure"): MusicTrack {
  if (phase === "intro" || where === "taverne" || where === "tavern") return TRACKS.firelit;
  if (where === "orp" || where === "factory") return TRACKS.funny;
  if (where === "marais" || where === "desert") return TRACKS.ambient;
  return TRACKS.medieval;
}

interface Deck {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  token: number;
  unlocked: boolean;
  priming: boolean;
}

interface Voice {
  track: MusicTrack;
  deck: Deck;
  token: number;
  offset: number;
  audio: HTMLAudioElement;
  gain: GainNode;
  starting: boolean;
  blocked: boolean;
  releaseAt: number | null;
  onMetadata: () => void;
  onError: () => void;
}

/**
 * Stream only the current recording. Each incoming track starts silently before
 * the previous one fades; a slow download or blocked play never cuts it off.
 * Recorded instruments go straight to the mix, without the old synthetic echo.
 */
export class MusicPlayer {
  private ctx: AudioContext;
  private level: GainNode;
  private decks: Deck[] = [];
  private voices = new Set<Voice>();
  private positions = new Map<string, number>();
  private track: MusicTrack | null = null;
  private current: Voice | null = null;
  private incoming: Voice | null = null;
  private paused = false;
  private disposed = false;

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.level = ctx.createGain();
    this.level.gain.value = LEVEL;
    this.level.connect(out);
  }

  select(track: MusicTrack) {
    if (this.disposed) return;
    this.track = track;
    if (this.incoming && this.incoming.track.id !== track.id) this.release(this.incoming);
    if (this.current?.track.id === track.id || this.incoming || this.paused) return;
    this.begin(track);
  }

  private createDeck(track: MusicTrack): Deck {
    const audio = new Audio(track.src);
    audio.preload = "auto";
    audio.loop = true; // Fallback if the browser throttles the loop polling timer.
    const source = this.ctx.createMediaElementSource(audio);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.level);
    const deck = { audio, source, gain, token: 0, unlocked: false, priming: false };
    this.decks.push(deck);
    return deck;
  }

  private idleDeck(track: MusicTrack): Deck {
    let deck = this.decks.find((candidate) => ![...this.voices].some((voice) => voice.deck === candidate));
    if (!deck && this.decks.length === 2) {
      // A third destination during a fade reuses the retiring deck.
      const retiring = [...this.voices].find((voice) => voice !== this.current);
      if (retiring) { this.release(retiring); deck = retiring.deck; }
    }
    return deck ?? this.createDeck(track);
  }

  private begin(track: MusicTrack, loop = false) {
    const deck = this.idleDeck(track);
    const { audio, gain } = deck;
    deck.token += 1;
    deck.priming = false;
    gain.gain.cancelScheduledValues(this.ctx.currentTime);
    gain.gain.value = 0;
    audio.src = track.src;
    audio.load();
    const saved = loop ? track.loopStart : this.positions.get(track.id) ?? track.loopStart;
    const offset = saved < track.loopEnd - FADE ? saved : track.loopStart;
    const onMetadata = () => {
      try {
        audio.currentTime = voice.offset;
      } catch { /* Safari may wait for metadata before allowing a seek. */ }
    };
    const voice: Voice = {
      track, deck, token: deck.token, offset, audio, gain, starting: false, blocked: false, releaseAt: null,
      onMetadata,
      onError: () => { voice.blocked = true; },
    };
    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("error", voice.onError);
    onMetadata();
    this.voices.add(voice);
    this.incoming = voice;
    this.play(voice);
  }

  private play(voice: Voice, retryBlocked = false) {
    if (this.paused || this.disposed || voice.starting || (voice.blocked && !retryBlocked)) return;
    if (voice !== this.incoming && !voice.audio.paused && !voice.audio.error) return;
    voice.starting = true;
    voice.blocked = false;
    if (retryBlocked && voice.audio.error) {
      voice.offset = Math.max(voice.track.loopStart, voice.audio.currentTime);
      voice.audio.load(); // Recover a transient download/decode failure before retrying.
    }
    // play() must be called synchronously during a gesture for Safari/iOS.
    let started: Promise<void>;
    try { started = voice.audio.play(); }
    catch { voice.starting = false; voice.blocked = true; return; }
    void started.then(() => {
      voice.deck.unlocked = true;
      voice.starting = false;
      // An earlier play promise must never pause a deck that has been reassigned.
      if (voice.token !== voice.deck.token) return;
      if (this.paused || this.disposed) { voice.audio.pause(); return; }
      if (voice !== this.incoming) return;
      const previous = this.current;
      this.current = voice;
      this.incoming = null;
      this.fade(voice, voice.track.gain, previous ? FADE : 1.2);
      if (previous) {
        this.fade(previous, 0, FADE);
        previous.releaseAt = this.ctx.currentTime + FADE + 0.1;
      }
    }).catch(() => {
      if (voice.token !== voice.deck.token) return;
      voice.starting = false;
      voice.blocked = true;
      // Wait for a real gesture; polling a rejected play() would flood the browser.
    });
  }

  private fade(voice: Voice, value: number, seconds: number) {
    const now = this.ctx.currentTime;
    const current = voice.gain.gain.value;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(current, now);
    voice.gain.gain.linearRampToValueAtTime(value, now + seconds);
  }

  resume(retryBlocked = false) {
    if (this.disposed) return;
    this.paused = false;
    if (this.track) this.select(this.track);
    if (this.current) this.play(this.current, retryBlocked);
    if (this.incoming) this.play(this.incoming, retryBlocked);
    if (retryBlocked && this.track) this.unlockSpare(this.track);
  }

  private unlockSpare(track: MusicTrack) {
    if ([...this.voices].length === 2) return;
    const deck = this.idleDeck(track);
    if (deck.unlocked || deck.priming) return;
    deck.priming = true;
    const token = ++deck.token;
    deck.audio.src = track.src;
    deck.audio.load();
    const finish = () => {
      if (token !== deck.token) return;
      deck.priming = false;
      deck.audio.pause();
      deck.audio.removeAttribute("src");
      deck.audio.load();
    };
    // Safari grants autoplay per element. Prime both persistent decks inside the
    // gesture, with the idle one at zero gain, then reuse them for all recordings.
    try {
      void deck.audio.play().then(() => {
        deck.unlocked = true;
        finish();
      }).catch(finish);
    } catch { finish(); }
  }

  pause() {
    if (this.disposed || this.paused) return;
    this.paused = true;
    for (const voice of this.voices) {
      if (voice !== this.current) this.release(voice);
    }
    if (this.current) {
      this.current.audio.pause();
      this.current.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.current.gain.gain.value = this.current.track.gain;
    }
    for (const deck of this.decks) {
      if (!deck.priming) continue;
      deck.token += 1;
      deck.priming = false;
      deck.audio.pause();
      deck.audio.removeAttribute("src");
      deck.audio.load();
    }
  }

  setDucked(ducked: boolean) {
    if (this.disposed) return;
    this.level.gain.cancelScheduledValues(this.ctx.currentTime);
    this.level.gain.setTargetAtTime(LEVEL * (ducked ? 0.3 : 1), this.ctx.currentTime, 0.25);
  }

  /** Poll media time for a soft loop and collect voices after their fade. */
  update() {
    if (this.disposed || this.paused) return;
    for (const voice of this.voices) {
      if (voice.releaseAt !== null && this.ctx.currentTime >= voice.releaseAt) this.release(voice);
    }
    const voice = this.current;
    if (!voice || this.incoming || voice.audio.paused) return;
    const end = Math.min(voice.track.loopEnd, voice.audio.duration || voice.track.loopEnd);
    if (voice.audio.currentTime >= end - FADE) this.begin(voice.track, true);
  }

  private release(voice: Voice) {
    this.positions.set(voice.track.id, voice.audio.currentTime);
    this.voices.delete(voice);
    if (this.incoming === voice) this.incoming = null;
    voice.deck.token += 1;
    voice.audio.pause();
    voice.audio.removeEventListener("loadedmetadata", voice.onMetadata);
    voice.audio.removeEventListener("error", voice.onError);
    voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    voice.gain.gain.value = 0;
    voice.audio.removeAttribute("src");
    voice.audio.load(); // Abort pending requests and release the streaming buffer.
  }

  snapshot() {
    return {
      track: this.current?.track.id ?? null,
      pending: this.incoming?.track.id ?? null,
      voices: [...this.voices].map(({ track, audio, blocked }) => ({
        id: track.id, src: track.src, time: audio.currentTime, paused: audio.paused, blocked,
      })),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of this.voices) this.release(voice);
    this.current = null;
    for (const deck of this.decks) {
      deck.token += 1;
      deck.audio.pause();
      deck.audio.removeAttribute("src");
      deck.audio.load();
      deck.source.disconnect();
      deck.gain.disconnect();
    }
    this.decks = [];
    this.level.disconnect();
  }
}

let enabled = readEnabled();
const listeners = new Set<(on: boolean) => void>();
let player: MusicPlayer | null = null;
let timer: number | null = null;
let land = "plaine";
let phase: MusicPhase = "intro";
let ducked = false;

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(MUSIC_KEY) !== "0"; }
  catch { return true; }
}

export function isMusicOn(): boolean { return enabled; }

export function onMusicChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMusicOn(value: boolean): void {
  enabled = value;
  try { window.localStorage.setItem(MUSIC_KEY, value ? "1" : "0"); }
  catch { /* Keep the preference for this visit when storage is unavailable. */ }
  listeners.forEach((listener) => listener(value));
  tick();
}

function tick(retryBlocked = false) {
  if (timer === null) return;
  if (!enabled || isMuted() || document.hidden) { player?.pause(); return; }
  const output = audioOutput();
  if (!output) return;
  if (!player) {
    player = new MusicPlayer(output.ctx, output.out);
    player.setDucked(ducked);
  }
  player.select(trackForPlace(land, phase));
  player.resume(retryBlocked);
  player.update();
}

/** Start after a gesture; title, hero location and existing sound preferences drive playback. */
export function startMusic(): () => void {
  if (typeof window === "undefined") return () => {};
  const gesture = () => { primeAudio(); tick(true); };
  const visibility = () => tick();
  const gestures = ["pointerdown", "keydown", "touchend"] as const;
  gestures.forEach((name) => window.addEventListener(name, gesture, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", visibility);
  const offMute = onMuteChange(() => tick());
  timer = window.setInterval(tick, 250);
  primeAudio();
  tick();
  if (new URLSearchParams(window.location.search).has("debug")) {
    (window as unknown as { __musicState?: () => unknown }).__musicState = () => ({
      ...(player?.snapshot() ?? { track: null, pending: null, voices: [] }), enabled, ducked,
    });
  }
  return () => {
    gestures.forEach((name) => window.removeEventListener(name, gesture, true));
    document.removeEventListener("visibilitychange", visibility);
    offMute();
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    player?.dispose();
    player = null;
    phase = "intro";
    land = "plaine";
    ducked = false;
    delete (window as unknown as { __musicState?: () => unknown }).__musicState;
  };
}

export function setMusicPlace(where: string): void { land = where; }

export function setMusicPhase(next: MusicPhase): void {
  if (phase === next) return;
  phase = next;
  tick();
}

export function setMusicDucked(value: boolean): void {
  if (ducked === value) return;
  ducked = value;
  player?.setDucked(value);
}
