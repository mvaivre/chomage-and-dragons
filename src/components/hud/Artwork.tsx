"use client";

import Image from "next/image";
import type { ActionKind, PowerKind, MiniGameKind, CheerEmoji } from "@/lib/data/types";

import { ACTION_ART, POWER_ART } from "@/lib/game/art";

interface ArtworkProps {
  className?: string;
  priority?: boolean;
}

function Artwork({
  src,
  className = "",
  priority = false,
}: ArtworkProps & { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={640}
      height={640}
      sizes="(max-width: 760px) 96px, 320px"
      unoptimized
      priority={priority}
      draggable={false}
      className={`bitmap-art ${className}`}
      aria-hidden
    />
  );
}

export function ActionArtwork({
  kind,
  ...props
}: ArtworkProps & { kind: ActionKind }) {
  return <Artwork src={ACTION_ART[kind]} {...props} />;
}

export function ChestArtwork(props: ArtworkProps) {
  return <Artwork src="/art/world-v3/runtime/chest-reward.webp" {...props} />;
}

export function CrownArtwork(props: ArtworkProps) {
  return <Artwork src="/art/world-v3/ui/ui-crown.webp" {...props} />;
}

export function PowerArtwork({
  kind,
  ...props
}: ArtworkProps & { kind: PowerKind }) {
  return <Artwork src={POWER_ART[kind]} {...props} />;
}

const GAME_ART: Record<MiniGameKind, string> = {
  pigeon: ACTION_ART.candidature, pigeonRace: ACTION_ART.candidature,
  dragon: POWER_ART.fienteDragon, keywords: "/art/world-v3/collectibles/scroll.webp",
  stamp: ACTION_ART.rejetApresEntretien, quiz: ACTION_ART.entretien,
  ghosting: ACTION_ART.refus, slots: "/art/world-v3/runtime/chest-reward.webp",
  paperCut: POWER_ART.paperasse, snake: POWER_ART.crapaud,
  maze: "/art/world-v3/collectibles/lamp.webp", stack: POWER_ART.paperasse,
  pong: "/art/world-v3/collectibles/letter.webp",
};

export function GameArtwork({ kind, ...props }: ArtworkProps & { kind: MiniGameKind }) {
  return <Artwork src={GAME_ART[kind]} {...props} />;
}

export function RelicArtwork({ src, ...props }: ArtworkProps & { src: string }) {
  return <Artwork src={src} {...props} />;
}

export function CheerArtwork({ emoji, className = "" }: { emoji: CheerEmoji; className?: string }) {
  return <span className={`cheer-art ${className}`} aria-hidden="true">{emoji}</span>;
}

export const CHEER_ICONS: Record<CheerEmoji, { label: string }> = {
  "👏": { label: "Bravo" }, "🍺": { label: "À ta santé" }, "🔥": { label: "Bien joué" },
  "😂": { label: "Ça me fait rire" }, "🫂": { label: "Courage" },
};
