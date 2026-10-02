"use client";

import { useRef } from "react";
import type { Graphics } from "pixi.js";
import { useSceneTick } from "./useSceneTick";
import { scene } from "./scene";
import { parallaxX } from "./projection";
import type { LandmarkProps } from "./LandmarkLife";

/** Coordinates are measured against cascade-back-v2's 2160 × 459 clean plate. */
const FALLS = [
  { start: [766, 214], control: [808, 210], end: [819, 334], width: 16 },
  { start: [1433, 127], control: [1368, 135], end: [1378, 351], width: 22 },
];
const point = (fall: typeof FALLS[number], t: number) => ({
  x: (1 - t) ** 2 * fall.start[0] + 2 * (1 - t) * t * fall.control[0] + t * t * fall.end[0],
  y: fall.start[1] + (fall.end[1] - fall.start[1]) * t,
});

export function CascadeLife(props: LandmarkProps) {
  const water = useRef<Graphics>(null), time = useRef(props.worldX % 17);
  useSceneTick(ticker => {
    const g = water.current;
    if (!g) return;
    const x = parallaxX(props.worldX, scene.camera.x, scene.camera.viewW, props.factor);
    if (x < -1400 || x > scene.camera.viewW + 1400) return;
    if (!scene.reducedMotion) time.current += ticker.elapsedMS / 1000;
    g.clear();
    for (const [index, fall] of FALLS.entries()) {
      const t = time.current;
      // Water accelerates toward the impact; the stone and distant horizon stay still.
      for (let streak = 0; streak < 9; streak++) {
        const progress = ((t * 0.9 + streak / 9) % 1) ** 0.65;
        const a = point(fall, progress), b = point(fall, Math.min(1, progress + 0.13));
        const dx = Math.sin(streak * 2.7) * fall.width * 0.5;
        g.moveTo(a.x + dx, a.y).lineTo(b.x + dx, b.y).stroke({ width: streak % 2 ? 3 : 5, color: 0xe9ffff, alpha: 0.18 + Math.sin(progress * Math.PI) * 0.3 });
      }
      const impact = fall.end;
      for (let puff = 0; puff < 7; puff++) {
        const p = (t * 0.5 + puff / 7) % 1;
        g.ellipse(impact[0] + (puff - 3) * 11 + Math.sin(t + puff) * 5, impact[1] - 3 - p * 34, 13 + p * 20, 6 + p * 10).fill({ color: 0xdcefee, alpha: Math.sin(p * Math.PI) * 0.17 });
      }
      for (let drop = 0; drop < 12; drop++) {
        const p = (t * 1.25 + drop / 12 + index * 0.3) % 1;
        const dx = (drop % 2 ? 1 : -1) * p * (25 + drop * 2);
        g.ellipse(impact[0] + dx, impact[1] - Math.sin(p * Math.PI) * (16 + drop * 2), 1.6, 3).fill({ color: 0xeeffff, alpha: (1 - p) * 0.65 });
      }
      for (let ripple = 0; ripple < 3; ripple++) {
        const p = (t * 0.38 + ripple / 3) % 1;
        g.ellipse(impact[0], impact[1] + 6 + p * 12, 14 + p * 62, 2 + p * 5).stroke({ color: 0xd2eff0, width: 1.5, alpha: (1 - p) * 0.4 });
      }
    }
  });
  return <pixiGraphics ref={water} draw={g => { g.clear(); }} />;
}
