"use client";
import { useLayoutEffect } from "react";
import VoxelCanvas, { activeVoxelWorlds, releaseVoxelWorlds } from "../voxel/VoxelCanvas";
import { bursts } from "../voxel/fx";
import { residentReactions } from "../voxel/state";
import { setEffectSink } from "../game/fx-queue";
import { releaseDecodedImages } from "@/lib/client/preload";
import type { WorldProps } from "./contracts";
import "../voxel/voxel.css";
import { clearTerrainCaches, worldCacheSize } from "../voxel/world";
import { clearSiteCaches, sitesCacheSize } from "../voxel/sites";
import { clearLayoutCaches, layoutCacheSize } from "../voxel/layout";
export default function ThreeDimensionalWorld(props: WorldProps) {
  useLayoutEffect(() => {
    setEffectSink(value => bursts.push({ ...value }));
    return () => setEffectSink(null);
  }, []);
  return <VoxelCanvas {...props} />;
}
export async function releaseWorld() {
  releaseVoxelWorlds(); releaseDecodedImages(); clearTerrainCaches(); clearSiteCaches(); clearLayoutCaches(); bursts.length = 0; residentReactions.clear(); setEffectSink(null);
}
export const worldResources = () => ({ canvases: activeVoxelWorlds(), bursts: bursts.length, residents: residentReactions.size, terrainCaches: worldCacheSize() + sitesCacheSize() + layoutCacheSize() });
