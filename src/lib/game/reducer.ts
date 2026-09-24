import type { ActionKind, Cheer, CheerEmoji, GameEvent, GameState, MiniGameKind, MiniGameResult, Player, PowerCast, PowerKind } from "@/lib/data/types";

export const CHEER_EMOJIS: readonly CheerEmoji[] = ["👏", "🍺", "🔥", "😂", "🫂"];
import { CHARACTERS } from "@/lib/game/characters";
import { reserveChestGame, reserveMiniGame, resolveMiniGame } from "@/lib/game/mini-games";
import { journeyProgress } from "@/lib/game/scoring";

/**
 * Every change to a game goes through here, on the device for an immediate
 * answer and on the server for the state that counts. The reducer is pure:
 * identifiers and timestamps come from the context, so the same action on the
 * same state always produces the same result. Invalid actions leave the state
 * untouched and say why in `rejected`, instead of throwing.
 */

export type GameAction =
  | { type: "addEvent"; playerId: string; kind: ActionKind }
  | { type: "finishMiniGame"; attemptId: string; result: MiniGameResult }
  | { type: "castPower"; playerId: string; targetPlayerId: string; kind: PowerKind; slot: number }
  | { type: "markCastSeen"; castId: string }
  | { type: "settleShots"; castIds: string[] }
  | { type: "undoLast"; playerId: string; kind?: ActionKind }
  | { type: "addPlayer"; name: string; characterId: string }
  | { type: "removePlayer"; playerId: string }
  | { type: "cheer"; playerId: string; eventId: string; emoji: CheerEmoji };

export interface ActionContext {
  /** A fresh identifier for anything the action creates. */
  id: () => string;
  /** The instant of the action, ISO 8601. */
  now: () => string;
}

export interface ChestGameOffer {
  attemptId: string;
  offer: boolean;
}

export interface ActionResults {
  addEvent: { event: GameEvent | null; offer: MiniGameKind | null; chestGame: ChestGameOffer | null; rejected?: string };
  finishMiniGame: { changed: boolean; chestGame: ChestGameOffer | null; rejected?: string };
  castPower: { cast: PowerCast; accepted: boolean; rejected?: string };
  markCastSeen: { rejected?: string };
  settleShots: { rejected?: string };
  undoLast: { removed: GameEvent | null; rejected?: string };
  addPlayer: { player: Player | null; rejected?: string };
  removePlayer: { rejected?: string };
  cheer: { cheer: Cheer | null; rejected?: string };
}

export type ActionResult<A extends GameAction> = ActionResults[A["type"]];

/** Deterministic context for tests and replays. */
export function fixedContext(id: string, now: string): ActionContext {
  return { id: () => id, now: () => now };
}

/** A chest crossed by this change gets its slot-machine attempt reserved in the same save. */
export function reserveCrossedChest(previous: GameState, next: GameState, playerId: string, eventId: string): { state: GameState; chestGame: ChestGameOffer | null } {
  const before = journeyProgress(previous.events.filter((e) => e.playerId === playerId)).earnedChests;
  const after = journeyProgress(next.events.filter((e) => e.playerId === playerId)).earnedChests;
  if (after <= before) return { state: next, chestGame: null };
  const reserved = reserveChestGame(next, playerId, after - 1, eventId);
  return { state: reserved.state, chestGame: { attemptId: reserved.attempt.id, offer: reserved.offer } };
}

function addEvent(state: GameState, action: Extract<GameAction, { type: "addEvent" }>, context: ActionContext) {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { state, result: { event: null, offer: null, chestGame: null, rejected: "unknown player" } };
  if (player.hiredAt) return { state, result: { event: null, offer: null, chestGame: null, rejected: "player already hired" } };
  const event: GameEvent = { id: context.id(), playerId: action.playerId, kind: action.kind, at: context.now() };
  const reservation = reserveMiniGame(state, event);
  const crossed = reserveCrossedChest(state, { ...reservation.state, events: [...state.events, reservation.event] }, action.playerId, event.id);
  const next: GameState = {
    ...crossed.state,
    // Une embauche sort le personnage de la course active, sans toucher au score.
    players: action.kind === "embauche"
      ? state.players.map((p) => (p.id === action.playerId && !p.hiredAt ? { ...p, hiredAt: event.at } : p))
      : state.players,
  };
  return { state: next, result: { event: reservation.event, offer: reservation.offer, chestGame: crossed.chestGame } };
}

function finishMiniGame(state: GameState, action: Extract<GameAction, { type: "finishMiniGame" }>) {
  const resolved = resolveMiniGame(state, action.attemptId, action.result);
  if (resolved === state) return { state, result: { changed: false, chestGame: null } };
  const attempt = resolved.miniGames?.find((a) => a.id === action.attemptId);
  const crossed = attempt ? reserveCrossedChest(state, resolved, attempt.playerId, attempt.eventId) : { state: resolved, chestGame: null };
  return { state: crossed.state, result: { changed: true, chestGame: crossed.chestGame } };
}

function castPower(state: GameState, action: Extract<GameAction, { type: "castPower" }>, context: ActionContext) {
  const cast: PowerCast = { id: context.id(), playerId: action.playerId, targetPlayerId: action.targetPlayerId, kind: action.kind, slot: action.slot, at: context.now() };
  const validPlayers = action.playerId !== action.targetPlayerId &&
    state.players.some((player) => player.id === action.playerId) &&
    state.players.some((player) => player.id === action.targetPlayerId);
  const slotIsFree = !state.casts.some((existing) => existing.playerId === action.playerId && existing.slot === action.slot);
  if (!validPlayers) return { state, result: { cast, accepted: false, rejected: "invalid players" } };
  if (!slotIsFree) return { state, result: { cast, accepted: false, rejected: "loot already cast" } };
  return { state: { ...state, casts: [...state.casts, cast] }, result: { cast, accepted: true } };
}

function markCastSeen(state: GameState, action: Extract<GameAction, { type: "markCastSeen" }>, context: ActionContext) {
  const at = context.now();
  return { state: { ...state, casts: state.casts.map((cast) => (cast.id === action.castId && !cast.seenAt ? { ...cast, seenAt: at } : cast)) }, result: {} };
}

function settleShots(state: GameState, action: Extract<GameAction, { type: "settleShots" }>, context: ActionContext) {
  const ids = new Set(action.castIds);
  const at = context.now();
  return {
    state: { ...state, casts: state.casts.map((cast) => (cast.kind === "shot" && ids.has(cast.id) && !cast.settledAt ? { ...cast, seenAt: cast.seenAt ?? at, settledAt: at } : cast)) },
    result: {},
  };
}

/** Retire la dernière action de ce joueur : le clic de trop. Sans `kind`, la plus récente. */
function undoLast(state: GameState, action: Extract<GameAction, { type: "undoLast" }>) {
  const index = state.events.findLastIndex((e) => e.playerId === action.playerId && (action.kind === undefined || e.kind === action.kind));
  if (index === -1) return { state, result: { removed: null, rejected: "nothing to undo" } };
  const events = [...state.events];
  const [removed] = events.splice(index, 1);
  const cheers = state.cheers?.filter((c) => c.eventId !== removed.id);
  const stillHired = events.some((e) => e.playerId === action.playerId && e.kind === "embauche");
  return {
    state: { ...state, events, ...(cheers ? { cheers } : {}), players: state.players.map((p) => (p.id === action.playerId && !stillHired ? { ...p, hiredAt: undefined } : p)) },
    result: { removed },
  };
}

function addPlayer(state: GameState, action: Extract<GameAction, { type: "addPlayer" }>, context: ActionContext) {
  const name = action.name.trim();
  if (!name) return { state, result: { player: null, rejected: "empty name" } };
  if (!CHARACTERS.some((c) => c.id === action.characterId)) return { state, result: { player: null, rejected: "unknown character" } };
  if (state.players.some((p) => p.characterId === action.characterId)) return { state, result: { player: null, rejected: "character taken" } };
  // Arriver en cours de saison ne donne aucun point rétroactif : la vraie chance
  // de victoire est la Couronne du mois, qui repart de zéro.
  const player: Player = { id: context.id(), name, characterId: action.characterId, joinedAt: context.now() };
  return { state: { ...state, players: [...state.players, player] }, result: { player } };
}

/**
 * One cheer per friend and per action; cheering again changes the emoji, and
 * the same emoji twice takes it back. Nobody cheers their own action.
 */
function cheer(state: GameState, action: Extract<GameAction, { type: "cheer" }>, context: ActionContext) {
  const event = state.events.find((e) => e.id === action.eventId);
  if (!event) return { state, result: { cheer: null, rejected: "unknown event" } };
  if (!state.players.some((p) => p.id === action.playerId)) return { state, result: { cheer: null, rejected: "unknown player" } };
  if (event.playerId === action.playerId) return { state, result: { cheer: null, rejected: "own action" } };
  if (!CHEER_EMOJIS.includes(action.emoji)) return { state, result: { cheer: null, rejected: "unknown emoji" } };
  const cheers = state.cheers ?? [];
  const previous = cheers.find((c) => c.eventId === action.eventId && c.playerId === action.playerId);
  const others = cheers.filter((c) => c !== previous);
  if (previous?.emoji === action.emoji) return { state: { ...state, cheers: others }, result: { cheer: null } };
  const created: Cheer = { id: context.id(), eventId: action.eventId, playerId: action.playerId, emoji: action.emoji, at: context.now() };
  return { state: { ...state, cheers: [...others, created] }, result: { cheer: created } };
}

/** Retire le joueur et tout son journal : utile pour corriger une erreur de saisie. */
function removePlayer(state: GameState, action: Extract<GameAction, { type: "removePlayer" }>) {
  if (!state.players.some((p) => p.id === action.playerId)) return { state, result: { rejected: "unknown player" } };
  return {
    state: {
      ...state,
      players: state.players.filter((p) => p.id !== action.playerId),
      events: state.events.filter((e) => e.playerId !== action.playerId),
      casts: state.casts.filter((cast) => cast.playerId !== action.playerId && cast.targetPlayerId !== action.playerId),
      miniGames: state.miniGames?.filter((attempt) => attempt.playerId !== action.playerId),
      cheers: state.cheers?.filter((c) => c.playerId !== action.playerId && state.events.some((e) => e.id === c.eventId && e.playerId !== action.playerId)),
    },
    result: {},
  };
}

export function applyAction<A extends GameAction>(state: GameState, action: A, context: ActionContext): { state: GameState; result: ActionResult<A> } {
  switch (action.type) {
    case "addEvent": return addEvent(state, action, context) as { state: GameState; result: ActionResult<A> };
    case "finishMiniGame": return finishMiniGame(state, action) as { state: GameState; result: ActionResult<A> };
    case "castPower": return castPower(state, action, context) as { state: GameState; result: ActionResult<A> };
    case "markCastSeen": return markCastSeen(state, action, context) as { state: GameState; result: ActionResult<A> };
    case "settleShots": return settleShots(state, action, context) as { state: GameState; result: ActionResult<A> };
    case "undoLast": return undoLast(state, action) as { state: GameState; result: ActionResult<A> };
    case "addPlayer": return addPlayer(state, action, context) as { state: GameState; result: ActionResult<A> };
    case "removePlayer": return removePlayer(state, action) as { state: GameState; result: ActionResult<A> };
    case "cheer": return cheer(state, action, context) as { state: GameState; result: ActionResult<A> };
  }
}
