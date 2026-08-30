"use client";

import Image from "next/image";
import type { ActionKind, PowerKind } from "@/lib/data/types";

const ACTION_ART: Record<ActionKind, string> = {
  candidature: "/art/ui/action-candidature.webp",
  refus: "/art/ui/action-refus.webp",
  entretien: "/art/ui/action-entretien.webp",
  rejetApresEntretien: "/art/ui/action-rejet.webp",
  embauche: "/art/ui/action-embauche.webp",
};

const POWER_ART: Record<PowerKind, string> = {
  shot: "/art/ui/power-shot.webp",
  feuSacré: "/art/ui/power-fire.webp",
  fienteDragon: "/art/ui/power-dragon.webp",
  paperasse: "/art/ui/power-paper.webp",
  crapaud: "/art/ui/power-frog.webp",
};

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
  return <Artwork src="/art/ui/reward-chest.webp" {...props} />;
}

export function CrownArtwork(props: ArtworkProps) {
  return <Artwork src="/art/ui/ui-crown.webp" {...props} />;
}

export function PowerArtwork({
  kind,
  ...props
}: ArtworkProps & { kind: PowerKind }) {
  return <Artwork src={POWER_ART[kind]} {...props} />;
}
