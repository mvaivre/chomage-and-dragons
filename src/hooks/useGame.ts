"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { localStore } from "@/lib/data/local-store";
import type {
  ActionKind,
  GameState,
  MiniGameResult,
  PowerKind,
} from "@/lib/data/types";
import { currentMonthKey, seasonMonthKeys } from "@/lib/game/calendar";
import { CHARACTERS } from "@/lib/game/characters";
import { availablePowers, type AvailablePower } from "@/lib/game/powers";
import { hiredPosition, racePosition } from "@/lib/game/progress";
import { journeyProgress, levelFromSteps } from "@/lib/game/scoring";
import { applyAction, type ActionContext, type ChestGameOffer } from "@/lib/game/reducer";
import {
  collectiveTotals,
  eventsInMonth,
  soleLeader,
  standings,
  type Standing,
} from "@/lib/game/standings";

/** Une couronne mensuelle, décernée le 1er du mois suivant. */
export interface Crown {
  monthKey: string;
  /** Null si personne n'a marqué, ou si le mois est à égalité. */
  playerId: string | null;
  score: number;
  tied: boolean;
}

export interface PlayerView {
  id: string;
  name: string;
  characterId: string;
  /** Score cumulé depuis le début de la saison. */
  score: number;
  /** Score du mois en cours, remis à zéro le 1er. */
  monthScore: number;
  applications: number;
  /** Effort de voyage cumulé, toutes les actions positives pour le trajet comprises. */
  journeySteps: number;
  earnedChests: number;
  level: number;
  /** Position sur le chemin, dans [0, 1]. */
  position: number;
  counts: Record<ActionKind, number>;
  availablePowers: AvailablePower[];
  /** Shots reçus mais pas encore honorés. */
  shotsOwed: number;
  /** Renseigné après une embauche : quitte la course, garde ses points. */
  hiredAt?: string;
}

export type { ChestGameOffer } from "@/lib/game/reducer";

/** Identifiers and timestamps are fixed before the reducer runs, so a re-run gives the same answer. */
function freshContext(): ActionContext {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return { id: () => id, now: () => now };
}

export function useGame() {
  // Lecture directe : ce composant n'est jamais rendu côté serveur (voir
  // GameBoardLoader), donc localStorage est disponible dès le premier rendu.
  const [state, setState] = useState<GameState>(localStore.load);

  useEffect(() => {
    localStore.save(state);
  }, [state]);

  const addEvent = useCallback((playerId: string, kind: ActionKind) => {
    const { state: next, result } = applyAction(state, { type: "addEvent", playerId, kind }, freshContext());
    // Persist the reservation synchronously, including before an immediate reload.
    localStore.save(next);
    setState(next);
    return result;
  }, [state]);

  /** Returns whether anything changed, and a newly crossed chest's slot-machine offer. */
  const finishMiniGame = useCallback((attemptId: string, result: MiniGameResult) => {
    const applied = applyAction(state, { type: "finishMiniGame", attemptId, result }, freshContext());
    if (!applied.result.changed) return applied.result;
    localStore.save(applied.state);
    setState(applied.state);
    return applied.result;
  }, [state]);

  const castPower = useCallback(
    (playerId: string, targetPlayerId: string, kind: PowerKind, slot: number) => {
      const context = freshContext();
      const action = { type: "castPower" as const, playerId, targetPlayerId, kind, slot };
      setState((prev) => applyAction(prev, action, context).state);
      return applyAction(state, action, context).result.cast;
    },
    [state],
  );

  const markCastSeen = useCallback((castId: string) => {
    const context = freshContext();
    setState((prev) => applyAction(prev, { type: "markCastSeen", castId }, context).state);
  }, []);

  const settleShots = useCallback((castIds: string[]) => {
    const context = freshContext();
    setState((prev) => applyAction(prev, { type: "settleShots", castIds }, context).state);
  }, []);

  /**
   * Retire la dernière action de ce joueur : le clic de trop.
   * Sans `kind`, retire la plus récente quelle qu'elle soit.
   */
  const undoLast = useCallback((playerId: string, kind?: ActionKind) => {
    const context = freshContext();
    setState((prev) => applyAction(prev, { type: "undoLast", playerId, kind }, context).state);
  }, []);

  /** Renvoie l'identifiant créé, dont l'appelant a besoin pour ouvrir la session. */
  const addPlayer = useCallback((name: string, characterId: string) => {
    const context = freshContext();
    const action = { type: "addPlayer" as const, name, characterId };
    setState((prev) => applyAction(prev, action, context).state);
    return context.id();
  }, []);

  /** Retire le joueur et tout son journal : utile pour corriger une erreur de saisie. */
  const removePlayer = useCallback((playerId: string) => {
    const context = freshContext();
    setState((prev) => applyAction(prev, { type: "removePlayer", playerId }, context).state);
  }, []);

  const monthKeyNow = currentMonthKey();

  const seasonStandings = useMemo(
    () => standings(state.events, state.players),
    [state],
  );

  const monthStandings = useMemo<Standing[]>(
    () => standings(eventsInMonth(state.events, monthKeyNow), state.players),
    [state, monthKeyNow],
  );

  const players = useMemo<PlayerView[]>(() => {
    const monthScoreById = new Map(
      monthStandings.map((s) => [s.playerId, s.score]),
    );

    return state.players.map((player) => {
      const standing = seasonStandings.find((s) => s.playerId === player.id);
      const applications = standing?.counts.candidature ?? 0;
      const { steps, earnedChests } = journeyProgress(
        state.events.filter((event) => event.playerId === player.id),
      );

      return {
        id: player.id,
        name: player.name,
        characterId: player.characterId,
        score: standing?.score ?? 0,
        monthScore: monthScoreById.get(player.id) ?? 0,
        applications,
        journeySteps: steps,
        earnedChests,
        level: levelFromSteps(steps),
        // Être engagé·e, c'est avoir atteint la taverne : le personnage s'y installe
        // et cesse d'avancer, sans rien perdre de ses points.
        position: player.hiredAt ? hiredPosition(steps) : racePosition(steps),
        counts:
          standing?.counts ??
          ({
            candidature: 0,
            refus: 0,
            entretien: 0,
            rejetApresEntretien: 0,
            embauche: 0,
          } as Record<ActionKind, number>),
        availablePowers: availablePowers(player.id, earnedChests, state.casts, state.miniGames),
        shotsOwed: state.casts.filter(
          (cast) =>
            cast.kind === "shot" &&
            cast.targetPlayerId === player.id &&
            !cast.settledAt,
        ).length,
        hiredAt: player.hiredAt,
      };
    });
  }, [state.players, state.events, state.casts, state.miniGames, seasonStandings, monthStandings]);

  const totals = useMemo(() => collectiveTotals(state.events), [state]);

  /**
   * Le palmarès des couronnes mensuelles, du mois courant au plus ancien.
   * Recalculé depuis le journal, donc toujours d'accord avec le reste.
   */
  const crowns = useMemo<Crown[]>(
    () =>
      seasonMonthKeys().map((key) => {
        const rows = standings(eventsInMonth(state.events, key), state.players);
        const leader = soleLeader(rows);
        return {
          monthKey: key,
          playerId: leader?.playerId ?? null,
          score: rows[0]?.score ?? 0,
          tied: rows.length > 1 && rows[0]?.score === rows[1]?.score,
        };
      }),
    [state],
  );

  const takenCharacters = new Set(state.players.map((p) => p.characterId));
  const freeCharacters = CHARACTERS.filter((c) => !takenCharacters.has(c.id));

  return {
    players,
    events: state.events,
    casts: state.casts,
    monthKeyNow,
    seasonStandings,
    monthStandings,
    totals,
    crowns,
    freeCharacters,
    addEvent,
    finishMiniGame,
    castPower,
    markCastSeen,
    settleShots,
    undoLast,
    addPlayer,
    removePlayer,
  };
}
