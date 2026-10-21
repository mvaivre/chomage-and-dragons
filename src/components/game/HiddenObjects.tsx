"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Container, Graphics } from "pixi.js";
import { HIDDEN_ITEMS, type HiddenItem } from "@/lib/game/hidden-objects";
import { useDirectTexture } from "./textures";
import { scene, sceneFrameListeners, viewingInterior, markMotion } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { parallaxX } from "./projection";
import { volcanicLightAt } from "@/lib/game/volcano";

/** Plain pilot validated at 1280×720, 390×844 and 1920×1080 before expansion. */
const ITEMS = HIDDEN_ITEMS;

const glows = new Map<string, (g: Graphics) => void>();
function glowFor(size: number, highlighted: boolean) {
  const key = `${size}:${highlighted}`;
  let draw = glows.get(key);
  if (!draw) glows.set(key, draw = g => {
    g.clear();
    for (let ring = 12; ring > 0; ring--) {
      g.circle(0, -size / 2, size * ring / 15).fill({ color: 0xffe6a0, alpha: highlighted ? .035 : .018 });
    }
  });
  return draw;
}

function HiddenSprite({ item, found, highlighted, factor }: { item: HiddenItem; found: boolean; highlighted: boolean; factor: number }) {
  const texture = useDirectTexture(item.art);
  const root = useRef<Container>(null);
  useSceneTick(() => {
    const x = parallaxX(item.x, scene.camera.x, scene.camera.viewW, factor);
    if (root.current) root.current.visible = !found && x > -100 && x < scene.camera.viewW + 100;
    if (root.current) root.current.alpha = item.biome === "volcan" ? 1 : 1 - volcanicLightAt(scene.camera.x + scene.camera.viewW / 2);
  });
  return texture ? <pixiContainer ref={root} label={`hidden-prop:${item.id}`} x={item.x * factor} y={item.y} visible={!found}>
    <pixiGraphics label="hidden-object-glow" draw={glowFor(item.size, highlighted)} />
    <pixiSprite label={item.id} texture={texture} width={item.size} height={item.size} anchor={{ x: .5, y: 1 }} alpha={.94} tint={0xf1e7cd} />
  </pixiContainer> : null;
}

/** Objects share the background's light, parallax and occlusion. */
export function HiddenObjects({ foundIds, factor }: { foundIds: readonly string[]; factor: number }) {
  return <pixiContainer label="hidden-objects-background">{ITEMS.map((item, index) => <HiddenSprite key={item.id} item={item} found={foundIds.includes(item.id)} highlighted={index === 0 && foundIds.length === 0} factor={factor} />)}</pixiContainer>;
}

function position(node: HTMLButtonElement, item: HiddenItem, paused: boolean, factor: number) {
  const { camera } = scene;
  const x = parallaxX(item.x, camera.x, camera.viewW, factor) * camera.scale;
  const y = camera.screenOffsetY + (item.y - item.size / 2 - camera.y * factor) * camera.scale;
  const width = Math.max(44, item.size * camera.scale);
  const inAsh = item.biome !== "volcan" && volcanicLightAt(camera.x + camera.viewW / 2) > .85;
  const visible = !inAsh && !paused && !viewingInterior() && x > 0 && x < camera.viewW * camera.scale && y > scene.topInset + 12 && y < camera.viewH * camera.scale - scene.bottomInset;
  if (node.hidden === visible) node.hidden = !visible;
  if (!visible) return;
  const transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-50%)`;
  if (node.style.transform !== transform) node.style.transform = transform;
  const size = `${Math.round(width)}px`;
  if (node.style.width !== size) { node.style.width = size; node.style.height = size; }
}

function FindTarget({ item, paused, highlighted, factor, onFind }: { item: HiddenItem; paused: boolean; highlighted: boolean; factor: number; onFind: (itemId: string) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; pan: number; pointer: number } | null>(null);
  const moved = useRef(false);
  const follow = useCallback(() => { if (button.current) position(button.current, item, paused, factor); }, [item, paused, factor]);
  useEffect(() => {
    follow(); sceneFrameListeners.add(follow);
    return () => {
      sceneFrameListeners.delete(follow);
      if (drag.current) { drag.current = null; scene.dragging = false; }
    };
  }, [follow]);
  return <button ref={button} className="hidden-object-target" type="button" data-hidden-item={item.id} data-highlighted={highlighted} aria-label={`Ramasser : ${item.name}`}
    onPointerDown={event => {
      event.stopPropagation();
      if (!event.isPrimary || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      moved.current = false;
      drag.current = { x: event.clientX, y: event.clientY, pan: scene.pan, pointer: event.pointerId };
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start || start.pointer !== event.pointerId) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) moved.current = true;
      if (moved.current) { scene.dragging = true; scene.pan = start.pan - (event.clientX - start.x) / scene.camera.scale; markMotion(); }
    }}
    onPointerUp={event => { event.stopPropagation(); if (drag.current?.pointer === event.pointerId) { drag.current = null; scene.dragging = false; } }}
    onPointerCancel={() => { drag.current = null; moved.current = true; scene.dragging = false; }}
    onLostPointerCapture={() => { drag.current = null; scene.dragging = false; }}
    onClick={event => {
      event.stopPropagation();
      if (!paused && !viewingInterior() && (!moved.current || event.detail === 0)) onFind(item.id);
      moved.current = false;
    }} />;
}

export function HiddenObjectOverlay({ playerId, foundIds, paused, factor, onFind }: {
  playerId: string | null; foundIds: readonly string[]; paused: boolean; factor: number; onFind: (itemId: string) => void;
}) {
  return playerId && !paused ? <div className="hidden-object-overlay">
    {ITEMS.filter(item => !foundIds.includes(item.id)).map(item => <FindTarget key={item.id} item={item} paused={paused} highlighted={item.id === ITEMS[0].id && foundIds.length === 0} factor={factor} onFind={onFind} />)}
  </div> : null;
}
