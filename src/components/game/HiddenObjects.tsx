"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Sprite } from "pixi.js";
import { HIDDEN_ITEMS, type HiddenItem } from "@/lib/game/hidden-objects";
import { useDirectTexture } from "./textures";
import { scene, sceneFrameListeners, viewingInterior, markMotion } from "./scene";
import { useSceneTick } from "./useSceneTick";
import "./hidden-objects.css";

/** Plain pilot validated at 1280×720, 390×844 and 1920×1080 before expansion. */
const ITEMS = HIDDEN_ITEMS;

function HiddenSprite({ item, found }: { item: HiddenItem; found: boolean }) {
  const texture = useDirectTexture(item.art);
  const sprite = useRef<Sprite>(null);
  useSceneTick(() => {
    if (sprite.current) sprite.current.visible = !found && item.x > scene.camera.x - 100 && item.x < scene.camera.x + scene.camera.viewW + 100;
  });
  return texture ? <pixiSprite ref={sprite} label={item.id} texture={texture} x={item.x} y={item.y}
    width={item.size} height={item.size} anchor={{ x: .5, y: 1 }} alpha={.88} tint={0xe8dcc2} visible={!found} /> : null;
}

/** Small props sit behind the heroes, grounded on the back edge of the path. */
export function HiddenObjects({ foundIds }: { foundIds: readonly string[] }) {
  return <pixiContainer>{ITEMS.map(item => <HiddenSprite key={item.id} item={item} found={foundIds.includes(item.id)} />)}</pixiContainer>;
}

function position(node: HTMLButtonElement, item: HiddenItem, paused: boolean) {
  const { camera } = scene;
  const x = (item.x - camera.x) * camera.scale;
  const y = camera.screenOffsetY + (item.y - item.size / 2 - camera.y) * camera.scale;
  const width = Math.max(44, item.size * camera.scale);
  const visible = !paused && !viewingInterior() && x > 0 && x < camera.viewW * camera.scale && y > scene.topInset + 12 && y < camera.viewH * camera.scale - scene.bottomInset;
  if (node.hidden === visible) node.hidden = !visible;
  if (!visible) return;
  const transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-50%)`;
  if (node.style.transform !== transform) node.style.transform = transform;
  const size = `${Math.round(width)}px`;
  if (node.style.width !== size) { node.style.width = size; node.style.height = size; }
}

function FindTarget({ item, paused, onFind }: { item: HiddenItem; paused: boolean; onFind: (itemId: string) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; pan: number; pointer: number } | null>(null);
  const moved = useRef(false);
  const follow = useCallback(() => { if (button.current) position(button.current, item, paused); }, [item, paused]);
  useEffect(() => {
    follow(); sceneFrameListeners.add(follow);
    return () => {
      sceneFrameListeners.delete(follow);
      if (drag.current) { drag.current = null; scene.dragging = false; }
    };
  }, [follow]);
  return <button ref={button} className="hidden-object-target" type="button" data-hidden-item={item.id} aria-label={`Ramasser : ${item.name}`}
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

export function HiddenObjectOverlay({ playerId, foundIds, paused, onFind }: {
  playerId: string | null; foundIds: readonly string[]; paused: boolean; onFind: (itemId: string) => void;
}) {
  return playerId && !paused ? <div className="hidden-object-overlay">
    {ITEMS.filter(item => !foundIds.includes(item.id)).map(item => <FindTarget key={item.id} item={item} paused={paused} onFind={onFind} />)}
  </div> : null;
}
