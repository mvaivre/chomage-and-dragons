"use client";

import { useRef } from "react";
import type { Graphics, Sprite } from "pixi.js";
import { markMotion, scene } from "./scene";
import { atlasFrames, useDirectTexture } from "./textures";
import { useSceneTick } from "./useSceneTick";
import { POWER_ART } from "@/lib/game/art";
import { fxTexture } from "./fx";
import trollAtlas from "../../../public/art/world-v3/animations/backpack-troll.json";
import fireAtlas from "../../../public/art/world-v3/animations/hero-flame.json";

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

function paintFireAir(g: Graphics, time = 0) {
  g.clear();
  for (let i = 0; i < 5; i++) {
    const p = (time * .68 + i / 5) % 1;
    const x = Math.sin(p * 5 + i) * (6 + p * 23), y = -208 - p * 77;
    g.ellipse(x, y, 12 + 14 * p, 8 + 11 * p).fill({ color: i % 2 ? 0x625055 : 0x38313e, alpha: .68 * (1 - p) });
  }
  for (let i = 0; i < 9; i++) {
    const p = (time * .9 + i / 9) % 1;
    const x = Math.sin(i * 4.2 + p * 4) * (16 + 35 * p), y = -154 - p * 117;
    g.ellipse(x, y, 2.5 * (1 - p) + .7, 3.9 * (1 - p) + .7)
      .fill({ color: i % 2 ? 0xff7428 : 0xffd45e, alpha: .95 * (1 - p) });
  }
}

export function HeroFire() {
  const air = useRef<Graphics>(null), flame = useRef<Sprite>(null), glow = useRef<Sprite>(null);
  const texture = useDirectTexture("/art/world-v3/animations/hero-flame.webp");
  const frames = texture ? atlasFrames(texture, fireAtlas.columns, fireAtlas.rows) : null;
  const scale = 108 / fireAtlas.referenceHeight;
  useSceneTick(() => {
    if (!air.current?.parent?.parent?.visible || scene.reducedMotion) return;
    const time = performance.now() / 1000;
    paintFireAir(air.current, time);
    if (flame.current && frames) {
      flame.current.texture = frames[Math.floor(time * 9) % frames.length];
      flame.current.scale.set(scale * (1 + .035 * Math.sin(time * 8)), scale * (1 + .07 * Math.sin(time * 10)));
    }
    if (glow.current) glow.current.alpha = .48 + scene.night * .22 + Math.sin(time * 8) * .055;
    markMotion();
  });
  return <>
    <pixiSprite ref={glow} texture={fxTexture("dot")} anchor={.5} y={-163}
      width={194} height={175} alpha={.47} tint={0xff832c} blendMode="add" />
    <pixiGraphics ref={air} draw={paintFireAir} />
    {frames ? <pixiSprite ref={flame} label="hero-flame" texture={frames[0]} y={-137}
      anchor={{ x: .5, y: fireAtlas.baseline / fireAtlas.height }} scale={scale} /> : null}
  </>;
}

const TROLL_X = -90;
const TROLL_Y = -62;

function paintTrollStrap(g: Graphics) {
  g.clear();
  g.moveTo(-112, -108).quadraticCurveTo(-59, -89, -12, -105)
    .stroke({ color: 0x4a2b1e, width: 10, cap: "round" });
  g.moveTo(-112, -109).quadraticCurveTo(-59, -90, -12, -106)
    .stroke({ color: 0xa55d36, width: 5, cap: "round" });
}

function paintDrool(g: Graphics, time = 0, y = TROLL_Y) {
  g.clear();
  const spit = time % 3 > 1.85 && time % 3 < 2.55;
  for (let i = 0; i < (spit ? 6 : 3); i++) {
    const p = (time * 1.65 + i / 6) % 1;
    const x = TROLL_X + 42 + (spit ? 41 : 13) * p, dropY = y - 67 + 80 * p * p;
    g.ellipse(x, dropY, 2.6 + p * 1.5, 4 + p * 2.5)
      .fill({ color: 0x91d239, alpha: .98 - p * .45 }).stroke({ color: 0x345c20, width: 1.2, alpha: .8 - p * .42 });
    g.ellipse(x - .65, dropY - 1.7, .9, 1.4).fill({ color: 0xf5ffab, alpha: .86 - p * .55 });
  }
}

export function HeroMiniTroll() {
  const texture = useDirectTexture(POWER_ART.miniTroll);
  const poses = texture ? atlasFrames(texture, trollAtlas.columns, trollAtlas.rows) : null;
  const troll = useRef<Sprite>(null);
  const drool = useRef<Graphics>(null);
  useSceneTick(() => {
    if (!troll.current?.parent?.parent?.visible || !poses || scene.reducedMotion) return;
    const time = performance.now() / 1000;
    const beat = time % 3;
    const pose = beat < 1.52 || beat > 2.76 ? 0 : beat < 1.86 ? 1 : beat < 2.39 ? 2 : 3;
    troll.current.y = TROLL_Y + Math.sin(time * 6) * 4 + (pose === 1 ? 5 : 0);
    troll.current.rotation = .1 + Math.sin(time * 3) * .045 + (pose === 2 ? .1 : pose === 3 ? -.09 : 0);
    troll.current.texture = poses[pose];
    if (drool.current) paintDrool(drool.current, time, troll.current.y);
    markMotion();
  });
  if (!poses) return null;
  return <>
    <pixiGraphics draw={paintTrollStrap} />
    <pixiSprite ref={troll} label="backpack-troll" texture={poses[0]} anchor={{ x: .5, y: trollAtlas.baseline / trollAtlas.height }}
      scale={119 / trollAtlas.referenceHeight} x={TROLL_X} y={TROLL_Y} rotation={.1} />
    <pixiGraphics ref={drool} draw={paintDrool} />
  </>;
}
