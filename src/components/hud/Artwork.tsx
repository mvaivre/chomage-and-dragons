"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useExperience } from "@/components/world/ExperienceContext";
import { ACTION_ICONS, POWER_ICONS, GAME_ICONS } from "@/lib/game/voxel-art";
import type { VoxelIconName } from "@/lib/game/voxel-icons";
const VoxelIcon = dynamic(() => import("./VoxelIcon").then(module => module.VoxelIcon));
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
}: ArtworkProps & { src: string ;
}) {
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
      className={`bitmap-art ${className}`} aria-hidden/>);
}
export function ActionArtwork({ kind, ...props }: ArtworkProps & {
    kind: ActionKind;
}) {
    const experience = useExperience();
    if (experience === "3d")
        return <VoxelIcon name={ACTION_ICONS[kind]} className={props.className}/>;
    return <Artwork src={ACTION_ART[kind]} {...props}/>;
}
export function ChestArtwork(props: ArtworkProps) {
    const experience = useExperience();
    if (experience === "3d")
        return <VoxelIcon name="chest" className={props.className}/>;
    return <Artwork src="/art/world-v3/runtime/chest-reward.webp" {...props}/>;
}
export function CrownArtwork(props: ArtworkProps) {
    const experience = useExperience();
    if (experience === "3d")
        return <VoxelIcon name="crown" className={props.className}/>;
    return <Artwork src="/art/world-v3/ui/ui-crown.webp" {...props}/>;
}
export function PowerArtwork({ kind, ...props }: ArtworkProps & {
    kind: PowerKind;
}) {
    const experience = useExperience();
    if (experience === "3d")
        return <VoxelIcon name={POWER_ICONS[kind]} className={props.className}/>;
    return <Artwork src={POWER_ART[kind]} {...props}/>;
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
export function GameArtwork({ kind, ...props }: ArtworkProps & {
    kind: MiniGameKind;
}) {
    const experience = useExperience();
    if (experience === "3d")
        return <VoxelIcon name={GAME_ICONS[kind]} className={props.className}/>;
    return <Artwork src={GAME_ART[kind]} {...props}/>;
}
export function RelicArtwork({ src, ...props }: ArtworkProps & {
    src: string;
}) {
    const experience = useExperience();
    const model = src.split("/").at(-1)?.replace(/\..*$/, "") ?? "scroll";
    if (experience === "3d")
        return <VoxelIcon name={({ letter: "letter", key: "key", scroll: "scroll", tankard: "mug", compass: "compass", crystal: "crystal", lamp: "lamp", hammer: "hammer", crown: "crown" } as Record<string, VoxelIconName>)[model] ?? "spark"} className={props.className}/>;
    return <Artwork src={src} {...props}/>;
}
export function CheerArtwork({ emoji, className = "" }: {
    emoji: CheerEmoji;
    className?: string;
}) {
    const uiLocale = useLocale();
    const experience = useExperience();
    if (experience === "3d")
        return <VoxelIcon name={({ "👏": "applause", "🍺": "mug", "🔥": "fire", "😂": "laugh", "🫂": "hug" } as Record<CheerEmoji, VoxelIconName>)[emoji]} className={className}/>;
    return <span className={`cheer-art ${className}`} aria-hidden="true">{tr(emoji, undefined, uiLocale)}</span>;
}
export const CHEER_ICONS: Record<CheerEmoji, {
    label: string;
}> = {
    "👏": { label: "Bravo" }, "🍺": { label: "À ta santé" }, "🔥": { label: "Bien joué" },
    "😂": { label: "Ça me fait rire" }, "🫂": { label: "Courage" },
};
