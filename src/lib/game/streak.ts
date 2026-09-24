import type { GameEvent } from "@/lib/data/types";
import { SEASON } from "@/lib/config";

/**
 * A weekly streak: consecutive Zurich weeks with at least one action. It burns
 * on the hero as a small flame, a reason to come back each week. Cosmetic only.
 */

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: SEASON.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/** Monday of the Zurich week of this instant, as YYYY-MM-DD. */
export function weekKey(at: string | Date): string {
  const day = DAY_FORMAT.format(typeof at === "string" ? new Date(at) : at);
  const date = new Date(`${day}T12:00:00Z`);
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

function previousWeek(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** Weeks in a row ending this week or last week; a streak survives until a full week is missed. */
export function weeklyStreak(events: readonly Pick<GameEvent, "at">[], now: Date = new Date()): number {
  const weeks = new Set(events.map((e) => weekKey(e.at)));
  let cursor = weekKey(now);
  if (!weeks.has(cursor)) cursor = previousWeek(cursor);
  let count = 0;
  while (weeks.has(cursor)) { count += 1; cursor = previousWeek(cursor); }
  return count;
}
