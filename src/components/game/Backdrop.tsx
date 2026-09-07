"use client";

import { useRef } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import type { Container, Graphics } from "pixi.js";
import { mixColor, paletteAt } from "@/lib/game/world";
import { scene } from "./scene";

/** Ciel : géométrie fixe, seules les teintes et les positions suivent la caméra. */
const SKY_BANDS = 192;
const drawBand = (g: Graphics) => { g.clear().rect(0, 0, 1, 1.01).fill(0xffffff); };
const drawSun = (g: Graphics) => { g.clear().circle(0, 0, 32).fill(0xffffff); };
const drawCloud = (g: Graphics) => {
  g.clear().moveTo(-90, 10).quadraticCurveTo(-85, -15, -55, -10)
    .quadraticCurveTo(-40, -54, -9, -28).quadraticCurveTo(25, -40, 42, -5)
    .quadraticCurveTo(76, -9, 90, 10).closePath().fill(0xffffff);
};

/** Geometry is built once. Atmospheric depth comes from colour, never transparent hills. */
export function Sky() {
  const bands = useRef<Container>(null);
  const sun = useRef<Graphics>(null);
  const clouds = useRef<Container>(null);
  useTick(() => {
    const { camera } = scene;
    const palette = paletteAt(camera.x + camera.viewW / 2);
    const top = -camera.screenOffsetY / camera.scale;
    if (bands.current) {
      bands.current.position.set(-4, top - 4);
      bands.current.scale.set(camera.viewW + 8, (camera.viewH + 8) / SKY_BANDS);
      bands.current.children.forEach((band, index) => {
        (band as Graphics).tint = mixColor(palette.sky[0], palette.sky[1], index / (SKY_BANDS - 1));
      });
    }
    if (sun.current) {
      sun.current.position.set(camera.viewW * 0.74, top + camera.viewH * 0.28);
      sun.current.tint = mixColor(palette.accent, 0xffffff, 0.48);
    }
    clouds.current?.children.forEach((cloud, index) => {
      const span = camera.viewW + 300;
      const raw = index * 347 - camera.x * 0.025;
      cloud.position.set(((raw % span) + span) % span - 150, top + 90 + (index % 3) * 74);
      (cloud as Graphics).tint = mixColor(palette.sky[1], 0xffffff, 0.36);
    });
  });
  return <pixiContainer>
    <pixiContainer ref={bands}>
      {Array.from({ length: SKY_BANDS }, (_, index) => <pixiGraphics key={index} y={index} draw={drawBand} />)}
    </pixiContainer>
    <pixiGraphics ref={sun} draw={drawSun} />
    <pixiContainer ref={clouds} alpha={0.24}>
      {Array.from({ length: 5 }, (_, index) => <pixiGraphics key={index} draw={drawCloud} />)}
    </pixiContainer>
  </pixiContainer>;
}
