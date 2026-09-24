import type { ActionKind, PowerKind } from "@/lib/data/types";

/** The interface and in-world reactions use the same illustrated vocabulary. */
export const ACTION_ART: Record<ActionKind, string> = {
  candidature: "/art/world-v3/ui/action-candidature.webp",
  refus: "/art/world-v3/ui/action-refus.webp",
  entretien: "/art/world-v3/ui/action-entretien.webp",
  rejetApresEntretien: "/art/world-v3/ui/action-rejet.webp",
  embauche: "/art/world-v3/ui/action-embauche.webp",
};
/** Images drawn by the mini-game canvases, decoded ahead of time. */
export const MINI_GAME_IMAGES = [
  "/art/world-v3/ui/action-candidature.webp",
  "/art/world-v3/runtime/plaine-far.webp",
  "/art/world-v3/animations/gnomes.webp",
] as const;

export const POWER_ART: Record<PowerKind, string> = {
  shot: "/art/world-v3/ui/power-shot.webp",
  feuSacré: "/art/world-v3/ui/power-fire.webp",
  fienteDragon: "/art/world-v3/ui/power-dragon.webp",
  paperasse: "/art/world-v3/ui/power-paper.webp",
  crapaud: "/art/world-v3/ui/power-frog.webp",
};
