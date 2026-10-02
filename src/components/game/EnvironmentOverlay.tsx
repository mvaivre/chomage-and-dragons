"use client";

import { useEffect, useRef, useState } from "react";
import { canExploreTarget, environmentLine, ENVIRONMENT_LABELS } from "@/lib/game/environment";
import { sfx } from "@/lib/client/sound";
import { environmentTargets, type EnvironmentTarget } from "./environment-targets";
import { environmentBubble, parallaxX } from "./projection";
import { markMotion, scene } from "./scene";
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
interface Place { id: string; x: number; y: number; width: number; height: number; available: boolean; label: string; }

function TargetButton({ place, onActivate }: { place: Place; onActivate: (id: string) => void }) {
  const drag = useRef<{ x: number; y: number; pan: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  return <button type="button" className="environment-target" aria-label={place.label} aria-disabled={!place.available}
    title={place.label}
    data-available={place.available} style={{ left: place.x, top: place.y, width: place.width, height: place.height }}
    onPointerDown={event => {
      event.stopPropagation();
      if (!event.isPrimary || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      moved.current = false;
      drag.current = { x: event.clientX, y: event.clientY, pan: scene.pan, moved: false };
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) start.moved = moved.current = true;
      if (start.moved) { scene.dragging = true; scene.pan = start.pan - (event.clientX - start.x) / scene.camera.scale; markMotion(); }
    }}
    onPointerUp={event => { event.stopPropagation(); drag.current = null; scene.dragging = false; }}
    onPointerCancel={() => { drag.current = null; moved.current = true; scene.dragging = false; }}
    onLostPointerCapture={() => { drag.current = null; scene.dragging = false; }}
    onClick={event => { event.stopPropagation(); if (!moved.current) onActivate(place.id); moved.current = false; }}
  ><span aria-hidden="true">···</span></button>;
}

/** Sparse hit areas and one small anchored speech bubble; the game keeps playing underneath. */
export function EnvironmentOverlay({ meId, paused }: { meId: string | null; paused: boolean }) {
  const [frame, setFrame] = useState<{ places: Place[]; width: number; top: number }>({ places: [], width: 0, top: 0 });
  const [speech, setSpeech] = useState<{ id: string; line: string } | null>(null);
  useEffect(() => {
    const sync = () => {
      const { camera } = scene;
      const width = Math.round(camera.viewW * camera.scale), bottom = camera.viewH * camera.scale - scene.bottomInset;
      const places: Place[] = [];
      const targets = [...environmentTargets.values()].sort((a, b) => a.factor - b.factor || Number(b.kind === "tree") - Number(a.kind === "tree") || b.width * b.height - a.width * a.height);
      if (meId && !paused) for (const target of targets) {
        if (!target.visible || target.width <= 0 || target.height <= 0) continue;
        const x = Math.round(parallaxX(target.worldX, camera.x, camera.viewW, target.factor) * camera.scale);
        const y = Math.round(camera.screenOffsetY + (target.worldY - camera.y * target.factor) * camera.scale);
        if (x + target.width * camera.scale / 2 < 0 || x - target.width * camera.scale / 2 > width || y + target.height * camera.scale / 2 < 0 || y - target.height * camera.scale / 2 > bottom) continue;
        places.push({ id: target.id, x, y, width: Math.max(44, Math.round(target.width * camera.scale)), height: Math.max(44, Math.round(target.height * camera.scale)),
          available: canExploreTarget(target.visible, paused), label: target.label ?? ENVIRONMENT_LABELS[target.kind] });
      }
      const next = { places, width, top: Math.round(scene.topInset + 12) };
      setFrame(before => JSON.stringify(before) === JSON.stringify(next) ? before : next);
    };
    sync(); const timer = window.setInterval(sync, 100);
    return () => window.clearInterval(timer);
  }, [meId, paused]);
  useEffect(() => { if (!speech) return; const timer = window.setTimeout(() => setSpeech(null), 4500); return () => window.clearTimeout(timer); }, [speech]);
  const activate = (id: string) => {
    const target = environmentTargets.get(id);
    if (!target || !canExploreTarget(target.visible, paused) || performance.now() - target.startedAt < 900) return;
    target.startedAt = performance.now();
    setSpeech({ id, line: environmentLine(target.kind, target.visits++) });
    pulse(target); markMotion();
  };
  const anchor = speech ? frame.places.find(place => place.id === speech.id) : null;
  const bubble = anchor ? environmentBubble(anchor, frame.width, frame.top) : null;
  return <div className="environment-overlay">
    {frame.places.map(place => <TargetButton key={place.id} place={place} onActivate={activate} />)}
    {speech && bubble && !paused ? <div className="environment-speech" data-side={bubble.side} role="status" style={{ left: bubble.left, top: bubble.top }}>
      <p>{speech.line}</p><button type="button" aria-label="Fermer le dialogue" onPointerDown={event => event.stopPropagation()} onClick={() => setSpeech(null)}>×</button>
    </div> : null}
  </div>;
}
