"use client";

import { memo, useEffect, useRef } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import { Texture, type Container, type Graphics, type Sprite } from "pixi.js";
import { mixColor, paletteAt } from "@/lib/game/world";
import { currentDaylight } from "@/lib/client/daylight";
import { scene } from "./scene";

const drawSun = (g: Graphics) => { g.clear().circle(0, 0, 32).fill(0xffffff); };
const drawCloud = (g: Graphics) => {
  g.clear().moveTo(-90, 10).quadraticCurveTo(-85, -15, -55, -10)
    .quadraticCurveTo(-40, -54, -9, -28).quadraticCurveTo(25, -40, 42, -5)
    .quadraticCurveTo(76, -9, 90, 10).closePath().fill(0xffffff);
};

let fade: Texture | null = null;
/** White at the top, transparent at the bottom: tinted, it blends two sky colours. */
function skyFade(): Texture {
  if (fade && !fade.destroyed) return fade;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 256);
  fade = Texture.from(canvas);
  return fade;
}

const NIGHT_SKY: [number, number] = [0x0b1430, 0x2b3a64];
const WARM_SKY: [number, number] = [0x6d5a9e, 0xf2a66b];
const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 0.6180339) % 1, y: ((i * 0.3819660) % 1) * 0.55, size: 1 + (i % 3) * 0.6, phase: i * 1.7 }));
const drawStar = (g: Graphics) => { g.clear().circle(0, 0, 1.6).fill(0xffffff); };

/** Keeps the scene's light in step with the real clock, minute by minute. */
export function DaylightClock() {
  useEffect(() => {
    const sync = () => { const light = currentDaylight(); scene.night = light.night; scene.warm = light.warm; };
    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}

/**
 * Sky: a flat bottom colour under a fading top colour, so each frame changes two
 * tints instead of redrawing a gradient. Sun and clouds follow the camera.
 */
function SkyLayer() {
  const base = useRef<Sprite>(null);
  const top = useRef<Sprite>(null);
  const sun = useRef<Graphics>(null);
  const clouds = useRef<Container>(null);
  const stars = useRef<Container>(null);
  const last = useRef({ x: NaN, w: NaN, h: NaN, y: NaN, night: NaN, warm: NaN });
  const twinkle = useRef(0);
  useTick((ticker) => {
    const { camera } = scene;
    const skyTop = -camera.screenOffsetY / camera.scale;
    // Stars twinkle at night, even when nothing else moves.
    if (stars.current) {
      stars.current.visible = scene.night > 0.05;
      if (stars.current.visible) {
        twinkle.current += scene.reducedMotion ? 0 : ticker.elapsedMS / 1000;
        stars.current.children.forEach((star, i) => {
          star.position.set(STARS[i].x * camera.viewW, skyTop + 20 + STARS[i].y * camera.viewH);
          star.scale.set(STARS[i].size);
          star.alpha = scene.night * (0.55 + 0.45 * Math.sin(twinkle.current * 1.3 + STARS[i].phase));
        });
      }
    }
    const unchanged = last.current.x === camera.x && last.current.w === camera.viewW && last.current.h === camera.viewH && last.current.y === skyTop && last.current.night === scene.night && last.current.warm === scene.warm;
    if (unchanged) return;
    last.current = { x: camera.x, w: camera.viewW, h: camera.viewH, y: skyTop, night: scene.night, warm: scene.warm };
    const palette = paletteAt(camera.x + camera.viewW / 2);
    const tone = (index: 0 | 1) => mixColor(mixColor(palette.sky[index], WARM_SKY[index], scene.warm * 0.55), NIGHT_SKY[index], scene.night);
    for (const [node, tint] of [[base.current, tone(1)], [top.current, tone(0)]] as const) {
      if (!node) continue;
      node.position.set(-4, skyTop - 4);
      node.width = camera.viewW + 8;
      node.height = camera.viewH + 8;
      node.tint = tint;
    }
    if (sun.current) {
      // The sun sets low and warm; at night the same disc becomes a pale moon.
      const low = scene.warm * 0.12;
      sun.current.position.set(camera.viewW * (0.74 - scene.night * 0.5), skyTop + camera.viewH * (0.28 + low - scene.night * 0.12));
      sun.current.tint = mixColor(mixColor(mixColor(palette.accent, 0xffffff, 0.48), 0xffa35c, scene.warm * 0.7), 0xf4f1e3, scene.night);
      sun.current.scale.set(1 - scene.night * 0.3);
    }
    clouds.current?.children.forEach((cloud, index) => {
      const span = camera.viewW + 300;
      const raw = index * 347 - camera.x * 0.025;
      cloud.position.set(((raw % span) + span) % span - 150, skyTop + 90 + (index % 3) * 74);
      (cloud as Graphics).tint = mixColor(mixColor(palette.sky[1], 0xffffff, 0.36), 0x3a4a73, scene.night * 0.8);
    });
  });
  return <pixiContainer>
    <pixiSprite ref={base} texture={Texture.WHITE} />
    <pixiSprite ref={top} texture={skyFade()} />
    <pixiContainer ref={stars} visible={false}>
      {STARS.map((_, index) => <pixiGraphics key={index} draw={drawStar} />)}
    </pixiContainer>
    <pixiGraphics ref={sun} draw={drawSun} />
    <pixiContainer ref={clouds} alpha={0.24}>
      {Array.from({ length: 5 }, (_, index) => <pixiGraphics key={index} draw={drawCloud} />)}
    </pixiContainer>
  </pixiContainer>;
}

/** Static scenery: re-rendered only when its own props change. */
export const Sky = memo(SkyLayer);
