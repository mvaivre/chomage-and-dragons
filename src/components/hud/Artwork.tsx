"use client";

import Image from "next/image";
import type { ActionKind, PowerKind } from "@/lib/data/types";

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
