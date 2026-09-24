import { SEASON } from "@/lib/config";
import type { DailyRun, MiniGameKind } from "@/lib/data/types";
import { mulberry32, seedFrom } from "@/lib/game/random";

/**
 * The daily challenge: every Zurich day picks one mini-game and one seed for
 * the whole group. Each friend plays it once; the day's ranking is the reward.
 * It never touches steps, points or loot.
 */

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: SEASON.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

export function zurichDay(date: Date = new Date()): string {
  return DAY_FORMAT.format(date);
}

/** Games that make a fair daily race; the chest slot machine is luck and stays out. */
export const DAILY_GAMES: readonly MiniGameKind[] = ["pigeon", "keywords", "stamp", "quiz", "ghosting"];

export function dailyChallenge(day: string, groupKey = "groupe"): { kind: MiniGameKind; seedId: string } {
  const random = mulberry32(seedFrom(`daily:${groupKey}:${day}`));
  const kind = DAILY_GAMES[Math.floor(random() * DAILY_GAMES.length)];
  return { kind, seedId: `daily-${groupKey}-${day}` };
}

export function dailyRanking(runs: readonly DailyRun[], day: string): DailyRun[] {
  return runs.filter((run) => run.day === day).sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
}
