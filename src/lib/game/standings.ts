import type { ActionKind, GameEvent, Player } from "@/lib/data/types";
import { monthKey } from "@/lib/game/calendar";
import { stepsForEvent } from "@/lib/game/scoring";

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
  steps: number;
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

/** Replay all history so a month's net movement respects the journey's floor at zero. */
export function standings(events: GameEvent[], players: Player[], month?: string): Standing[] {
  const byPlayer = new Map<string, Standing>(
    players.map((p) => [
      p.id,
      { playerId: p.id, steps: 0, counts: emptyCounts() },
    ]),
  );

  const positions = new Map<string, number>();
  for (const event of events) {
    if (month && eventMonthKey(event.at) > month) continue;
    const standing = byPlayer.get(event.playerId);
    if (!standing) continue;
    const before = positions.get(event.playerId) ?? 0;
    const after = Math.max(0, before + stepsForEvent(event));
    positions.set(event.playerId, after);
    if (!month || eventMonthKey(event.at) === month) {
      standing.steps += after - before;
      standing.counts[event.kind] += 1;
    }
  }

  return [...byPlayer.values()].sort((a, b) => b.steps - a.steps);
}

/**
 * Formatting a date in the reference time zone is the costly part of every
 * standing: each instant is formatted once, then remembered.
 */
const monthKeys = new Map<string, string>();
export function eventMonthKey(at: string): string {
  let key = monthKeys.get(at);
  if (key === undefined) {
    key = monthKey(new Date(at));
    if (monthKeys.size > 20_000) monthKeys.clear();
    monthKeys.set(at, key);
  }
  return key;
}

export function eventsInMonth(events: GameEvent[], key: string): GameEvent[] {
  return events.filter((e) => eventMonthKey(e.at) === key);
}

/**
 * Totaux du groupe : ce que la compagnie a produit collectivement.
 * Uniquement les actions officielles, comme demandé dans le pitch.
 */
export function collectiveTotals(events: GameEvent[]) {
  const counts = emptyCounts();
  const positions = new Map<string, number>();

  for (const event of events) {
    counts[event.kind] += 1;
    positions.set(event.playerId, Math.max(0, (positions.get(event.playerId) ?? 0) + stepsForEvent(event)));
  }

  return { counts, steps: [...positions.values()].reduce((sum, steps) => sum + steps, 0), total: events.length };
}

/** Le/la meneur·euse, ou null en cas d'égalité ou de tableau vide. */
export function soleLeader(rows: Standing[]): Standing | null {
  if (rows.length === 0 || rows[0].steps <= 0) return null;
  if (rows.length > 1 && rows[1].steps === rows[0].steps) return null;
  return rows[0];
}
