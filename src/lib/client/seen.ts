"use client";

/**
 * What this device has already shown, per game: the actions of friends and the
 * cheers received. Anything newer is news, either live (a poll brought it) or
 * from while you were away (a recap on arrival).
 *
 * Only the most recent ids are kept; everything older than the oldest kept one
 * counts as seen through `before`, so a long game never replays its past.
 */

export interface Seen {
  events: string[];
  cheers: string[];
  /** Anything dated before this instant was seen. */
  before: string;
}

const key = (scope: string) => `louchomage:vu:${scope}`;
const KEEP = 300;

export function loadSeen(scope: string): Seen | null {
  try {
    const raw = window.localStorage.getItem(key(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Seen>;
    return { events: parsed.events ?? [], cheers: parsed.cheers ?? [], before: parsed.before ?? "" };
  } catch {
    return null;
  }
}

/** Keeps the newest ids by date, and moves the watermark to the oldest kept. */
export function saveSeen(scope: string, items: { events: { id: string; at: string }[]; cheers: { id: string; at: string }[] }): void {
  const newest = <T extends { at: string }>(list: T[]) => [...list].sort((a, b) => b.at.localeCompare(a.at)).slice(0, KEEP);
  const events = newest(items.events);
  const cheers = newest(items.cheers);
  const oldest = [events.at(-1)?.at, cheers.at(-1)?.at].filter(Boolean).sort()[0] ?? "";
  // Only trim by date when the lists are full; otherwise nothing older was dropped.
  const before = items.events.length > KEEP || items.cheers.length > KEEP ? oldest : "";
  try {
    window.localStorage.setItem(key(scope), JSON.stringify({ events: events.map((e) => e.id), cheers: cheers.map((c) => c.id), before }));
  } catch {
    // Without memory, the next visit shows no recap: harmless.
  }
}
