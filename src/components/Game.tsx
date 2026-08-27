"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Effect, EffectKind } from "@/components/game/Effects";
import GameCanvas from "@/components/game/GameCanvas";
import { heroOrigin } from "@/components/game/lanes";
import { ActionBar } from "@/components/hud/ActionBar";
import {
  CompactLeaderboard,
  LeaderboardOverlay,
} from "@/components/hud/Leaderboard";
import { QuestHud } from "@/components/hud/QuestHud";
import { TitleScreen } from "@/components/hud/TitleScreen";
import { useGame } from "@/hooks/useGame";
import { APPLICATIONS_PER_LEVEL } from "@/lib/config";
import { clearSession, loadSession, saveSession } from "@/lib/data/session";
import type { ActionKind } from "@/lib/data/types";
import { ACTION_LABELS_ONE } from "@/lib/game/standings";

/**
 * Le jeu complet.
 *
 * La scène tourne en permanence, y compris derrière l'écran de titre : on choisit
 * son personnage devant un paysage qui vit déjà. L'identité du joueur vient de la
 * session locale, et tout ce qui relève de la consultation se déplie par-dessus.
 */

const EFFECT_FOR: Record<ActionKind, EffectKind> = {
  candidature: "pigeon",
  refus: "lightning",
  entretien: "cocktail",
  rejetApresEntretien: "legendary",
  embauche: "trophy",
};

export function Game() {
  const {
    players,
    events,
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
  } = useGame();

  const [meId, setMeId] = useState<string | null>(loadSession);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [effects, setEffects] = useState<Effect[]>([]);

  const meIndex = players.findIndex((p) => p.id === meId);
  const me = meIndex === -1 ? null : players[meIndex];

  // Une session qui désigne quelqu'un de retiré de la partie ne vaut rien : on
  // repart de l'écran de titre, et le prochain choix écrasera la valeur périmée.
  const identity = me ? meId : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setRegisterOpen((open) => !open);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const seasonRank = useMemo(() => {
    const index = seasonStandings.findIndex((s) => s.playerId === identity);
    return index === -1 ? null : index + 1;
  }, [seasonStandings, identity]);

  const lastActionLabel = useMemo(() => {
    if (!me) return null;
    const index = events.findLastIndex((e) => e.playerId === me.id);
    return index === -1 ? null : ACTION_LABELS_ONE[events[index].kind];
  }, [events, me]);

  const handleAction = useCallback(
    (kind: ActionKind) => {
      if (!me) return;

      const event = addEvent(me.id, kind);
      const origin = heroOrigin(me, meIndex);

      const queued: Effect[] = [
        { id: event.id, kind: EFFECT_FOR[kind], origin },
      ];

      // Un palier de dix candidatures ouvre un coffre, en plus du pigeon.
      if (
        kind === "candidature" &&
        (me.applications + 1) % APPLICATIONS_PER_LEVEL === 0
      ) {
        queued.push({ id: `${event.id}-chest`, kind: "chest", origin });
      }

      setEffects((prev) => [...prev, ...queued]);
    },
    [addEvent, me, meIndex],
  );

  const handleUndo = useCallback(() => {
    if (me) undoLast(me.id);
  }, [me, undoLast]);

  const handleEffectDone = useCallback((id: string) => {
    setEffects((prev) => prev.filter((effect) => effect.id !== id));
  }, []);

  const handlePick = useCallback((playerId: string) => {
    saveSession(playerId);
    setMeId(playerId);
  }, []);

  const handleCreate = useCallback(
    (name: string, characterId: string) => {
      const id = addPlayer(name, characterId);
      saveSession(id);
      setMeId(id);
    },
    [addPlayer],
  );

  const handleChangeIdentity = useCallback(() => {
    clearSession();
    setMeId(null);
    setRegisterOpen(false);
  }, []);

  const canUndo = Boolean(
    me && events.some((event) => event.playerId === me.id),
  );

  return (
    <main className="relative h-full w-full overflow-hidden bg-ink-deep">
      <GameCanvas
        players={players}
        meId={identity}
        effects={effects}
        onEffectDone={handleEffectDone}
      />

      <div className="vignette absolute inset-0" />

      {me ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <QuestHud me={me} seasonRank={seasonRank} />
            <CompactLeaderboard
              players={players}
              monthStandings={monthStandings}
              monthKeyNow={monthKeyNow}
              meId={identity}
              onOpen={() => setRegisterOpen(true)}
            />
          </div>

          <div className="flex justify-center">
            <ActionBar
              onAction={handleAction}
              onUndo={handleUndo}
              canUndo={canUndo}
              hired={Boolean(me.hiredAt)}
              lastActionLabel={lastActionLabel}
            />
          </div>
        </div>
      ) : null}

      {registerOpen ? (
        <LeaderboardOverlay
          players={players}
          seasonStandings={seasonStandings}
          monthStandings={monthStandings}
          monthKeyNow={monthKeyNow}
          crowns={crowns}
          totals={totals}
          freeCharacters={freeCharacters}
          meId={identity}
          onAddPlayer={addPlayer}
          onRemovePlayer={removePlayer}
          onChangeIdentity={handleChangeIdentity}
          onClose={() => setRegisterOpen(false)}
        />
      ) : null}

      {me ? null : (
        <TitleScreen
          players={players}
          freeCharacters={freeCharacters}
          onPick={handlePick}
          onCreate={handleCreate}
        />
      )}
    </main>
  );
}
