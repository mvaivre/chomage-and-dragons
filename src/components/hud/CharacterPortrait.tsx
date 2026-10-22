"use client";
import { memo } from "react";
import type { Character } from "@/lib/game/characters";
import { VoxelPortrait } from "@/components/voxel/PortraitStudio";

export const CharacterPortrait = memo(function CharacterPortrait({ character, interactive = false, framing = "full", className = "" }: {
  character: Character; interactive?: boolean; framing?: "full" | "bust"; className?: string;
}) {
  return <VoxelPortrait characterId={character.id} label={character.name} interactive={interactive} animated={interactive} framing={framing} className={`character-portrait ${className}`} />;
});
