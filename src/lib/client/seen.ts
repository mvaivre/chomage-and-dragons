"use client";

/**
 * What this device has already shown, per game: the actions of friends and the
 * cheers received. Anything newer is news, either live (a poll brought it) or
 * from while you were away (a recap on arrival).
 */

interface Seen {
  events: string[];
  cheers: string[];
  at: string;
}

const key = (scope: string) => `louchomage:vu:${scope}`;

export function loadSeen(scope: string): Seen | null {
  try {
    const raw = window.localStorage.getItem(key(scope));
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    return null;
  }
}

export function saveSeen(scope: string, seen: Seen): void {
  try {
    // Only the recent past matters: bound the list so it never grows forever.
    window.localStorage.setItem(key(scope), JSON.stringify({ ...seen, events: seen.events.slice(-400), cheers: seen.cheers.slice(-400) }));
  } catch {
    // Without memory, the next visit shows no recap: harmless.
  }
}
