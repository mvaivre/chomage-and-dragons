"use client";

import { useEffect, useState } from "react";
import { currentDaylight } from "@/lib/client/daylight";

/**
 * The world's light, over the canvas and under the HUD: a blue night, a golden
 * evening. Blend modes do the work on the GPU; the HUD stays as readable as ever.
 */
export function DaylightVeil() {
  const [light, setLight] = useState(currentDaylight);
  useEffect(() => {
    const timer = window.setInterval(() => setLight(currentDaylight()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (light.night < 0.02 && light.warm < 0.02) return null;
  return <div className="daylight-veil" aria-hidden
    style={{ "--night": light.night.toFixed(3), "--warm": light.warm.toFixed(3) } as React.CSSProperties}>
    <i className="daylight-veil__warm" />
    <i className="daylight-veil__night" />
  </div>;
}
