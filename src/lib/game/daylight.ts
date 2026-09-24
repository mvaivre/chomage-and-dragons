import { SEASON } from "@/lib/config";

/**
 * The world follows the real time of day in Zurich: a warm dawn, plain day,
 * a golden evening and a starry night. Pure numbers in [0, 1], so the scene,
 * the HUD overlay and the tests all read the same light.
 */

export interface Daylight {
  /** 1 in full night, 0 in daytime, eased in between. */
  night: number;
  /** Strength of the warm light of dawn and dusk. */
  warm: number;
  /** Decimal hour in Zurich, 0 to 24. */
  hour: number;
}

const HOUR_FORMAT = new Intl.DateTimeFormat("fr-CH", { timeZone: SEASON.timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" });

export function zurichHour(date: Date): number {
  const parts = HOUR_FORMAT.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour + minute / 60;
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** A bump that rises from `start` to `peak` and falls back by `end`. */
const bump = (start: number, peak: number, end: number, x: number) =>
  x <= peak ? smooth(start, peak, x) : 1 - smooth(peak, end, x);

export function daylightAt(hour: number): Daylight {
  const night = Math.max(smooth(20.5, 21.75, hour), 1 - smooth(5, 6.25, hour));
  const warm = Math.max(bump(5.25, 6.5, 8, hour), bump(17.5, 19.6, 21.25, hour));
  return { night, warm, hour };
}

export function daylight(date: Date = new Date()): Daylight {
  return daylightAt(zurichHour(date));
}
