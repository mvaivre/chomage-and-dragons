"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PixiWorldHost } from "../game/PixiWorldHost";
import { activeApplications, releaseApplications } from "../game/lifecycle";
import { loadFirst, retainTextures, releaseWorldTextures, textureResources } from "../game/textures";
import { CHARACTER_ANIMATIONS } from "../game/animation";
import { characterArt } from "@/lib/game/characters";
import { ACTION_ART, POWER_ART } from "@/lib/game/art";
import { whenIdle, releaseDecodedImages } from "@/lib/client/preload";
import { disposeAtmosphereTextures } from "../game/atmosphere-textures";
import { disposeFxTextures } from "../game/fx";
import { releaseSignTextures, signResources } from "../game/decor-textures";
import { fxQueue } from "../game/fx-queue";
import type { WorldProps } from "./contracts";
export default function TwoDimensionalWorld(props: WorldProps) {
  const [prepared, setPrepared] = useState(false);
  const preparing = useRef(false), frame = useRef(0);
  const notifyReady = props.onSceneReady;
  const ready = useCallback(() => {
    if (preparing.current) return;
    preparing.current = true;
    // Bootstrap one complete frame even when a saved recap or welcome pauses
    // the game. Stopping Pixi earlier would strand the camera behind the loader.
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => { setPrepared(true); notifyReady(); });
    });
  }, [notifyReady]);
  useEffect(() => {
    preparing.current = false;
    return () => { cancelAnimationFrame(frame.current); preparing.current = false; };
  }, []);
  const character = props.players.find(p => p.id === props.meId)?.characterId;
  useEffect(() => {
    if (character) loadFirst([CHARACTER_ANIMATIONS[character]?.url ?? characterArt(character)]);
    return whenIdle(() => retainTextures([...Object.values(ACTION_ART), ...Object.values(POWER_ART)]));
  }, [character]);
  return <PixiWorldHost {...props} paused={props.paused && prepared} onSceneReady={ready} />;
}
export async function releaseWorld() {
  await releaseApplications();
  await Promise.all([releaseWorldTextures(), releaseSignTextures()]);
  disposeAtmosphereTextures(); disposeFxTextures(); releaseDecodedImages();
  fxQueue.bursts.length = 0; fxQueue.bolts.length = 0;
}
export const worldResources = () => ({ canvases: activeApplications(), signs: signResources(), ...textureResources() });
