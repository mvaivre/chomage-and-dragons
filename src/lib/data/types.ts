/**
 * Les 5 actions officielles. Ce sont les seules choses qui touchent au score :
 * niveaux, coffres et événements aléatoires restent purement narratifs.
 */
export type ActionKind =
  | "candidature"
  | "refus"
  | "entretien"
  | "rejetApresEntretien"
  | "embauche";

export interface Player {
  id: string;
  name: string;
  /** Référence vers CHARACTERS. */
  characterId: string;
  /** Instant ISO d'arrivée dans la partie. Ne donne aucun point rétroactif. */
  joinedAt: string;
  /** Renseigné après une embauche : le personnage quitte la course, garde ses points. */
  hiredAt?: string;
}

/**
 * Une action du journal, complétée une seule fois par son éventuel résultat de
 * mini-jeu. Les scores et pas sont recalculés à la lecture, jamais stockés.
 */
export interface GameEvent {
  id: string;
  playerId: string;
  kind: ActionKind;
  /** Instant ISO. Sert au score annuel, au classement mensuel et au facteur temps. */
  at: string;
  /** Legacy: the first pigeon game doubled application travel. Kept for old journals. */
  journeyMultiplier?: 2;
  /** Extra journey steps won in mini-games. Ranking points never change. */
  journeyBonus?: number;
  miniGameId?: string;
  /** Legacy pointer of the first pigeon game, migrated into miniGameId on load. */
  pigeonFlightId?: string;
}

export type MiniGameKind = "pigeon" | "keywords" | "stamp" | "quiz" | "ghosting" | "slots";
export type MiniGameResult = "won" | "lost" | "skipped";
/**
 * One attempt per action ordinal (or per chest): undo, re-entry and reloads find
 * the same attempt again instead of granting a replay.
 */
export interface MiniGameAttempt {
  id: string;
  playerId: string;
  kind: MiniGameKind;
  /** The action it decorates, or the chest whose double bottom it opens. */
  action: ActionKind | "chest";
  slot: number;
  /** The event that unlocked it; a chest attempt keeps the event that earned the chest. */
  eventId: string;
  result: "pending" | MiniGameResult;
}

/** Legacy save format of the first pigeon game, migrated on load. */
export interface PigeonFlight {
  id: string;
  playerId: string;
  slot: number;
  eventId: string;
  result: "pending" | "hit" | "miss" | "skipped";
}

export type PowerKind =
  | "shot"
  | "feuSacré"
  | "fienteDragon"
  | "paperasse"
  | "crapaud";

/** Un butin offert grâce à un coffre. Il n'affecte jamais le score ni le voyage. */
export interface PowerCast {
  id: string;
  playerId: string;
  targetPlayerId: string;
  kind: PowerKind;
  /** Numéro du coffre consommé, en partant de zéro. */
  slot: number;
  at: string;
  /** Renseigné quand la cible a ouvert sa session et vu l'animation. */
  seenAt?: string;
  /** Un shot reste dû jusqu'à ce que sa cible l'ait honoré. */
  settledAt?: string;
}

export interface GameState {
  players: Player[];
  events: GameEvent[];
  casts: PowerCast[];
  miniGames?: MiniGameAttempt[];
  /** Legacy, converted into miniGames when a save is loaded. */
  pigeonFlights?: PigeonFlight[];
}
