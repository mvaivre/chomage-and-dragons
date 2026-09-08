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
  /** Only the candidature mini-game can double travel; ranking points stay unchanged. */
  journeyMultiplier?: 2;
  pigeonFlightId?: string;
}

export type PigeonResult = "hit" | "miss" | "skipped";
export interface PigeonFlight {
  id: string;
  playerId: string;
  /** Application ordinal survives undo/re-entry without granting a fresh attempt. */
  slot: number;
  eventId: string;
  result: "pending" | PigeonResult;
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
  pigeonFlights?: PigeonFlight[];
}
