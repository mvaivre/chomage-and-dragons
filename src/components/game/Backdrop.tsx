"use client";

import { memo, useRef } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import { Texture, type Container, type Graphics, type Sprite } from "pixi.js";
import { mixColor, paletteAt } from "@/lib/game/world";
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

/**
 * Sky: a flat bottom colour under a fading top colour, so each frame changes two
 * tints instead of redrawing a gradient. Sun and clouds follow the camera.
 */
function SkyLayer() {
  const base = useRef<Sprite>(null);
  const top = useRef<Sprite>(null);
  const sun = useRef<Graphics>(null);
  const clouds = useRef<Container>(null);
  const last = useRef({ x: NaN, w: NaN, h: NaN, y: NaN });
  useTick(() => {
    const { camera } = scene;
    const skyTop = -camera.screenOffsetY / camera.scale;
    const unchanged = last.current.x === camera.x && last.current.w === camera.viewW && last.current.h === camera.viewH && last.current.y === skyTop;
    if (unchanged) return;
    last.current = { x: camera.x, w: camera.viewW, h: camera.viewH, y: skyTop };
    const palette = paletteAt(camera.x + camera.viewW / 2);
    for (const [node, tint] of [[base.current, palette.sky[1]], [top.current, palette.sky[0]]] as const) {
      if (!node) continue;
      node.position.set(-4, skyTop - 4);
      node.width = camera.viewW + 8;
      node.height = camera.viewH + 8;
      node.tint = tint;
    }
    if (sun.current) {
      sun.current.position.set(camera.viewW * 0.74, skyTop + camera.viewH * 0.28);
      sun.current.tint = mixColor(palette.accent, 0xffffff, 0.48);
    }
    clouds.current?.children.forEach((cloud, index) => {
      const span = camera.viewW + 300;
      const raw = index * 347 - camera.x * 0.025;
      cloud.position.set(((raw % span) + span) % span - 150, skyTop + 90 + (index % 3) * 74);
      (cloud as Graphics).tint = mixColor(palette.sky[1], 0xffffff, 0.36);
    });
  });
  return <pixiContainer>
    <pixiSprite ref={base} texture={Texture.WHITE} />
    <pixiSprite ref={top} texture={skyFade()} />
    <pixiGraphics ref={sun} draw={drawSun} />
    <pixiContainer ref={clouds} alpha={0.24}>
      {Array.from({ length: 5 }, (_, index) => <pixiGraphics key={index} draw={drawCloud} />)}
    </pixiContainer>
  </pixiContainer>;
}

/** Static scenery: re-rendered only when its own props change. */
export const Sky = memo(SkyLayer);
