"use client";

import { useEffect, useRef } from "react";
import type { EncounterModel } from "@/lib/game/encounter-models";
import { surfaceAt } from "@/lib/game/world";
import { EncounterArtwork } from "../hud/EncounterArtwork";
import { scene, sceneFrameListeners, viewingInterior } from "./scene";

export interface RoadsideEncounter {
  id: string; model: EncounterModel; rare: boolean; worldX: number;
}

/** A small object at the edge of the road leaves the hero's silhouette clear. */
export function RoadsideObject({ encounter }: { encounter: RoadsideEncounter }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const follow = () => {
      const node = root.current;
      if (!node) return;
      const { camera } = scene, x = encounter.worldX + 155;
      const screenX = (x - camera.x) * camera.scale;
      const screenY = camera.screenOffsetY + (surfaceAt(x) + 15 - camera.y) * camera.scale;
      node.hidden = viewingInterior() || screenX < -80 || screenX > camera.viewW * camera.scale + 80;
      node.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -100%) scale(${Math.min(1.1, camera.scale)})`;
    };
    follow(); sceneFrameListeners.add(follow);
    return () => { sceneFrameListeners.delete(follow); };
  }, [encounter]);
  return <div ref={root} className="roadside-object" aria-hidden="true"><EncounterArtwork model={encounter.model} rare={encounter.rare} /></div>;
}
