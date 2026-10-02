"use client";

import { useEffect, useRef, useState } from "react";
import type { Sprite } from "pixi.js";
import { canChallengeDragon, dragonNests } from "@/lib/game/dragon";
import { surfaceAt } from "@/lib/game/world";
import { scene, viewingInterior } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { reactionProgress, updateSpriteTarget, useEnvironmentTarget } from "./environment-targets";

function Resident({ x }: { x: number }) {
  const texture = useDirectTexture("/art/world-v3/animations/dragon.webp");
  const frames = texture ? atlasFrames(texture, 4, 2) : null;
  const sprite = useRef<Sprite>(null), time = useRef(x % 11);
  const targetId = `nest:${x}`;
  const target = useEnvironmentTarget(targetId, "dragon", x);
  useSceneTick(ticker => {
    if (!sprite.current) { updateSpriteTarget(targetId, null, 240); return; }
    sprite.current.visible = x > scene.camera.x - 300 && x < scene.camera.x + scene.camera.viewW + 300;
    if (!sprite.current.visible) { updateSpriteTarget(targetId, null, 240); return; }
    if (!scene.reducedMotion) time.current += ticker.elapsedMS / 1000;
    sprite.current.scale.set(0.62, 0.62 * (1 + (scene.reducedMotion ? 0 : Math.sin(time.current * 1.8) * 0.035)));
    sprite.current.rotation = scene.reducedMotion ? 0 : Math.sin(reactionProgress(target.current) * Math.PI * 4) * .02 * (1 - reactionProgress(target.current));
    updateSpriteTarget(targetId, sprite.current, 240, 320);
  });
  return frames ? <pixiSprite ref={sprite} texture={frames[7]} x={x} y={surfaceAt(x) - 45} anchor={{ x: 0.5, y: 476 / 512 }} scale={0.62} label="dragon-nest" /> : null;
}

export function Dragons() {
  const measure = () => `${Math.floor((scene.camera.x - 500) / 500)}:${Math.ceil((scene.camera.x + scene.camera.viewW + 500) / 500)}`;
  const [range, setRange] = useState(measure);
  useSceneTick(() => { const next = measure(); if (next !== range) setRange(next); });
  const [left, right] = range.split(":").map(n => Number(n) * 500);
  return <pixiContainer>{dragonNests(left, right).map(x => <Resident key={x} x={x} />)}</pixiContainer>;
}

/** The DOM control follows the visible nest, but its lock follows the live hero. */
export function DragonEncounter({ meId, paused, onChallenge }: { meId: string | null; paused: boolean; onChallenge?: () => void }) {
  const [place, setPlace] = useState<{ x: number; y: number; nest: number; available: boolean } | null>(null);
  useEffect(() => {
    const sync = () => {
      const nest = dragonNests(scene.camera.x + 60, scene.camera.x + scene.camera.viewW - 60)[0];
      if (nest === undefined || !meId || viewingInterior()) { setPlace(null); return; }
      const next = { x: Math.round((nest - scene.camera.x) * scene.camera.scale),
        y: Math.round(scene.camera.screenOffsetY + (surfaceAt(nest) - scene.camera.y) * scene.camera.scale), nest,
        available: !paused && canChallengeDragon(scene.heroes.get(meId)?.x, nest, performance.now() < scene.walkingUntil) };
      setPlace(before => before && before.x === next.x && before.y === next.y && before.available === next.available && before.nest === next.nest ? before : next);
    };
    sync();
    const timer = window.setInterval(sync, 120);
    return () => window.clearInterval(timer);
  }, [meId, paused]);
  if (!place || paused || !onChallenge) return null;
  return <button type="button" className="dragon-encounter" style={{ left: place.x, top: place.y + 16 }} disabled={!place.available}
    onPointerDown={event => event.stopPropagation()}
    onClick={() => { if (canChallengeDragon(meId ? scene.heroes.get(meId)?.x : undefined, place.nest, performance.now() < scene.walkingUntil)) onChallenge(); }}>
    {place.available ? "Défier le dragon" : "Dragon · rejoins-le pour jouer"}
  </button>;
}
