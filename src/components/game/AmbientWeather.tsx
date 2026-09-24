"use client";

import { memo, useRef } from "react";
import { biomeAt, WORLD_LENGTH } from "@/lib/game/world";
import { useSceneTick as useTick } from "./useSceneTick";
import { fx, type PresetName } from "./fx";
import { scene } from "./scene";

interface Weather {
  preset: PresetName;
  /** Seconds between two particles, by day and by night. */
  every: [number, number];
  from: "above" | "band" | "right" | "ground";
}

/** What drifts through each land: pollen, leaves, fireflies, snow, sand, embers. */
const WEATHER: Record<string, Weather[]> = {
  plaine: [{ preset: "pollen", every: [0.55, 99], from: "band" }, { preset: "fireflies", every: [99, 0.7], from: "band" }],
  foret: [{ preset: "leaves", every: [0.75, 1.4], from: "above" }, { preset: "fireflies", every: [99, 0.6], from: "band" }],
  marais: [{ preset: "fireflies", every: [1.4, 0.45], from: "band" }],
  lac: [{ preset: "pollen", every: [1.2, 99], from: "band" }, { preset: "fireflies", every: [99, 0.8], from: "band" }],
  cascade: [{ preset: "fireflies", every: [99, 0.9], from: "band" }],
  montagne: [{ preset: "snow", every: [0.22, 0.22], from: "above" }],
  desert: [{ preset: "sand", every: [0.3, 0.6], from: "right" }],
  taverne: [{ preset: "embers", every: [0.8, 0.45], from: "ground" }, { preset: "fireflies", every: [99, 0.9], from: "band" }],
};

/**
 * Background life particles, emitted around the camera. They go through the FX
 * layer marked ambient: capped, and never forcing the full frame rate.
 */
function AmbientWeatherImpl() {
  const clocks = useRef<Record<string, number>>({});
  useTick((ticker) => {
    if (scene.reducedMotion || scene.lowPower) return;
    const { camera } = scene;
    const centre = camera.x + camera.viewW / 2;
    const land = biomeAt(((centre % WORLD_LENGTH) + WORLD_LENGTH) % WORLD_LENGTH).id;
    const dt = ticker.elapsedMS / 1000;
    const bandTop = camera.y + (scene.topInset - camera.screenOffsetY) / camera.scale;
    const ground = camera.y + (camera.viewH - scene.bottomInset / camera.scale) - 60;
    for (const weather of WEATHER[land] ?? []) {
      const every = weather.every[0] + (weather.every[1] - weather.every[0]) * scene.night;
      if (every > 20) continue;
      const key = `${land}-${weather.preset}`;
      clocks.current[key] = (clocks.current[key] ?? Math.random() * every) - dt;
      if (clocks.current[key] > 0) continue;
      clocks.current[key] = every * (0.6 + Math.random() * 0.8);
      const x = weather.from === "right" ? camera.x + camera.viewW + 20 : camera.x - 80 + Math.random() * (camera.viewW + 160);
      const y = weather.from === "above" ? bandTop - 20
        : weather.from === "ground" ? ground - Math.random() * 60
        : weather.from === "right" ? ground - Math.random() * (ground - bandTop) * 0.7
        : bandTop + Math.random() * Math.max(60, ground - bandTop);
      fx.burst({ preset: weather.preset, x, y, count: 1, ambient: true });
    }
  });
  return null;
}

export const AmbientWeather = memo(AmbientWeatherImpl);
