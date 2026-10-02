"use client";

import { useLayoutEffect, useRef } from "react";
import type { Container } from "pixi.js";
import type { EnvironmentKind } from "@/lib/game/environment";
import { scene } from "./scene";

export interface EnvironmentTarget {
  id: string; kind: EnvironmentKind; homeX: number; factor: number;
  worldX: number; worldY: number; width: number; height: number; visible: boolean;
  startedAt: number; visits: number;
  label?: string;
}

export function isDrawn(node: Container | null): boolean {
  if (!node) return false;
  for (let parent: Container | null = node; parent; parent = parent.parent) if (!parent.visible || !parent.renderable || parent.alpha <= 0) return false;
  return true;
}

/** Use the actual transformed feet, including parent offsets, rooms and parallax. */
export function updateSpriteTarget(id: string, node: Container | null, height: number, width = height * .7, factor = 1) {
  if (!node || !isDrawn(node)) { updateEnvironmentTarget(id, { visible: false }); return; }
  const point = node.getGlobalPosition();
  const { camera } = scene;
  updateEnvironmentTarget(id, {
    visible: true, width, height,
    worldX: camera.x + camera.viewW / 2 + (point.x / camera.scale - camera.viewW / 2) / factor,
    worldY: (point.y - camera.screenOffsetY) / camera.scale + camera.y * factor - height / 2,
  });
}
export const environmentTargets = new Map<string, EnvironmentTarget>();
export function updateEnvironmentTarget(id: string, geometry: Partial<EnvironmentTarget>) {
  const target = environmentTargets.get(id);
  if (target) Object.assign(target, geometry);
}

/** The Pixi ticker supplies geometry; the accessible DOM supplies pointer/keyboard input. */
export function useEnvironmentTarget(id: string, kind: EnvironmentKind, homeX: number, factor = 1) {
  const target = useRef<EnvironmentTarget>({ id, kind, homeX, factor, worldX: homeX, worldY: 0, width: 0, height: 0, visible: false, startedAt: -Infinity, visits: 0 });
  useLayoutEffect(() => {
    const current = target.current;
    Object.assign(current, { id, kind, homeX, factor });
    environmentTargets.set(id, current);
    return () => { if (environmentTargets.get(id) === current) environmentTargets.delete(id); };
  }, [id, kind, homeX, factor]);
  return target;
}
export function reactionProgress(target: EnvironmentTarget): number { return Math.min(1, Math.max(0, (performance.now() - target.startedAt) / 3600)); }
