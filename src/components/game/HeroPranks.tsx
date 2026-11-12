"use client";

import { useRef } from "react";
import type { Graphics, Sprite } from "pixi.js";
import { markMotion, scene } from "./scene";
import { atlasFrames, useDirectTexture } from "./textures";
import { useSceneTick } from "./useSceneTick";

export function paintCage(g: Graphics) {
  g.clear();
  g.roundRect(-73, -183, 146, 188, 13).stroke({ color: 0x161e1d, width: 8 });
  g.roundRect(-73, -183, 146, 188, 13).stroke({ color: 0x8c9b94, width: 3 });
  for (const x of [-48, -24, 24, 48]) {
    g.moveTo(x, -180).lineTo(x, 2).stroke({ color: 0x273330, width: 5 });
    g.moveTo(x - 1, -178).lineTo(x - 1, 1).stroke({ color: 0x9da6a1, width: 1.5 });
  }
  g.roundRect(-77, -9, 154, 13, 3).fill(0x424d43);
  g.roundRect(32, -101, 24, 29, 4).fill(0xca9a48);
  g.circle(44, -88, 4).fill(0x3b2c21);
  g.rect(42, -87, 4, 7).fill(0x3b2c21);
}

function paintSmoke(g: Graphics, time = 0) {
  g.clear();
  for (let i = 0; i < 6; i++) {
    const p = (time * .55 + i / 6) % 1;
    const x = Math.sin(p * 5 + i) * (4 + p * 14), y = -149 - p * 62;
    g.circle(x, y, 6 + 11 * p).fill({ color: i % 2 ? 0x605657 : 0x35353a, alpha: .8 * (1 - p) });
  }
  g.circle(2, -151, 4).fill(0xfbb056);
}

export function HeroSmoke() {
  const smoke = useRef<Graphics>(null);
  useSceneTick(() => {
    if (!smoke.current?.parent?.parent?.visible || scene.reducedMotion) return;
    paintSmoke(smoke.current, performance.now() / 1000);
    markMotion();
  });
  return <pixiGraphics ref={smoke} draw={paintSmoke} />;
}

function paintDrool(g: Graphics, time = 0) {
  g.clear();
  for (let i = 0; i < 3; i++) {
    const p = (time * 1.4 + i / 3) % 1;
    g.ellipse(-37 + p * 14, -126 + 45 * p * p, 2 + p, 5).fill({ color: 0xb6e065, alpha: .95 - p * .38 });
  }
}

export function HeroMiniTroll() {
  const texture = useDirectTexture("/art/world-v3/animations/environment-troll.webp");
  const poses = texture ? atlasFrames(texture, 4, 2) : null;
  const troll = useRef<Sprite>(null);
  const drool = useRef<Graphics>(null);
  useSceneTick(() => {
    if (!troll.current?.parent?.parent?.visible || !poses || scene.reducedMotion) return;
    const time = performance.now() / 1000;
    troll.current.y = -102 + Math.sin(time * 5) * 4;
    troll.current.texture = poses[time % 3 > 2.5 ? 6 : 0];
    if (drool.current) paintDrool(drool.current, time);
    markMotion();
  });
  if (!poses) return null;
  return <>
    <pixiSprite ref={troll} texture={poses[0]} anchor={{ x: .5, y: 476 / 512 }} scale={82 / 440} x={-56} y={-102} />
    <pixiGraphics ref={drool} draw={paintDrool} />
  </>;
}
