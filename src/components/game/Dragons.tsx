"use client";

import { useEffect, useRef, useState } from "react";
import type { Container, Graphics, Sprite } from "pixi.js";
import { canChallengeDragon, dragonIdleFrame, dragonNests } from "@/lib/game/dragon";
import { surfaceAt } from "@/lib/game/world";
import { scene, viewingInterior, worldDelta } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { reactionProgress, updateSpriteTarget, useEnvironmentTarget } from "./environment-targets";

const SCALE = 0.62;
const FOOT_ANCHOR = { x: 0.5, y: 476 / 512 };
export function dragonResidentScale(x: number) {
  const { camera } = scene;
  const headroom = (surfaceAt(x) - camera.y) * camera.scale + camera.screenOffsetY - scene.topInset - 16;
  return Math.min(SCALE, Math.max(0.42, headroom / (455 * camera.scale)));
}
const drawShadow = (g: Graphics) => { g.clear().ellipse(0, 1, 116, 5).fill({ color: 0x211b18, alpha: 0.18 }); };

function Resident({ x }: { x: number }) {
  const texture = useDirectTexture("/art/world-v3/animations/dragon-v3.webp");
  const frames = texture ? atlasFrames(texture, 4, 2) : null;
  const root = useRef<Container>(null), sprite = useRef<Sprite>(null), previous = useRef<Sprite>(null), shadow = useRef<Graphics>(null);
  const time = useRef(0), pose = useRef({ frame: 6, previous: 6, blend: 1 });
  const targetId = `nest:${x}`;
  const target = useEnvironmentTarget(targetId, "dragon", x);
  useSceneTick(ticker => {
    const node = root.current, body = sprite.current, old = previous.current;
    if (!node || !body || !old || !frames) { updateSpriteTarget(targetId, null, 275); return; }
    node.visible = scene.dragonMeal?.nest !== x && x > scene.camera.x - 300 && x < scene.camera.x + scene.camera.viewW + 300;
    if (!node.visible) { updateSpriteTarget(targetId, null, 275); return; }
    const dt = worldDelta(ticker.elapsedMS);
    if (!scene.reducedMotion) time.current += dt;
    const reaction = reactionProgress(target.current);
    let attentive = reaction < 1;
    for (const hero of scene.heroes.values()) if (Math.abs(hero.x - x) < 260) { attentive = true; break; }
    const mood = target.current.visits % 4;
    const frame = reaction < 1 && mood === 2 ? 3 : reaction < 1 && mood === 3 ? 2 : dragonIdleFrame(time.current, attentive, scene.reducedMotion);
    if (frame !== pose.current.frame) {
      pose.current.previous = pose.current.frame;
      pose.current.frame = frame;
      pose.current.blend = 0;
    }
    const state = pose.current;
    state.blend = scene.reducedMotion ? 1 : Math.min(1, state.blend + dt / 0.4);
    body.texture = frames[state.frame]; body.alpha = state.blend;
    old.texture = frames[state.previous]; old.alpha = 1 - state.blend; old.visible = state.blend < 1;
    // Leave room for the awake head beneath the HUD on short desktop viewports.
    const scale = dragonResidentScale(x);
    // Both poses pivot at their shared foot line: breathing and pose changes never lift the feet.
    const breathing = scene.reducedMotion ? 0 : Math.sin(time.current * 1.8 + x) * 0.012;
    const nod = scene.reducedMotion ? 0 : Math.sin(reaction * Math.PI * 4) * (1 - reaction) * 0.025;
    body.scale.set(scale, scale * (1 + breathing - nod)); old.scale.copyFrom(body.scale);
    const sleep = (state.previous === 7 ? 1 - state.blend : 0) + (state.frame === 7 ? state.blend : 0);
    if (shadow.current) shadow.current.scale.set(scale / SCALE * (0.7 + sleep * 0.3), scale / SCALE);
    updateSpriteTarget(targetId, node, (455 - sleep * 128) * scale, 512 * scale);
  });
  return frames ? <pixiContainer ref={root} x={x} y={surfaceAt(x)} label="dragon-nest">
    <pixiGraphics ref={shadow} draw={drawShadow} />
    <pixiSprite ref={previous} texture={frames[6]} anchor={FOOT_ANCHOR} scale={SCALE} alpha={0} visible={false} label="dragon-previous-pose" />
    <pixiSprite ref={sprite} texture={frames[6]} anchor={FOOT_ANCHOR} scale={SCALE} label="dragon-body" />
  </pixiContainer> : null;
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
