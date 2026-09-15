import { CHARACTERS } from "@/lib/game/characters";
import type { GameState } from "./types";

/**
 * Persistance locale du prototype.
 *
 * ⚠️ SEUL MODULE À REMPLACER pour passer à Neon Postgres. Rien d'autre dans le code
 * ne doit savoir où les données sont stockées. Les signatures resteront les mêmes,
 * en devenant asynchrones.
 */

const STORAGE_KEY = "louchomage:v2";
const LEGACY_KEY = "louchomage:v1";

/**
 * Les émojis d'origine sont devenus des classes de jeu de rôle. Cette table évite
 * de perdre les parties commencées avant le changement.
 */
const LEGACY_CHARACTERS: Record<string, string> = {
  licorne: "paladin",
  flamant: "barde",
  baleine: "paladin",
  sirene: "druidesse",
  dragon: "necromancien",
  renard: "voleur",
  hibou: "archimage",
  loup: "chevalier",
  magicienne: "sorciere",
  elfe: "voleur",
  grimpeur: "chevalier",
  papillon: "barde",
};

const EMPTY: GameState = { players: [], events: [], casts: [] };

const knownCharacter = (id: string) => CHARACTERS.some((c) => c.id === id);

/** Remplace les identifiants inconnus, en évitant de donner deux fois la même classe. */
function migrateCharacters(state: GameState): GameState {
  const taken = new Set(
    state.players.map((p) => p.characterId).filter(knownCharacter),
  );

  return {
    ...state,
    players: state.players.map((player) => {
      if (knownCharacter(player.characterId)) return player;

      const wanted = LEGACY_CHARACTERS[player.characterId];
      const fallback =
        wanted && knownCharacter(wanted) && !taken.has(wanted)
          ? wanted
          : (CHARACTERS.find((c) => !taken.has(c.id)) ?? CHARACTERS[0]).id;

      taken.add(fallback);
      return { ...player, characterId: fallback };
    }),
  };
}

/** The first pigeon game kept its own list; every mini-game now shares one. */
export function migrateMiniGames(state: GameState): GameState {
  if (!state.pigeonFlights?.length) {
    const { pigeonFlights: _legacy, ...rest } = state;
    void _legacy;
    return rest;
  }
  const known = new Set((state.miniGames ?? []).map(attempt => attempt.id));
  const migrated = state.pigeonFlights.filter(flight => !known.has(flight.id)).map(flight => ({
    id: flight.id,
    playerId: flight.playerId,
    kind: "pigeon" as const,
    action: "candidature" as const,
    slot: flight.slot,
    eventId: flight.eventId,
    result: flight.result === "hit" ? "won" as const : flight.result === "miss" ? "lost" as const : flight.result,
  }));
  const { pigeonFlights: _legacy, ...rest } = state;
  void _legacy;
  return {
    ...rest,
    miniGames: [...state.miniGames ?? [], ...migrated],
    events: state.events.map(event => event.pigeonFlightId && !event.miniGameId ? { ...event, miniGameId: event.pigeonFlightId } : event),
  };
}

function parse(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!Array.isArray(parsed.players) || !Array.isArray(parsed.events)) {
      return null;
    }
    return migrateMiniGames(migrateCharacters({ ...parsed, casts: parsed.casts ?? [] }));
  } catch {
    return null;
  }
}

export function loadState(): GameState {
  if (typeof window === "undefined") return EMPTY;

  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return parse(current) ?? EMPTY;

    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) return parse(legacy) ?? EMPTY;

    return EMPTY;
  } catch {
    return EMPTY;
  }
}

export function saveState(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota dépassé ou mode privé : on perd la persistance, pas la session.
  }
}

export function resetState(): GameState {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Rien à faire.
    }
  }
  return EMPTY;
}
