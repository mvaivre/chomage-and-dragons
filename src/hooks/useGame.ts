"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "@/lib/data/local-store";
import type { ActionKind, GameEvent, GameState } from "@/lib/data/types";
import { currentMonthKey, seasonMonthKeys } from "@/lib/game/calendar";
import { CHARACTERS } from "@/lib/game/characters";
import { racePosition } from "@/lib/game/progress";
import { levelFromApplications } from "@/lib/game/scoring";
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
  level: number;
  /** Position sur le chemin, dans [0, 1]. */
  position: number;
  counts: Record<ActionKind, number>;
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
    const now = new Date();
    const monthScoreById = new Map(
      monthStandings.map((s) => [s.playerId, s.score]),
    );

    return state.players.map((player) => {
      const standing = seasonStandings.find((s) => s.playerId === player.id);
      const applications = standing?.counts.candidature ?? 0;

      return {
        id: player.id,
        name: player.name,
        characterId: player.characterId,
        score: standing?.score ?? 0,
        monthScore: monthScoreById.get(player.id) ?? 0,
        applications,
        level: levelFromApplications(applications),
        // Être engagé·e, c'est avoir atteint la taverne : le personnage s'y installe
        // et cesse d'avancer, sans rien perdre de ses points.
        position: player.hiredAt ? 1 : racePosition(applications, now),
        counts:
          standing?.counts ??
          ({
            candidature: 0,
            refus: 0,
            entretien: 0,
            rejetApresEntretien: 0,
            embauche: 0,
          } as Record<ActionKind, number>),
        hiredAt: player.hiredAt,
      };
    });
  }, [state.players, seasonStandings, monthStandings]);

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
    monthKeyNow,
    seasonStandings,
    monthStandings,
    totals,
    crowns,
    freeCharacters,
    addEvent,
    undoLast,
    addPlayer,
    removePlayer,
  };
}
