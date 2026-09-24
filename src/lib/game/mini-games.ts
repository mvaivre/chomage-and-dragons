import { MINI_GAME_BONUS } from "@/lib/config";
import { clampScore } from "@/lib/game/scores";
import type { ActionKind, GameEvent, GameState, MiniGameAttempt, MiniGameKind, MiniGameResult } from "@/lib/data/types";

/**
 * Optional mini-games decorate the official actions. Each one is offered once
 * per action ordinal (or per chest) and only ever adds journey steps or loot:
 * the ranking points of the action stay exactly what the journal says.
 */

export interface MiniGameCopy {
  kind: MiniGameKind;
  /** The unemployment misery it makes fun of. */
  misery: string;
  title: string;
  winFeedback: string;
}

export const MINI_GAMES: Record<MiniGameKind, MiniGameCopy> = {
  pigeon: { kind: "pigeon", misery: "Courrier presque prioritaire", title: "Le pigeon à reculons", winFeedback: "Livraison à reculons ×2" },
  keywords: { kind: "keywords", misery: "Le robot trieur de CV", title: "Le CV à mots-clés", winFeedback: "CV validé par le robot ×2" },
  stamp: { kind: "stamp", misery: "Les preuves de recherches", title: "Le Tampon de l’ORP", winFeedback: "Dossier conforme" },
  quiz: { kind: "quiz", misery: "« Quel est votre plus grand défaut ? »", title: "Le Test de personnalité", winFeedback: "Mensonge avec panache" },
  ghosting: { kind: "ghosting", misery: "Sans nouvelles depuis 14 jours", title: "Ne relance pas", winFeedback: "Recruteur attrapé au vol" },
  slots: { kind: "slots", misery: "Salaire : selon expérience", title: "Salaire selon expérience", winFeedback: "Jackpot : un butin de plus" },
};

/** Applications alternate between the two courier games; other actions have one each. */
export function miniGameForAction(action: ActionKind, slot: number): MiniGameKind | null {
  switch (action) {
    case "candidature": return slot % 2 === 0 ? "pigeon" : "keywords";
    case "refus": return "stamp";
    case "entretien": return "quiz";
    case "rejetApresEntretien": return "ghosting";
    default: return null;
  }
}

export function miniGameBonus(action: ActionKind): number {
  return MINI_GAME_BONUS[action];
}

function ordinal(state: GameState, playerId: string, action: ActionKind): number {
  return state.events.filter(e => e.playerId === playerId && e.kind === action).length;
}

function withResult(event: GameEvent, attempt: MiniGameAttempt): GameEvent {
  const decorated: GameEvent = { ...event, miniGameId: attempt.id };
  return attempt.result === "won" ? { ...decorated, journeyBonus: miniGameBonus(event.kind) } : decorated;
}

/**
 * Reserve before offering the game, on the event being added. A re-entered
 * action finds its earlier attempt: the bonus comes back, the offer does not.
 */
export function reserveMiniGame(state: GameState, event: GameEvent): { state: GameState; event: GameEvent; offer: MiniGameKind | null } {
  const slot = ordinal(state, event.playerId, event.kind);
  const kind = miniGameForAction(event.kind, slot);
  if (!kind) return { state, event, offer: null };
  const previous = state.miniGames?.find(a => a.playerId === event.playerId && a.action === event.kind && a.slot === slot);
  const attempt: MiniGameAttempt = previous ?? { id: event.id, playerId: event.playerId, kind, action: event.kind, slot, eventId: event.id, result: "pending" };
  return {
    state: previous ? state : { ...state, miniGames: [...state.miniGames ?? [], attempt] },
    event: withResult(event, attempt),
    offer: previous ? null : kind,
  };
}

/** Chests have a double bottom: one slot-machine attempt per chest index, whoever earned it. */
export function reserveChestGame(state: GameState, playerId: string, chestIndex: number, eventId: string): { state: GameState; attempt: MiniGameAttempt; offer: boolean } {
  const previous = state.miniGames?.find(a => a.playerId === playerId && a.action === "chest" && a.slot === chestIndex);
  if (previous) return { state, attempt: previous, offer: false };
  const attempt: MiniGameAttempt = { id: `${eventId}-chest-${chestIndex}`, playerId, kind: "slots", action: "chest", slot: chestIndex, eventId, result: "pending" };
  return { state: { ...state, miniGames: [...state.miniGames ?? [], attempt] }, attempt, offer: true };
}

/** Award once. A stale or repeated result is harmless. */
export function resolveMiniGame(state: GameState, attemptId: string, result: MiniGameResult, score?: number): GameState {
  const attempt = state.miniGames?.find(a => a.id === attemptId);
  if (!attempt || attempt.result !== "pending") return state;
  const bounded = result !== "skipped" ? clampScore(attempt.kind, score) : undefined;
  const scored = bounded !== undefined ? { score: bounded } : {};
  // An action game only settles on its still-present event; a stale result after undo is ignored.
  if (attempt.action !== "chest" && !state.events.some(e => e.id === attempt.eventId && e.kind === attempt.action)) return state;
  const miniGames = state.miniGames?.map(a => a.id === attemptId ? { ...a, result, ...scored } : a);
  if (result !== "won" || attempt.action === "chest") return { ...state, miniGames };
  return {
    ...state,
    miniGames,
    events: state.events.map(e => e.id === attempt.eventId && e.kind === attempt.action ? { ...e, journeyBonus: miniGameBonus(e.kind) } : e),
  };
}

/** Jackpots grant an extra loot slot, numbered far above the chest slots. */
export const BONUS_POWER_SLOT_BASE = 1000;

export function wonChestGames(state: Pick<GameState, "miniGames">, playerId: string, earnedChests: number): MiniGameAttempt[] {
  return (state.miniGames ?? []).filter(a => a.playerId === playerId && a.action === "chest" && a.result === "won" && a.slot < earnedChests);
}
