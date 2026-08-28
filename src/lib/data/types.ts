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
 * Une ligne immuable du journal. Les scores sont recalculés à la lecture, jamais
 * stockés — c'est ce qui rend l'annulation et le classement mensuel triviaux.
 */
export interface GameEvent {
  id: string;
  playerId: string;
  kind: ActionKind;
  /** Instant ISO. Sert au score annuel, au classement mensuel et au facteur temps. */
  at: string;
}

export type PowerKind = "feuSacré" | "fienteDragon" | "paperasse" | "crapaud";

/** Une farce lancée grâce à un coffre. Elle n'affecte jamais le score ni le voyage. */
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
}

export interface GameState {
  players: Player[];
  events: GameEvent[];
  casts: PowerCast[];
}
