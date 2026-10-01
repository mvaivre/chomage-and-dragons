"use client";

import { useLayoutEffect, useRef } from "react";
import type { EnvironmentKind } from "@/lib/game/environment";

export interface EnvironmentTarget {
  id: string; kind: EnvironmentKind; homeX: number; factor: number;
  worldX: number; worldY: number; width: number; height: number; visible: boolean;
  startedAt: number; visits: number;
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
