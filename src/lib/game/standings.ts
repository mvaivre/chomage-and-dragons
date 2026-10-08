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

/**
 * Replay the journal once, in its order of play, with the journey's floor at zero.
 * Each move is credited to a Zurich month that never goes back for a player: two
 * actions sent around midnight with a slightly late clock cannot hand a month steps
 * the journey never made, and the months always add up to the season.
 */
function replay(events: readonly GameEvent[], known: (playerId: string) => boolean, onMove: (event: GameEvent, month: string, steps: number) => void) {
  const positions = new Map<string, number>(), months = new Map<string, string>();
  for (const event of events) {
    if (!known(event.playerId)) continue;
    const before = positions.get(event.playerId) ?? 0;
    const after = Math.max(0, before + stepsForEvent(event));
    positions.set(event.playerId, after);
    const stamped = eventMonthKey(event.at), previous = months.get(event.playerId);
    const month = previous !== undefined && previous > stamped ? previous : stamped;
    months.set(event.playerId, month);
    onMove(event, month, after - before);
  }
}

function emptyRows(players: readonly Pick<Player, "id">[]) {
  return new Map<string, Standing>(players.map((p) => [p.id, { playerId: p.id, steps: 0, counts: emptyCounts() }]));
}

const ranked = (rows: Map<string, Standing>) => [...rows.values()].sort((a, b) => b.steps - a.steps);

/** The season, or one month's net movement, replayed from the whole history. */
export function standings(events: GameEvent[], players: Player[], month?: string): Standing[] {
  const byPlayer = emptyRows(players);
  replay(events, (id) => byPlayer.has(id), (event, key, steps) => {
    if (month && key !== month) return;
    const standing = byPlayer.get(event.playerId)!;
    standing.steps += steps;
    standing.counts[event.kind] += 1;
  });
  return ranked(byPlayer);
}

/** Several months from a single replay: the palmarès costs one pass, not one per month. */
export function monthlyStandings(events: GameEvent[], players: Player[], months: readonly string[]): Map<string, Standing[]> {
  const byMonth = new Map(months.map((key) => [key, emptyRows(players)]));
  const known = new Set(players.map((p) => p.id));
  replay(events, (id) => known.has(id), (event, key, steps) => {
    const standing = byMonth.get(key)?.get(event.playerId);
    if (!standing) return;
    standing.steps += steps;
    standing.counts[event.kind] += 1;
  });
  return new Map([...byMonth].map(([key, rows]) => [key, ranked(rows)]));
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

/**
 * A month's crown from its ranked rows. Nobody moving forward is not a tie, just a
 * month without exploits.
 */
export function crownOf(rows: Standing[]): { playerId: string | null; steps: number; tied: boolean } {
  const top = rows[0]?.steps ?? 0;
  return { playerId: soleLeader(rows)?.playerId ?? null, steps: top, tied: top > 0 && rows.length > 1 && rows[1].steps === top };
}

/** Le/la meneur·euse, ou null en cas d'égalité ou de tableau vide. */
export function soleLeader(rows: Standing[]): Standing | null {
  if (rows.length === 0 || rows[0].steps <= 0) return null;
  if (rows.length > 1 && rows[1].steps === rows[0].steps) return null;
  return rows[0];
}
