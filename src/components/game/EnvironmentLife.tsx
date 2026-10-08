"use client";

import { memo, useMemo, useRef, useState } from "react";
import type { Graphics, Sprite } from "pixi.js";
import { environmentSites, type EnvironmentSite } from "@/lib/game/environment";
import { WALKABLE_GROUND_Y } from "@/lib/game/world";
import { trollPatrol, trollWalkFrame } from "@/lib/game/troll-motion";
import { parallaxX } from "./projection";
import { markMotion, scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { isDrawn, moveEnvironmentTarget, reactionProgress, showEnvironmentTarget, useEnvironmentTarget } from "./environment-targets";

// Stable drawings: a Graphics repaints whenever its draw function changes, and every
// repaint rebuilds the scene's render list.
const shadows = new Map<number, (g: Graphics) => void>();
function shadowFor(width: number) {
  let draw = shadows.get(width);
  if (!draw) shadows.set(width, draw = g => { g.clear().ellipse(0, 0, width, 4).fill(0x211b18); });
  return draw;
}
const RIPPLE_COLOR = { color: 0x79b0b5, alpha: 0.25 };
const paintRipple = (g: Graphics) => { g.clear().ellipse(0, 0, 38, 7).fill(RIPPLE_COLOR); };

const Resident = memo(function Resident({ site }: { site: EnvironmentSite }) {
  const { kind, x, factor } = site;
  const special = kind === "troll" || kind === "spirit", afterlife = kind === "ghost" || kind === "skeleton";
  const url = kind === "troll" ? "/art/world-v3/animations/environment-troll.webp" : kind === "spirit" ? "/art/world-v3/animations/woodland-life.webp" : afterlife ? "/art/world-v3/decor/npc-afterlife.webp" : kind === "gnome" ? "/art/world-v3/animations/gnomes.webp" : "/art/world-v3/animations/ambient.webp";
  const texture = useDirectTexture(url);
  const walkTexture = useDirectTexture(kind === "troll" ? "/art/world-v3/animations/environment-troll-walk.webp" : url);
  const walkFrames = kind === "troll" && walkTexture ? atlasFrames(walkTexture, 4, 1) : null;
  const frames = texture ? atlasFrames(texture, 4, special || afterlife || kind === "gnome" ? 2 : 4) : null;
  const sprite = useRef<Sprite>(null), shadow = useRef<Graphics>(null), ripple = useRef<Graphics>(null);
  const rippling = useRef(false);
  const time = useRef(x % 11), wander = useRef(x % 11), heading = useRef(1);
  const target = useEnvironmentTarget(site.id, kind, x, factor);
  const height = kind === "troll" ? 172 : kind === "ghost" ? 120 : kind === "skeleton" ? 115 : kind === "gnome" ? 98 : kind === "crow" ? 78 : kind === "spirit" ? 52 : 72;
  const refHeight = kind === "troll" ? 440 : kind === "spirit" ? 400 : afterlife ? 275 : kind === "gnome" ? 257 : kind === "crow" ? 190 : kind === "hen" ? 198 : 140;
  const row = kind === "spirit" ? 4 : kind === "skeleton" ? 4 : kind === "crow" ? 4 : kind === "toad" ? 12 : 0;
  const ground = WALKABLE_GROUND_Y + 10;
  useSceneTick(ticker => {
    const node = sprite.current, hit = target.current;
    if (!node || !frames) { showEnvironmentTarget(site.id, false); return; }
    const projected = parallaxX(x, scene.camera.x, scene.camera.viewW, factor);
    const visible = projected > -260 && projected < scene.camera.viewW + 260;
    node.visible = visible;
    showEnvironmentTarget(site.id, visible && isDrawn(node));
    if (shadow.current) shadow.current.visible = visible;
    if (ripple.current) ripple.current.visible = visible;
    if (!visible) return;
    const p = reactionProgress(hit), reacting = p < 1, motion = !scene.reducedMotion;
    if (motion) { time.current += Math.min(100, ticker.elapsedMS) / 1000; if (!reacting) wander.current += Math.min(100, ticker.elapsedMS) / 1000; }
    const t = time.current;
    const patrol = trollPatrol(wander.current);
    const roam = motion ? kind === "troll" ? patrol.offset : Math.sin(wander.current * 0.25) * (kind === "hen" ? 45 : kind === "crow" ? 95 : 0) : 0;
    let dy = kind === "crow" ? -70 : kind === "spirit" ? (factor < 1 ? -85 : -35) : kind === "ghost" ? -28 : 0;
    if (motion) {
      if (kind === "crow" || kind === "spirit" || kind === "ghost") dy += Math.sin(t * 1.7) * 7;
      if (reacting && (kind === "toad" || kind === "hen" || kind === "gnome")) dy -= Math.abs(Math.sin(p * Math.PI * (kind === "toad" ? 2 : 5))) * (kind === "toad" ? 72 : 22) * (1 - p);
      if (reacting && kind === "crow") dy -= Math.sin(p * Math.PI) * 30;
      if (reacting && kind === "spirit") dy -= Math.sin(p * Math.PI) * (factor < 1 ? 30 : 60);
    }
    if (!reacting && motion) heading.current = kind === "troll" ? patrol.direction : Math.cos(wander.current * 0.25) < 0 ? -1 : 1;
    node.position.set((x + roam) * factor, ground + dy);
    const scale = height / refHeight;
    node.scale.set(scale * ((kind === "troll" || kind === "hen" || kind === "crow") ? heading.current : 1), scale * (motion && kind !== "troll" ? 1 + Math.sin(t * 2) * 0.018 : 1));
    node.rotation = motion && reacting && (kind === "ghost" || kind === "spirit") ? Math.sin(p * 24) * 0.2 * (1 - p) : 0;
    node.alpha = kind === "ghost" ? (reacting ? 0.92 : 0.68) : 1;
    const pose = kind === "troll" ? reacting ? 4 + Math.min(3, Math.floor(p * 4)) : motion && patrol.moving ? trollWalkFrame(patrol.distance) : 0
      : kind === "crow" ? Math.floor(t * 7) % 4
        : reacting ? 1 + Math.floor(p * 6) % 3 : Math.floor(t * 0.8) % 4;
    node.texture = kind === "troll" && !reacting && motion && patrol.moving && walkFrames
      ? walkFrames[pose]
      : frames[row + (scene.reducedMotion ? reacting ? kind === "troll" ? 6 : 1 : 0 : kind === "troll" && !reacting ? 0 : pose)];
    moveEnvironmentTarget(site.id, x + roam, ground + dy - height / 2, kind === "troll" ? 132 : kind === "crow" ? 90 : height * 0.72, height);
    if (shadow.current) { shadow.current.x = (x + roam) * factor; shadow.current.alpha = dy < -100 ? 0 : Math.max(0.08, 0.25 + dy / 400); }
    // A toad's rings spread only while it reacts; at rest the puddle is drawn once.
    const g = ripple.current;
    if (g && reacting && motion) {
      rippling.current = true;
      paintRipple(g);
      for (let i = 0; i < 3; i++) { const q = (p * 2 + i / 3) % 1; g.ellipse(0, 0, 20 + q * 55, 3 + q * 10).stroke({ color: 0xd3e7d7, width: 2, alpha: (1 - q) * 0.6 }); }
    } else if (g && rippling.current) {
      rippling.current = false;
      paintRipple(g);
    }
    if (reacting) markMotion();
  });
  return <pixiContainer label={`environment:${site.id}`}>
    <pixiGraphics ref={shadow} x={x * factor} y={ground + 2} draw={shadowFor(height * 0.28)} alpha={0.25} />
    {kind === "toad" ? <pixiGraphics ref={ripple} x={x * factor} y={ground + 2} draw={paintRipple} /> : null}
    {frames ? <pixiSprite ref={sprite} texture={frames[row]} x={x * factor} y={ground} anchor={{ x: 0.5, y: special ? 476 / 512 : 312 / 320 }} scale={height / refHeight} /> : null}
  </pixiContainer>;
});

/** Materialize only nearby physical homes; each resident culls its own parallax projection. */
function EnvironmentLifeLayer({ factor }: { factor: number }) {
  const left = () => {
    const center = scene.camera.x + scene.camera.viewW / 2, reach = (scene.camera.viewW / 2 + 400) / factor;
    return Math.floor((center - reach) / 500);
  };
  const right = () => {
    const center = scene.camera.x + scene.camera.viewW / 2, reach = (scene.camera.viewW / 2 + 400) / factor;
    return Math.ceil((center + reach) / 500);
  };
  const [range, setRange] = useState(() => [left(), right()] as const);
  useSceneTick(() => { const a = left(), b = right(); if (a !== range[0] || b !== range[1]) setRange([a, b]); });
  const sites = useMemo(() => environmentSites(range[0] * 500, range[1] * 500, factor), [range, factor]);
  return <pixiContainer>{sites.map(site => <Resident key={site.id} site={site} />)}</pixiContainer>;
}
export const EnvironmentLife = memo(EnvironmentLifeLayer);
