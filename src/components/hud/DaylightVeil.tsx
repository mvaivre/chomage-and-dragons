"use client";

import { useEffect, useState } from "react";
import { currentDaylight } from "@/lib/client/daylight";

/**
 * At night the corners of the world fade into the dark while the centre stays
 * clear. The light itself is graded in the scene, plane by plane (see depthLight).
 */
export function DaylightVeil() {
  const [light, setLight] = useState(currentDaylight);
  useEffect(() => {
    const timer = window.setInterval(() => setLight(currentDaylight()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (light.night < 0.02) return null;
  return <div className="daylight-veil" aria-hidden style={{ "--night": light.night.toFixed(3) } as React.CSSProperties} />;
}
