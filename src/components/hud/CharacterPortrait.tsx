"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";

import { memo } from "react";
import dynamic from "next/dynamic";
import { useExperience } from "@/components/world/ExperienceContext";
import { characterArt, type Character } from "@/lib/game/characters";
const VoxelPortrait = dynamic(() => import("@/components/voxel/PortraitStudio").then(module => module.VoxelPortrait), { ssr: false });

/** The same illustration as the world, with no additional rendering context. */
export const CharacterPortrait = memo(function CharacterPortrait({ character, interactive = false, framing = "full", className = "" }: {
  character: Character; interactive?: boolean; framing?: "full" | "bust"; className?: string;
}) {
  const uiLocale = useLocale();
    const experience = useExperience();
    if (experience === "3d")
        return <VoxelPortrait characterId={character.id} label={tr(character.name, undefined, uiLocale)} interactive={interactive} animated={interactive} framing={framing} className={`character-portrait ${className}`}/>;
    return <div className={`character-portrait ${className}`} data-framing={framing} data-animated={interactive || undefined}>
    {/* eslint-disable-next-line @next/next/no-img-element -- optimized local alpha artwork */}
    <img src={characterArt(character.id)} alt={tr(character.name, undefined, uiLocale)} width={240} height={280} draggable={false}/>
  </div>;
});
