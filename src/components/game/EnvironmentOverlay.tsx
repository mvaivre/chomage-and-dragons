"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canExploreTarget, environmentLine, ENVIRONMENT_LABELS } from "@/lib/game/environment";
import { sfx } from "@/lib/client/sound";
import { environmentTargets, type EnvironmentTarget } from "./environment-targets";
import { environmentBubble, parallaxX } from "./projection";
import { markMotion, scene, sceneFrameListeners } from "./scene";
import { fx } from "./fx";

function pulse(target: EnvironmentTarget) {
  const x = scene.camera.x + parallaxX(target.worldX, scene.camera.x, scene.camera.viewW, target.factor);
  const y = target.worldY + scene.camera.y * (1 - target.factor);
  const count = scene.reducedMotion ? 3 : 14;
  switch (target.kind) {
    case "tree": fx.burst({ preset: "leaves", x, y: y - 65, count, spreadX: 65 }); sfx.flap(); break;
    case "crow": fx.burst({ preset: "letters", x, y, count: scene.reducedMotion ? 2 : 5 }); sfx.flap(); break;
    case "hen": fx.burst({ preset: "feathers", x, y, count }); sfx.pop(); break;
    case "toad": fx.burst({ preset: "splash", x, y: y + target.height / 2, count, colors: [0xa0d2cf, 0xd8eee1] }); sfx.croak(); break;
    case "gnome": fx.burst({ preset: "puff", x, y: y - 20, count, colors: [0xf4e5bf, 0xe7c575] }); sfx.chime(); break;
    case "spirit": case "ghost": fx.burst({ preset: "stars", x, y, count, colors: [0xb2e5bd, 0xdaffff] }); sfx.chime(); break;
    case "skeleton": fx.burst({ preset: "dust", x, y: y + 25, count: 4 }); sfx.pop(); break;
    case "troll": sfx.croak(); break;
    case "squirrel": sfx.pop(); break;
    case "dragon": sfx.croak(); break;
    case "recruiter": case "coach": case "clerk": case "worker": case "traveller": sfx.press(); break;
  }
}

/** Which targets get a button: React re-renders only when this list changes. */
interface Place { id: string; label: string; available: boolean; }
interface Box { x: number; y: number; width: number; height: number; }

/** A target's hit box in CSS pixels, false once it is hidden or off screen. */
function project(target: EnvironmentTarget, box: Box): boolean {
  if (!target.visible || target.width <= 0 || target.height <= 0) return false;
  const { camera } = scene;
  const width = camera.viewW * camera.scale, bottom = camera.viewH * camera.scale - scene.bottomInset;
  const x = parallaxX(target.worldX, camera.x, camera.viewW, target.factor) * camera.scale;
  const y = camera.screenOffsetY + (target.worldY - camera.y * target.factor) * camera.scale;
  const halfW = target.width * camera.scale / 2, halfH = target.height * camera.scale / 2;
  if (x + halfW < 0 || x - halfW > width || y + halfH < 0 || y - halfH > bottom) return false;
  box.x = Math.round(x); box.y = Math.round(y);
  box.width = Math.max(44, Math.round(target.width * camera.scale));
  box.height = Math.max(44, Math.round(target.height * camera.scale));
  return true;
}

/** The last box written to each element: a still scene builds no string and touches no style. */
const written = new WeakMap<HTMLElement, Box & { shown: boolean }>();

function place(node: HTMLElement, box: Box | null, size: boolean) {
  let last = written.get(node);
  if (!last) written.set(node, last = { x: NaN, y: NaN, width: NaN, height: NaN, shown: true });
  if (!box) {
    if (last.shown) { node.style.visibility = "hidden"; last.shown = false; }
    return;
  }
  if (!last.shown) { node.style.visibility = ""; last.shown = true; }
  if (box.x !== last.x || box.y !== last.y) {
    node.style.transform = `translate(${box.x}px,${box.y}px) translate(-50%,${size ? "-50%" : "-100%"})`;
    last.x = box.x; last.y = box.y;
  }
  if (!size) return;
  if (box.width !== last.width) { node.style.width = `${box.width}px`; last.width = box.width; }
  if (box.height !== last.height) { node.style.height = `${box.height}px`; last.height = box.height; }
}

const NO_PLACES: Place[] = [];
const box: Box = { x: 0, y: 0, width: 0, height: 0 };

function moveButton(node: HTMLButtonElement, id: string) {
  const target = environmentTargets.get(id);
  place(node, target && project(target, box) ? box : null, true);
}

function moveBubble(node: HTMLDivElement, id: string) {
  const target = environmentTargets.get(id);
  if (!target || !project(target, box)) { place(node, null, false); return; }
  const { camera } = scene;
  const bubble = environmentBubble(box, Math.round(camera.viewW * camera.scale), Math.round(scene.topInset + 12));
  if (node.dataset.side !== bubble.side) node.dataset.side = bubble.side;
  place(node, { x: bubble.left, y: bubble.top, width: 0, height: 0 }, false);
}

function TargetButton({ place, onActivate, register }: { place: Place; onActivate: (id: string) => void; register: (id: string, node: HTMLButtonElement | null) => void }) {
  const drag = useRef<{ x: number; y: number; pan: number; moved: boolean; pointer: number } | null>(null);
  const moved = useRef(false);
  return <button type="button" className="environment-target" aria-label={place.label} aria-disabled={!place.available}
    title={place.label} data-available={place.available}
    ref={node => register(place.id, node)}
    onPointerDown={event => {
      event.stopPropagation();
      if (!event.isPrimary || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      moved.current = false;
      drag.current = { x: event.clientX, y: event.clientY, pan: scene.pan, moved: false, pointer: event.pointerId };
    }}
    onPointerMove={event => {
      const start = drag.current;
      // A second finger never takes over or ends the pan.
      if (!start || start.pointer !== event.pointerId) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) start.moved = moved.current = true;
      if (start.moved) { scene.dragging = true; scene.pan = start.pan - (event.clientX - start.x) / scene.camera.scale; markMotion(); }
    }}
    onPointerUp={event => { event.stopPropagation(); if (drag.current?.pointer !== event.pointerId) return; drag.current = null; scene.dragging = false; }}
    onPointerCancel={event => { if (drag.current?.pointer !== event.pointerId) return; drag.current = null; moved.current = true; scene.dragging = false; }}
    onLostPointerCapture={event => { if (drag.current?.pointer !== event.pointerId) return; drag.current = null; scene.dragging = false; }}
    onClick={event => { event.stopPropagation(); if (!moved.current) onActivate(place.id); moved.current = false; }}
  ><span aria-hidden="true">···</span></button>;
}

/**
 * Sparse hit areas and one small anchored speech bubble; the game keeps playing underneath.
 * Membership and labels go through React a few times a second; positions follow the
 * scene on each of its frames, written straight to the elements.
 */
export function EnvironmentOverlay({ meId, paused }: { meId: string | null; paused: boolean }) {
  const [places, setPlaces] = useState<Place[]>(NO_PLACES);
  const [speech, setSpeech] = useState<{ id: string; line: string } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const bubble = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const next: Place[] = [];
      if (meId && !paused) {
        const targets = [...environmentTargets.values()].sort((a, b) => a.factor - b.factor || Number(b.kind === "tree") - Number(a.kind === "tree") || b.width * b.height - a.width * a.height);
        for (const target of targets) {
          if (!project(target, box)) continue;
          next.push({ id: target.id, label: target.label ?? ENVIRONMENT_LABELS[target.kind], available: canExploreTarget(target.visible, paused) });
        }
      }
      setPlaces(before => before.length === next.length && before.every((item, i) => item.id === next[i].id && item.label === next[i].label && item.available === next[i].available) ? before : next.length ? next : NO_PLACES);
    };
    sync();
    const timer = window.setInterval(sync, 150);
    return () => window.clearInterval(timer);
  }, [meId, paused]);

  useEffect(() => {
    if (!places.length && !speech) return;
    const follow = () => {
      buttons.current.forEach(moveButton);
      const speaker = bubble.current?.dataset.target;
      if (bubble.current && speaker) moveBubble(bubble.current, speaker);
    };
    sceneFrameListeners.add(follow);
    return () => { sceneFrameListeners.delete(follow); };
  }, [places, speech]);

  useEffect(() => { if (!speech) return; const timer = window.setTimeout(() => setSpeech(null), 4500); return () => window.clearTimeout(timer); }, [speech]);

  // Placed as soon as it mounts, so a new button never shows a frame at the corner.
  const register = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) { buttons.current.set(id, node); moveButton(node, id); }
    else buttons.current.delete(id);
  }, []);
  const registerBubble = useCallback((node: HTMLDivElement | null) => {
    bubble.current = node;
    if (node?.dataset.target) moveBubble(node, node.dataset.target);
  }, []);

  const activate = (id: string) => {
    const target = environmentTargets.get(id);
    if (!target || !canExploreTarget(target.visible, paused) || performance.now() - target.startedAt < 900) return;
    target.startedAt = performance.now();
    setSpeech({ id, line: environmentLine(target.kind, target.visits++) });
    pulse(target); markMotion();
  };
  const anchored = speech && places.some(item => item.id === speech.id);
  return <div className="environment-overlay">
    {places.map(item => <TargetButton key={item.id} place={item} onActivate={activate} register={register} />)}
    {speech && anchored && !paused ? <div ref={registerBubble} className="environment-speech" role="status" data-target={speech.id}>
      <p>{speech.line}</p><button type="button" aria-label="Fermer le dialogue" onPointerDown={event => event.stopPropagation()} onClick={() => setSpeech(null)}>×</button>
    </div> : null}
  </div>;
}
