"use client";

import { daylight, daylightAt, type Daylight } from "@/lib/game/daylight";

/** The current light; `?debug&hour=22` previews another time of day. */
export function currentDaylight(): Daylight {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const forced = params.has("debug") ? Number(params.get("hour")) : NaN;
    if (Number.isFinite(forced) && params.get("hour") !== null) return daylightAt(forced);
  }
  return daylight();
}
