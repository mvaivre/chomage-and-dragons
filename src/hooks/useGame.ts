"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "@/lib/data/local-store";
import type {
  ActionKind,
  GameEvent,
  GameState,
  PowerCast,
  PowerKind,
} from "@/lib/data/types";
import { currentMonthKey, seasonMonthKeys } from "@/lib/game/calendar";
import { CHARACTERS } from "@/lib/game/characters";
import { availablePowers, type AvailablePower } from "@/lib/game/powers";
import { racePosition } from "@/lib/game/progress";
import { journeySteps, levelFromSteps } from "@/lib/game/scoring";
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
  level: number;
  /** Position sur le chemin, dans [0, 1]. */
  position: number;
  counts: Record<ActionKind, number>;
  availablePowers: AvailablePower[];
  /** Renseigné après une embauche : quitte la course, garde ses points. */
  hiredAt?: string;
}

export function useGame() {
  // Lecture directe : ce composant n'est jamais rendu côté serveur (voir
  // GameBoardLoader), donc localStorage est disponible dès le premier rendu.
  const [state, setState] = useState<GameState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addEvent = useCallback((playerId: string, kind: ActionKind) => {
    const event: GameEvent = {
      id: crypto.randomUUID(),
      playerId,
      kind,
      at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      events: [...prev.events, event],
      // Une embauche sort le personnage de la course active, sans toucher au score.
      players:
        kind === "embauche"
          ? prev.players.map((p) =>
              p.id === playerId && !p.hiredAt ? { ...p, hiredAt: event.at } : p,
            )
          : prev.players,
    }));

    return event;
  }, []);

  const castPower = useCallback(
    (playerId: string, targetPlayerId: string, kind: PowerKind, slot: number) => {
      const cast: PowerCast = {
        id: crypto.randomUUID(),
        playerId,
        targetPlayerId,
        kind,
        slot,
        at: new Date().toISOString(),
      };

      setState((prev) => {
        const validPlayers =
          playerId !== targetPlayerId &&
          prev.players.some((player) => player.id === playerId) &&
          prev.players.some((player) => player.id === targetPlayerId);
        const slotIsFree = !prev.casts.some(
          (existing) => existing.playerId === playerId && existing.slot === slot,
        );

        return validPlayers && slotIsFree
          ? { ...prev, casts: [...prev.casts, cast] }
          : prev;
      });

      return cast;
    },
    [],
  );

  const markCastSeen = useCallback((castId: string) => {
    setState((prev) => ({
      ...prev,
      casts: prev.casts.map((cast) =>
        cast.id === castId && !cast.seenAt
          ? { ...cast, seenAt: new Date().toISOString() }
          : cast,
      ),
    }));
  }, []);

  /**
   * Retire la dernière action de ce joueur : le clic de trop.
   * Sans `kind`, retire la plus récente quelle qu'elle soit.
   */
  const undoLast = useCallback((playerId: string, kind?: ActionKind) => {
    setState((prev) => {
      const index = prev.events.findLastIndex(
        (e) => e.playerId === playerId && (kind === undefined || e.kind === kind),
      );
      if (index === -1) return prev;

      const events = [...prev.events];
      events.splice(index, 1);

      const stillHired = events.some(
        (e) => e.playerId === playerId && e.kind === "embauche",
      );

      return {
        ...prev,
        events,
        players: prev.players.map((p) =>
          p.id === playerId && !stillHired ? { ...p, hiredAt: undefined } : p,
        ),
      };
    });
  }, []);

  /** Renvoie l'identifiant créé, dont l'appelant a besoin pour ouvrir la session. */
  const addPlayer = useCallback((name: string, characterId: string) => {
    const player = {
      id: crypto.randomUUID(),
      name: name.trim(),
      characterId,
      // Arriver en cours de saison ne donne aucun point rétroactif : la vraie
      // chance de victoire est la Couronne du mois, qui repart de zéro.
      joinedAt: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, players: [...prev.players, player] }));
    return player.id;
  }, []);

  /** Retire le joueur et tout son journal : utile pour corriger une erreur de saisie. */
  const removePlayer = useCallback((playerId: string) => {
    setState((prev) => ({
      players: prev.players.filter((p) => p.id !== playerId),
      events: prev.events.filter((e) => e.playerId !== playerId),
      casts: prev.casts.filter(
        (cast) => cast.playerId !== playerId && cast.targetPlayerId !== playerId,
      ),
    }));
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
      const steps = journeySteps(
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
        level: levelFromSteps(steps),
        // Être engagé·e, c'est avoir atteint la taverne : le personnage s'y installe
        // et cesse d'avancer, sans rien perdre de ses points.
        position: player.hiredAt ? 1 : racePosition(steps),
        counts:
          standing?.counts ??
          ({
            candidature: 0,
            refus: 0,
            entretien: 0,
            rejetApresEntretien: 0,
            embauche: 0,
          } as Record<ActionKind, number>),
        availablePowers: availablePowers(player.id, steps, state.casts),
        hiredAt: player.hiredAt,
      };
    });
  }, [state.players, state.events, state.casts, seasonStandings, monthStandings]);

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
    castPower,
    markCastSeen,
    undoLast,
    addPlayer,
    removePlayer,
  };
}
