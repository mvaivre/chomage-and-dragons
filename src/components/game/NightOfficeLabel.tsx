"use client";

import { useRef } from "react";
import type { Graphics, Sprite } from "pixi.js";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { useSignTexture } from "./decor-textures";

/** A short after-hours flicker; the normal caption can also name hired friends. */
export function NightOfficeLabel({ text, rect }: { text: string; rect: number[] }) {
  const [x, y, w, h] = rect;
  const normal = useSignTexture(text, "setpiece", true, Math.ceil(w), Math.ceil(h));
  const night = useSignTexture("OPEN SPACE", "setpiece", true, Math.ceil(w), Math.ceil(h), "#ffdb8a");
  const letters = useRef<Sprite>(null), plate = useRef<Graphics>(null);
  useSceneTick(() => {
    if (!letters.current || !normal) return;
    const phase = Date.now() / 1000 % 88;
    const active = scene.night > 0.65 && !scene.momentActive && !scene.reducedMotion && phase > 81;
    letters.current.texture = active && night ? night : normal;
    letters.current.alpha = active && Math.floor(phase * 3) % 5 === 0 ? 0.68 : 1;
    if (plate.current) plate.current.visible = active;
  });
  return <pixiContainer x={x} y={y} label="night-office">
    <pixiGraphics ref={plate} visible={false} draw={g => {g.clear().roundRect(0, 0, w, h, 8).fill(0x302c27).stroke({color:0xab8c4e,width:3});}} />
    {normal ? <pixiSprite ref={letters} texture={normal} scale={0.5} /> : null}
  </pixiContainer>;
}
