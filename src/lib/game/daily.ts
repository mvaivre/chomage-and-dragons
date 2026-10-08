import { SEASON } from "@/lib/config";
import type { DailyRun, MiniGameKind } from "@/lib/data/types";
import { mulberry32, seedFrom } from "@/lib/game/random";

/**
 * The daily challenge: every Zurich day picks one mini-game and one seed for
 * the whole group. Each friend plays it once; the day's ranking is the reward.
 * It never touches steps or loot.
 */

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: SEASON.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

export function zurichDay(date: Date = new Date()): string {
  return DAY_FORMAT.format(date);
}

/** Games that make a fair daily race; the chest slot machine is luck and stays out. */
export const LEGACY_DAILY_GAMES: readonly MiniGameKind[] = ["pigeon", "keywords", "stamp", "quiz", "ghosting"];
export const DAILY_GAMES: readonly MiniGameKind[] = [...LEGACY_DAILY_GAMES, "pigeonRace", "paperCut", "snake", "maze", "stack", "pong"];
/** Never change the challenge after friends already played it on launch day. */
export const ARCADE_DAILY_FROM = "2026-10-09";

export function dailyChallenge(day: string, groupKey = "groupe"): { kind: MiniGameKind; seedId: string } {
  const random = mulberry32(seedFrom(`daily:${groupKey}:${day}`));
  const pool = day < ARCADE_DAILY_FROM ? LEGACY_DAILY_GAMES : DAILY_GAMES;
  const kind = pool[Math.floor(random() * pool.length)];
  return { kind, seedId: `daily-${groupKey}-${day}` };
}

/** Finished runs of the day, best first; a run left unfinished counts as played at zero. */
export function dailyRanking(runs: readonly DailyRun[], day: string): DailyRun[] {
  return runs.filter((run) => run.day === day).sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
}
