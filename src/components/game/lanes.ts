import type { PlayerView } from "@/hooks/useGame";
import { surfaceAt, worldXFor } from "@/lib/game/world";

/**
 * Décalage de chaque personnage autour de sa position réelle.
 *
 * En vue de côté, deux joueurs au même avancement se superposeraient exactement.
 * Un léger étalement en profondeur — reculé, plus petit, un peu décalé — suffit à
 * les distinguer sans mentir sur le classement.
 */

export interface Lane {
  dx: number;
  dy: number;
  scale: number;
}

export function laneFor(index: number): Lane {
  const row = index % 3;
  // Le pas de 37 brise les régularités : sans lui, un joueur sur deux se retrouve
  // à la même place et l'étalement ne sert plus à rien.
  const column = ((index * 37) % 5) - 2;

  return {
    dx: column * 40,
    dy: row * 24,
    scale: 1 - row * 0.05,
  };
}

/** Point d'ancrage des animations : aux pieds du personnage. */
export function heroOrigin(player: PlayerView, index: number) {
  const lane = laneFor(index);
  const x = worldXFor(player.position) + lane.dx;

  return { x, y: surfaceAt(x) + 4 + lane.dy };
}
