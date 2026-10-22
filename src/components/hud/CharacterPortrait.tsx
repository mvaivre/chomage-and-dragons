"use client";

import { characterArt, type Character } from "@/lib/game/characters";

/** The selection screen shares the in-game illustration without another WebGL context. */
export function CharacterPortrait({ character }: { character: Character }) {
  return <div className="character-portrait">
    {/* eslint-disable-next-line @next/next/no-img-element -- already optimized local alpha WebP */}
    <img src={characterArt(character.id)} alt={character.name} width={240} height={280} />
  </div>;
}
