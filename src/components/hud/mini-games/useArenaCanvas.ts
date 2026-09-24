"use client";

import { useEffect, useRef } from "react";

export interface ArenaView {
  /** Logical size. The height is fixed; the width is fixed too in fit mode, else derived. */
  width: number;
  height: number;
  /** Logical space beyond the logical box on each side, when letterboxed. */
  bleedX: number;
  bleedY: number;
  scale: number;
  now: number;
  reducedMotion: boolean;
}

/**
 * Sizes a canvas to its arena, keeps it sharp on retina screens and runs a
 * frame loop in logical units. With a logical width the box is centred and
 * letterboxed; without one it stretches to the arena's aspect ratio.
 */
export type ArenaFrame<T extends HTMLElement> = (ctx: CanvasRenderingContext2D, view: ArenaView, dtMs: number, arena: T) => void;

export function useArenaCanvas<T extends HTMLElement = HTMLButtonElement>(
  logical: { height: number; width?: number },
  frame: ArenaFrame<T>,
) {
  const arena = useRef<T>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(frame);
  useEffect(() => { frameRef.current = frame; }, [frame]);
  const viewRef = useRef<ArenaView>({ width: logical.width ?? 0, height: logical.height, bleedX: 0, bleedY: 0, scale: 1, now: 0, reducedMotion: false });
  const { height, width } = logical;

  useEffect(() => {
    const arenaNode = arena.current;
    const canvasNode = canvas.current;
    const ctx = canvasNode?.getContext("2d");
    if (!arenaNode || !canvasNode || !ctx) return;
    const view = viewRef.current;
    let dpr = 1;
    let offsetX = 0;
    let offsetY = 0;
    const resize = () => {
      const rect = arenaNode.getBoundingClientRect();
      if (!rect.height || !rect.width) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (width) {
        view.scale = Math.min(rect.width / width, rect.height / height);
        view.width = width;
        offsetX = (rect.width - width * view.scale) / 2;
        offsetY = (rect.height - height * view.scale) / 2;
      } else {
        view.scale = rect.height / height;
        view.width = rect.width / view.scale;
        offsetX = 0;
        offsetY = 0;
      }
      view.bleedX = offsetX / view.scale;
      view.bleedY = offsetY / view.scale;
      canvasNode.width = Math.round(rect.width * dpr);
      canvasNode.height = Math.round(rect.height * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(arenaNode);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    view.reducedMotion = preference.matches;
    const syncMotion = () => { view.reducedMotion = preference.matches; };
    preference.addEventListener("change", syncMotion);
    let previous = performance.now();
    let raf = 0;
    const syncVisibility = () => { previous = performance.now(); };
    document.addEventListener("visibilitychange", syncVisibility);
    const tick = (now: number) => {
      const dt = Math.min(100, now - previous);
      previous = now;
      view.now = now;
      ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, offsetX * dpr, offsetY * dpr);
      frameRef.current(ctx, view, document.hidden ? 0 : dt, arenaNode);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      preference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [height, width]);

  return { arena, canvas, view: viewRef };
}

/** Pointer position in logical units of the arena. */
export function pointerToLogical(event: { clientX: number; clientY: number }, arena: HTMLElement, view: ArenaView) {
  const rect = arena.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / view.scale - view.bleedX, y: (event.clientY - rect.top) / view.scale - view.bleedY };
}

export { withImage as loadImage } from "@/lib/client/preload";
