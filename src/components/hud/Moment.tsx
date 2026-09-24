"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/sound";

/**
 * The DOM half of an action's moment, above the canvas and under the HUD: a
 * flash of light, cinema bars for the rare ones, the points that fly into their
 * counter, and the banner of a newly reached land. Cues come through a tiny bus
 * so the choreography in Game can fire them on its own timeline.
 */

export type MomentCue =
  | { type: "flash"; color: string; strength?: number }
  | { type: "letterbox"; ms: number }
  | { type: "points"; value: number; from: { x: number; y: number } }
  | { type: "banner"; kicker: string; title: string };

type Listener = (cue: MomentCue) => void;
const listeners = new Set<Listener>();
export const moment = {
  cue(cue: MomentCue): void {
    listeners.forEach((listener) => listener(cue));
  },
};

/** Fired when flying points reach their counter, so the HUD can bump. */
export const LANDED_EVENT = "louchomage:points-landed";

interface Live {
  id: number;
  cue: MomentCue;
}

let nextId = 0;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function FlyingPoints({ cue, onDone }: { cue: Extract<MomentCue, { type: "points" }>; onDone: () => void }) {
  const node = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const target = [...document.querySelectorAll<HTMLElement>("[data-hud-target='points']")]
      .map((candidate) => candidate.getBoundingClientRect())
      .find((rect) => rect.width > 0 && rect.height > 0);
    const from = cue.from;
    const to = target ? { x: target.left + target.width / 2, y: target.top + target.height / 2 } : { x: from.x, y: from.y - 160 };
    const lift = Math.min(from.y, to.y) - 90;
    const calm = reducedMotion();
    const animation = element.animate(calm ? [
      { transform: `translate(${to.x}px, ${to.y}px) scale(1)`, opacity: 0 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(1)`, opacity: 0 },
    ] : [
      { transform: `translate(${from.x}px, ${from.y}px) scale(0.3)`, opacity: 0 },
      { transform: `translate(${from.x}px, ${from.y - 50}px) scale(1.35)`, opacity: 1, offset: 0.14 },
      { transform: `translate(${from.x}px, ${from.y - 70}px) scale(1.1)`, opacity: 1, offset: 0.42 },
      { transform: `translate(${(from.x + to.x) / 2}px, ${lift}px) scale(0.95)`, opacity: 1, offset: 0.7 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(0.55)`, opacity: 0.4 },
    ], { duration: calm ? 900 : 1500, easing: "cubic-bezier(0.45, 0, 0.55, 1)", fill: "forwards" });
    animation.onfinish = () => {
      window.dispatchEvent(new CustomEvent(LANDED_EVENT));
      sfx.coin();
      onDone();
    };
    return () => animation.cancel();
  }, [cue, onDone]);
  const text = cue.value > 0 ? `+${cue.value}` : `${cue.value}`;
  return <span ref={node} className="moment-points" data-negative={cue.value < 0} aria-hidden>{text}<small>pts</small></span>;
}

export function MomentOverlay() {
  const [live, setLive] = useState<Live[]>([]);
  useEffect(() => {
    const listener: Listener = (cue) => {
      if (cue.type === "banner") sfx.chime();
      setLive((items) => [...items, { id: ++nextId, cue }]);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  const remove = (id: number) => setLive((items) => items.filter((item) => item.id !== id));

  return <div className="moment-layer" aria-hidden>
    {live.map(({ id, cue }) => {
      if (cue.type === "points") return <FlyingPoints key={id} cue={cue} onDone={() => remove(id)} />;
      if (cue.type === "flash") return <div key={id} className="moment-flash" style={{ "--flash": cue.color, "--strength": cue.strength ?? 0.55 } as React.CSSProperties} onAnimationEnd={() => remove(id)} />;
      if (cue.type === "letterbox") return <div key={id} className="moment-letterbox" style={{ "--hold": `${cue.ms}ms` } as React.CSSProperties} onAnimationEnd={(event) => { if (event.target === event.currentTarget) remove(id); }}><i /><i /></div>;
      return <div key={id} className="moment-banner" onAnimationEnd={(event) => { if (event.target === event.currentTarget) remove(id); }}>
        <small>{cue.kicker}</small>
        <strong>{cue.title}</strong>
      </div>;
    })}
  </div>;
}

/**
 * A number that climbs to its new value after a delay, as its reward arrives.
 * Without timing it follows immediately.
 */
export function useTween(value: number, timing: { delay: number; duration: number } | null, onStep?: () => void): { shown: number; bump: number } {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(0);
  // What is on screen right now: an interrupted climb resumes from there.
  const current = useRef(value);
  const stepRef = useRef(onStep);
  useEffect(() => { stepRef.current = onStep; });
  useEffect(() => {
    const start = current.current;
    if (start === value) return;
    let raf = 0;
    const show = (next: number) => { current.current = next; setShown(next); };
    const finish = () => { show(value); setBump((b) => b + 1); };
    if (!timing || reducedMotion()) {
      const timer = window.setTimeout(finish, timing ? timing.delay : 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      const began = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - began) / Math.max(1, timing.duration));
        const next = Math.round(start + (value - start) * t);
        if (next !== current.current) { show(next); stepRef.current?.(); }
        if (t < 1) raf = requestAnimationFrame(frame); else finish();
      };
      raf = requestAnimationFrame(frame);
    }, timing.delay);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [value, timing]);
  return { shown, bump };
}
