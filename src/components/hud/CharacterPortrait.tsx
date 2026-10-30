"use client";

import { memo } from "react";
import { characterArt, type Character } from "@/lib/game/characters";

/** The same illustration as the world, with no additional rendering context. */
export const CharacterPortrait = memo(function CharacterPortrait({ character, interactive = false, framing = "full", className = "" }: {
  character: Character; interactive?: boolean; framing?: "full" | "bust"; className?: string;
}) {
  return <div className={`character-portrait ${className}`} data-framing={framing} data-animated={interactive || undefined}>
    {/* eslint-disable-next-line @next/next/no-img-element -- optimized local alpha artwork */}
    <img src={characterArt(character.id)} alt={character.name} width={240} height={280} draggable={false} />
  </div>;
});
