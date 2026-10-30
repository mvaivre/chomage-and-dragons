"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import dynamic from "next/dynamic";
import { useExperience } from "@/components/world/ExperienceContext";
import { characterArt } from "@/lib/game/characters";
import { ChestArtwork, PowerArtwork } from "../Artwork";
const VoxelPortrait = dynamic(() => import("@/components/voxel/PortraitStudio").then(module => module.VoxelPortrait), { ssr: false });

/** Small illustrated stages reuse the game's approved scenery and characters. */
export function InitiationScene({ scene, characterId, steps = 0, chestOpen = false, powerCast = false, label }: {
  scene: "road" | "treasure" | "company"; characterId: string; steps?: number;
  chestOpen?: boolean; powerCast?: boolean; animated?: boolean; label: string;
}) {
  const uiLocale = useLocale();
    const experience = useExperience();
    if (experience === "3d")
        return <VoxelPortrait scene={scene} characterId={characterId} steps={steps} chestOpen={chestOpen} powerCast={powerCast} animated label={tr(label, undefined, uiLocale)} className="initiation-scene initiation-scene--3d"/>;
    return <div className="initiation-scene" data-scene={scene} data-walked={steps > 0} data-open={chestOpen} data-cast={powerCast} role="img" aria-label={tr(label, undefined, uiLocale)}>
    <div className="initiation-scene__landscape" />
    <div className="initiation-scene__path" />
    {/* eslint-disable-next-line @next/next/no-img-element -- same optimized illustration as the game */}
    <img className="initiation-scene__hero" src={characterArt(characterId)} alt="" draggable={false} />
    {scene === "treasure" ? <>
      <ChestArtwork className="initiation-scene__chest" />
      {chestOpen ? <PowerArtwork kind="crapaud" className="initiation-scene__power" /> : null}
    </> : null}
    {scene === "company" || scene === "treasure" ? <div className="initiation-scene__friend">
      {powerCast ? <PowerArtwork kind="crapaud" /> :
        // eslint-disable-next-line @next/next/no-img-element -- shared local character artwork
        <img src={characterArt(characterId === "chevalier" ? "barde" : "chevalier")} alt="" draggable={false} />}
    </div> : null}
    {scene === "road" ? <span className="initiation-scene__milestone" aria-hidden="true">{tr(steps > 0 ? "+2" : "0", undefined, uiLocale)}<small>{tr("pas", undefined, uiLocale)}</small></span> : null}
  </div>;
}
