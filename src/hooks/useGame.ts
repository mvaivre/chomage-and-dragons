"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localStore } from "@/lib/data/local-store";
import { RemoteError, type RemoteStore } from "@/lib/data/remote-store";
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
import { applyAction, type ActionContext, type GameAction } from "@/lib/game/reducer";
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

/** Solo on this device, or a group whose game lives on the server. */
export type GameMode = { kind: "local" } | { kind: "remote"; store: RemoteStore };

const LOCAL: GameMode = { kind: "local" };
const EMPTY: GameState = { players: [], events: [], casts: [] };
const POLL_MS = 8000;

/** Identifiers and timestamps are fixed before the reducer runs, so a re-run gives the same answer. */
function freshContext(): ActionContext {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return { id: () => id, now: () => now };
}

export function useGame(mode: GameMode = LOCAL) {
  const remote = mode.kind === "remote" ? mode.store : null;
  // Lecture directe : ce composant n'est jamais rendu côté serveur (voir
  // GameBoardLoader), donc localStorage est disponible dès le premier rendu.
  const [state, setState] = useState<GameState>(() => (remote ? EMPTY : localStore.load()));
  const [loaded, setLoaded] = useState(!remote);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [remoteMe, setRemoteMe] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<{ status: number; message: string } | null>(null);
  const version = useRef(0);
  const inflight = useRef(0);
  /** Counts the actions sent; a poll that overlapped one is stale and ignored. */
  const commits = useRef(0);

  const adopt = useCallback((snapshot: { state: GameState; version: number; name?: string; me?: string | null }) => {
    version.current = snapshot.version;
    setState(snapshot.state);
    if (snapshot.name !== undefined) setGroupName(snapshot.name);
    if (snapshot.me !== undefined) setRemoteMe(snapshot.me);
  }, []);

  const refresh = useCallback(async () => {
    if (!remote || inflight.current > 0) return;
    const started = commits.current;
    try {
      const snapshot = version.current ? await remote.poll(version.current) : await remote.load();
      // An action sent while this poll was in flight is newer than its answer:
      // adopting it would walk the hero back until the action's own reply lands.
      if (snapshot && commits.current === started && inflight.current === 0) adopt(snapshot);
      setLoaded(true);
    } catch (error) {
      setSyncError(error instanceof RemoteError ? { status: error.status, message: error.message } : { status: 0, message: "Le serveur ne répond pas." });
    }
  }, [remote, adopt]);

  // First load, then a poll every few seconds and whenever the tab comes back.
  useEffect(() => {
    if (!remote) return;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [remote, refresh]);

  /**
   * Apply on the device first, so the interface answers at once, then send the
   * same action with the same ids to the server, whose state supersedes ours.
   */
  const commit = useCallback(<A extends GameAction>(base: GameState, action: A, context: ActionContext, extras: { pin?: string } = {}) => {
    const applied = applyAction(base, action, context);
    if (applied.state !== base) {
      if (!remote) localStore.save(applied.state);
      setState(applied.state);
    }
    if (remote && applied.state !== base) {
      // A new character is this device's from the start; the token confirms it shortly after.
      if (action.type === "addPlayer") setRemoteMe(context.id());
      commits.current += 1;
      inflight.current += 1;
      void remote.dispatch(action, context, extras).then((server) => {
        inflight.current -= 1;
        // Only the last answer of a burst is adopted: earlier ones would lack the later actions.
        if (inflight.current === 0) adopt({ state: server.state, version: server.version });
      }).catch((error: unknown) => {
        inflight.current -= 1;
        setSyncError(error instanceof RemoteError ? { status: error.status, message: error.message } : { status: 0, message: "Le serveur ne répond pas." });
        if (inflight.current === 0) void remote.load().then(adopt).catch(() => {});
      });
    }
    return applied;
  }, [remote, adopt]);

  const addEvent = useCallback((playerId: string, kind: ActionKind) => {
    return commit(state, { type: "addEvent", playerId, kind }, freshContext()).result;
  }, [state, commit]);

  /** Returns whether anything changed, and a newly crossed chest's slot-machine offer. */
  const finishMiniGame = useCallback((attemptId: string, result: MiniGameResult) => {
    return commit(state, { type: "finishMiniGame", attemptId, result }, freshContext()).result;
  }, [state, commit]);

  const castPower = useCallback(
    (playerId: string, targetPlayerId: string, kind: PowerKind, slot: number) => {
      return commit(state, { type: "castPower", playerId, targetPlayerId, kind, slot }, freshContext()).result.cast;
    },
    [state, commit],
  );

  const markCastSeen = useCallback((castId: string) => {
    commit(state, { type: "markCastSeen", castId }, freshContext());
  }, [state, commit]);

  const settleShots = useCallback((castIds: string[]) => {
    commit(state, { type: "settleShots", castIds }, freshContext());
  }, [state, commit]);

  /**
   * Retire la dernière action de ce joueur : le clic de trop.
   * Sans `kind`, retire la plus récente quelle qu'elle soit.
   */
  const undoLast = useCallback((playerId: string, kind?: ActionKind) => {
    commit(state, { type: "undoLast", playerId, kind }, freshContext());
  }, [state, commit]);

  /**
   * Renvoie l'identifiant créé, dont l'appelant a besoin pour ouvrir la session.
   * In a group the PIN is required: it lets the player reclaim the character elsewhere.
   */
  const addPlayer = useCallback((name: string, characterId: string, pin?: string) => {
    const context = freshContext();
    const applied = commit(state, { type: "addPlayer", name, characterId }, context, pin ? { pin } : {});
    return applied.result.player ? context.id() : null;
  }, [state, commit]);

  /** Retire le joueur et tout son journal : utile pour corriger une erreur de saisie. */
  const removePlayer = useCallback((playerId: string) => {
    commit(state, { type: "removePlayer", playerId }, freshContext());
  }, [state, commit]);

  /** Bind an existing character to this device with its PIN. */
  const claim = useCallback(async (playerId: string, pin: string) => {
    if (!remote) return;
    await remote.claim(playerId, pin);
    setRemoteMe(playerId);
  }, [remote]);

  const clearSyncError = useCallback(() => setSyncError(null), []);

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
    loaded,
    groupName,
    remoteMe,
    syncError,
    clearSyncError,
    refresh,
    claim,
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
