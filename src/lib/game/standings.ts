import type { ActionKind, GameEvent, Player } from "@/lib/data/types";
import { monthKey } from "./calendar";
import { pointsFor } from "./scoring";

export const ACTION_ORDER: ActionKind[] = [
  "candidature",
  "refus",
  "entretien",
  "rejetApresEntretien",
  "embauche",
];

/** Libellés au pluriel, pour les tableaux de totaux. */
export const ACTION_LABELS: Record<ActionKind, string> = {
  candidature: "Candidatures",
  refus: "Refus",
  entretien: "Entretiens",
  rejetApresEntretien: "Rejets légendaires",
  embauche: "Embauches",
};

/** Libellés au singulier, pour annoncer la dernière action jouée. */
export const ACTION_LABELS_ONE: Record<ActionKind, string> = {
  candidature: "candidature",
  refus: "refus",
  entretien: "entretien",
  rejetApresEntretien: "rejet post-entretien",
  embauche: "embauche",
};

export interface Standing {
  playerId: string;
  score: number;
  counts: Record<ActionKind, number>;
}

function emptyCounts(): Record<ActionKind, number> {
  return {
    candidature: 0,
    refus: 0,
    entretien: 0,
    rejetApresEntretien: 0,
    embauche: 0,
  };
}

/** Classement sur un sous-ensemble d'événements. Aucun bonus caché n'y entre. */
export function standings(events: GameEvent[], players: Player[]): Standing[] {
  const byPlayer = new Map<string, Standing>(
    players.map((p) => [
      p.id,
      { playerId: p.id, score: 0, counts: emptyCounts() },
    ]),
  );

  for (const event of events) {
    const standing = byPlayer.get(event.playerId);
    if (!standing) continue;
    standing.score += pointsFor(event.kind);
    standing.counts[event.kind] += 1;
  }

  return [...byPlayer.values()].sort((a, b) => b.score - a.score);
}

export function eventsInMonth(events: GameEvent[], key: string): GameEvent[] {
  return events.filter((e) => monthKey(new Date(e.at)) === key);
}

/**
 * Totaux du groupe : ce que la compagnie a produit collectivement.
 * Uniquement les actions officielles, comme demandé dans le pitch.
 */
export function collectiveTotals(events: GameEvent[]) {
  const counts = emptyCounts();
  let score = 0;

  for (const event of events) {
    counts[event.kind] += 1;
    score += pointsFor(event.kind);
  }

  return { counts, score, total: events.length };
}

/** Le/la meneur·euse, ou null en cas d'égalité ou de tableau vide. */
export function soleLeader(rows: Standing[]): Standing | null {
  if (rows.length === 0 || rows[0].score <= 0) return null;
  if (rows.length > 1 && rows[1].score === rows[0].score) return null;
  return rows[0];
}
