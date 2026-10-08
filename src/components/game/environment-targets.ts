"use client";

import { useLayoutEffect, useRef } from "react";
import { Point, type Container } from "pixi.js";
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

const feet = new Point();

/**
 * Use the actual transformed feet, including parent offsets, rooms and parallax.
 * Called every frame for every resident: fields are written in place.
 */
export function updateSpriteTarget(id: string, node: Container | null, height: number, width = height * .7, factor = 1) {
  const target = environmentTargets.get(id);
  if (!target) return;
  if (!node || !isDrawn(node)) { target.visible = false; return; }
  const point = node.getGlobalPosition(feet);
  const { camera } = scene;
  target.visible = true; target.width = width; target.height = height;
  target.worldX = camera.x + camera.viewW / 2 + (point.x / camera.scale - camera.viewW / 2) / factor;
  target.worldY = (point.y - camera.screenOffsetY) / camera.scale + camera.y * factor - height / 2;
}
export const environmentTargets = new Map<string, EnvironmentTarget>();
export function updateEnvironmentTarget(id: string, geometry: Partial<EnvironmentTarget>) {
  const target = environmentTargets.get(id);
  if (target) Object.assign(target, geometry);
}
/** Per-frame writes go straight into the registered target: nothing is allocated. */
export function showEnvironmentTarget(id: string, visible: boolean) {
  const target = environmentTargets.get(id);
  if (target) target.visible = visible;
}
export function moveEnvironmentTarget(id: string, worldX: number, worldY: number, width: number, height: number) {
  const target = environmentTargets.get(id);
  if (!target) return;
  target.worldX = worldX; target.worldY = worldY; target.width = width; target.height = height;
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
