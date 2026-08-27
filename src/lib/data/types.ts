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

export interface GameState {
  players: Player[];
  events: GameEvent[];
}
