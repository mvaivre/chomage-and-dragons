"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chestXForStep } from "@/components/game/projection";
import type { Effect, EffectKind } from "@/components/game/Effects";
import GameCanvas from "@/components/game/GameCanvas";
import { heroOrigin } from "@/components/game/lanes";
import type { HeroMotion } from "@/components/game/animation";
import { CHARACTERS } from "@/lib/game/characters";
import { ActionBar } from "@/components/hud/ActionBar";
import {
  ActionReward,
  type RewardMoment,
} from "@/components/hud/ActionReward";
import {
  CompactLeaderboard,
  LeaderboardOverlay,
  OverviewLeaderboard,
} from "@/components/hud/Leaderboard";
import { QuestHud } from "@/components/hud/QuestHud";
import { PowerDeck } from "@/components/hud/PowerDeck";
import { ShotInbox } from "@/components/hud/ShotInbox";
import { TitleScreen } from "@/components/hud/TitleScreen";
import { PowerArtwork } from "@/components/hud/Artwork";
import { useGame } from "@/hooks/useGame";
import { clearSession, loadSession, saveSession } from "@/lib/data/session";
import type { ActionKind, PowerCast, PowerKind } from "@/lib/data/types";
import {
  POWERS,
  powerForSlot,
  type AvailablePower,
} from "@/lib/game/powers";
import { stepsFor } from "@/lib/game/scoring";
import { ACTION_LABELS_ONE } from "@/lib/game/standings";
import { JOURNEY_TARGET, POINTS, STEPS_PER_LEVEL } from "@/lib/config";
import { hiredPosition, racePosition } from "@/lib/game/progress";
import {
  BIOMES,
  biomeAt,
  surfaceAt,
  worldXFor,
  WORLD_LENGTH,
} from "@/lib/game/world";

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

const POWER_EFFECT_FOR: Record<PowerKind, EffectKind> = {
  shot: "cocktail",
  feuSacré: "fireCurse",
  fienteDragon: "dragonDrop",
  paperasse: "paperStorm",
  crapaud: "frogCurse",
};

const DEV_BUILD = process.env.NODE_ENV === "development";
const DEV_VIEWPOINTS = BIOMES.slice(0, -1).map((biome, index) => ({
  id: `${biome.id}-${BIOMES[index + 1].id}`,
  label: `${biome.short}→${BIOMES[index + 1].short}`,
  progress: biome.to,
}));

interface Notice {
  title: string;
  body: string;
  powerKind?: PowerKind;
}

export function Game() {
  const {
    players,
    events,
    casts,
    monthKeyNow,
    seasonStandings,
    monthStandings,
    totals,
    crowns,
    freeCharacters,
    addEvent,
    castPower,
    markCastSeen,
    settleShots,
    undoLast,
    addPlayer,
    removePlayer,
  } = useGame();

  const [meId, setMeId] = useState<string | null>(loadSession);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [rewardMoments, setRewardMoments] = useState<RewardMoment[]>([]);
  const [powerAttention, setPowerAttention] = useState(0);
  const [shotInbox, setShotInbox] = useState<PowerCast[] | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; text: string; kind?: ActionKind } | null>(null);
  const actionInFlight = useRef(false);
  const [awaitingTravel, setAwaitingTravel] = useState(false);
  const [effectFocusId, setEffectFocusId] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const [devExplore, setDevExplore] = useState(false);
  const [devEffect, setDevEffect] = useState<EffectKind>("pigeon");
  const [devHero, setDevHero] = useState<{ characterId: string; motion: HeroMotion }>({ characterId: "voleur", motion: "idle" });
  const [devCameraTarget, setDevCameraTarget] = useState<{
    worldX: number;
    revision: number;
  } | null>(null);
  const shownCasts = useRef(new Set<string>());
  const pendingChestEffect = useRef<Effect | null>(null);
  const chestAnimationId = useRef<string | null>(null);
  const focusTimeout = useRef<number | null>(null);

  const meIndex = players.findIndex((p) => p.id === meId);
  const me = meIndex === -1 ? null : players[meIndex];

  // Une session qui désigne quelqu'un de retiré de la partie ne vaut rien : on
  // repart de l'écran de titre, et le prochain choix écrasera la valeur périmée.
  const identity = me ? meId : null;
  const queuedRewardMoment = rewardMoments[0] ?? null;
  const rewardMoment = awaitingTravel ? null : queuedRewardMoment;
  const handleRewardDone = useCallback(() => {
    if (rewardMoments[0]?.type === "chest") setPowerAttention(value => value + 1);
    setRewardMoments(moments => moments.slice(1));
    actionInFlight.current = false;
  }, [rewardMoments]);

  useEffect(() => {
    if (!actionFeedback) return;
    const timeout = window.setTimeout(() => setActionFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [actionFeedback]);

  const handleTravelDone = useCallback(
    (playerId: string) => {
      if (playerId !== identity) return;
      const chestEffect = pendingChestEffect.current;
      if (chestEffect) {
        pendingChestEffect.current = null;
        chestAnimationId.current = chestEffect.id;
        setEffects((previous) => [...previous, chestEffect]);
        return;
      }
      setAwaitingTravel(false);
      actionInFlight.current = false;
    },
    [identity],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (shotInbox) {
          setShotInbox(null);
          return;
        }
        if (rewardMoment) {
          handleRewardDone();
          return;
        }
        if (registerOpen) {
          setRegisterOpen(false);
          return;
        }
        if (overview) {
          setOverview(false);
          return;
        }
        if (awaitingTravel) return;
        if (notice) {
          setNotice(null);
          return;
        }
        setRegisterOpen((open) => !open);
      } else if (event.key.toLowerCase() === "v" && !event.metaKey && !event.ctrlKey && !event.altKey &&
        !(event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)))) {
        event.preventDefault();
        setOverview((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [awaitingTravel, handleRewardDone, notice, overview, registerOpen, rewardMoment, shotInbox]);

  useEffect(
    () => () => {
      if (focusTimeout.current !== null) window.clearTimeout(focusTimeout.current);
    },
    [],
  );

  // Les butins reçus restent en attente dans la sauvegarde jusqu'à ce que leur
  // cible ouvre sa session. Les shots demandent une confirmation explicite ; les
  // farces visuelles, elles, sont acquittées après leur première animation.
  useEffect(() => {
    if (!me) return;

    const pending = casts.filter(
      (cast) => cast.targetPlayerId === me.id && !cast.seenAt,
    );
    if (pending.length === 0) return;

    const origin = heroOrigin(me, meIndex);
    const fresh = pending.filter((cast) => !shownCasts.current.has(cast.id));
    if (fresh.length === 0) return;

    for (const cast of fresh) {
      shownCasts.current.add(cast.id);
    }

    // Différé d'une frame : l'ouverture de session termine son rendu avant que la
    // file d'animations et la persistance des accusés de réception ne soient modifiées.
    const timeout = window.setTimeout(() => {
      const shots = fresh.filter((cast) => cast.kind === "shot");
      const pranks = fresh.filter((cast) => cast.kind !== "shot");

      setEffects((previous) => [
        ...previous,
        ...fresh.map((cast) => ({
          id: cast.id,
          kind: POWER_EFFECT_FOR[cast.kind],
          origin,
        })),
      ]);
      for (const cast of pranks) markCastSeen(cast.id);

      if (shots.length > 0) {
        setShotInbox((current) => [...(current ?? []), ...shots]);
      }

      const latestPrank = pranks[pranks.length - 1];
      if (latestPrank) {
        const attacker = players.find(
          (player) => player.id === latestPrank.playerId,
        );
        setNotice({
          title: POWERS[latestPrank.kind].name,
          body: `${attacker?.name ?? "Une âme lâche"} t’a lancé cette farce pendant ton absence.`,
          powerKind: latestPrank.kind,
        });
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [casts, me, meIndex, players, markCastSeen]);

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
      if (!me || me.hiredAt || actionInFlight.current || rewardMoments.length > 0) return;
      actionInFlight.current = true;
      setAwaitingTravel(true);
      setOverview(false);

      const event = addEvent(me.id, kind);
      const origin = heroOrigin(me, meIndex);

      const queued: Effect[] = [
        { id: event.id, kind: EFFECT_FOR[kind], origin },
      ];
      pendingChestEffect.current = null;

      const beforeChest = me.earnedChests;
      const afterSteps = Math.max(0, me.journeySteps + stepsFor(kind));
      const afterChest = Math.max(beforeChest, Math.floor(afterSteps / STEPS_PER_LEVEL));
      const beforeZone = biomeAt(worldXFor(me.position));
      const afterPosition = kind === "embauche" ? hiredPosition(afterSteps) : racePosition(afterSteps);
      const afterZone = biomeAt(worldXFor(afterPosition));

      const moments: RewardMoment[] = kind === "embauche" ? [
        {
          id: event.id,
          type: "action",
          kind,
          steps: stepsFor(kind),
          points: POINTS[kind],
          progress:
            kind === "embauche" ? 1 : (afterSteps > 0 ? ((afterSteps - 1) % JOURNEY_TARGET + 1) / JOURNEY_TARGET : 0),
          place: afterZone.name,
          discoveredPlace: beforeZone.id !== afterZone.id,
        },
      ] : [];

      if (afterChest > beforeChest) {
        const markerX = chestXForStep(afterChest * STEPS_PER_LEVEL, WORLD_LENGTH, JOURNEY_TARGET);
        pendingChestEffect.current = {
          id: `${event.id}-chest`,
          kind: "chest",
          origin: { x: markerX, y: surfaceAt(markerX) + 8 },
        };
        const unlocked = powerForSlot(afterChest - 1);
        moments.push({
          id: `${event.id}-chest-reward`,
          type: "chest",
          powerKind: unlocked,
        });
      }

      setEffects(previous => [...previous, ...queued]);
      const steps = stepsFor(kind);
      setActionFeedback({ id: event.id, kind, text: kind === "embauche" ? "En route pour la taverne !" : `${ACTION_LABELS_ONE[kind]} · ${steps > 0 ? "+" : ""}${steps} pas${beforeZone.id !== afterZone.id ? ` · ${afterZone.short}` : ""}` });
      setRewardMoments(moments);
    },
    [addEvent, me, meIndex, rewardMoments.length],
  );

  const handleCast = useCallback(
    (power: AvailablePower, targetId: string) => {
      if (!me) return;
      setOverview(false);
      const targetIndex = players.findIndex((player) => player.id === targetId);
      const target = players[targetIndex];
      if (!target) return;

      const cast = castPower(me.id, targetId, power.kind, power.slot);
      if (focusTimeout.current !== null) window.clearTimeout(focusTimeout.current);
      setEffectFocusId(targetId);
      focusTimeout.current = window.setTimeout(() => {
        setEffectFocusId(null);
        focusTimeout.current = null;
      }, 3600);
      setEffects((previous) => [
        ...previous,
        {
          id: `${cast.id}-preview`,
          kind: POWER_EFFECT_FOR[power.kind],
          origin: heroOrigin(target, targetIndex),
        },
      ]);
      setNotice({
        title:
          power.kind === "shot"
            ? `Shot envoyé à ${target.name}`
            : `Farce lancée sur ${target.name}`,
        body:
          power.kind === "shot"
            ? "Sa dette apparaît dans le classement et à sa prochaine ouverture."
            : "Tu vois l’effet maintenant ; la victime le reverra à sa prochaine ouverture.",
        powerKind: power.kind,
      });
    },
    [castPower, me, players],
  );

  const handleUndo = useCallback(() => {
    if (!me || actionInFlight.current || rewardMoments.length > 0) return;
    actionInFlight.current = true;
    setAwaitingTravel(true);
    setEffects([]);
    setActionFeedback({ id: crypto.randomUUID(), text: "Dernière action annulée" });
    undoLast(me.id);
  }, [me, undoLast, rewardMoments.length]);

  const handleEffectDone = useCallback((id: string) => {
    setEffects((prev) => prev.filter((effect) => effect.id !== id));
    if (chestAnimationId.current === id) {
      chestAnimationId.current = null;
      setAwaitingTravel(false);
      actionInFlight.current = false;
    }
  }, []);

  const handleDevExplore = useCallback(() => {
    setDevExplore((active) => !active);
  }, []);

  const handleDevBiome = useCallback((from: number, to: number) => {
    setDevExplore(true);
    setDevCameraTarget((current) => ({
      worldX: ((from + to) * 0.5) * WORLD_LENGTH,
      revision: (current?.revision ?? 0) + 1,
    }));
  }, []);

  const resetPresentation = useCallback(() => {
    actionInFlight.current = false;
    pendingChestEffect.current = null;
    chestAnimationId.current = null;
    setAwaitingTravel(false);
    setRewardMoments([]);
    setEffects([]);
    setActionFeedback(null);
    setOverview(false);
    setEffectFocusId(null);
  }, []);

  const handlePick = useCallback((playerId: string) => {
    resetPresentation();
    shownCasts.current.clear();
    setShotInbox(null);
    setSceneReady(false);
    saveSession(playerId);
    setMeId(playerId);
  }, [resetPresentation]);

  const handleCreate = useCallback(
    (name: string, characterId: string) => {
      resetPresentation();
      const id = addPlayer(name, characterId);
      shownCasts.current.clear();
      setShotInbox(null);
      setSceneReady(false);
      saveSession(id);
      setMeId(id);
    },
    [addPlayer, resetPresentation],
  );

  const handleChangeIdentity = useCallback(() => {
    resetPresentation();
    shownCasts.current.clear();
    setShotInbox(null);
    clearSession();
    setMeId(null);
    setRegisterOpen(false);
  }, [resetPresentation]);

  const canUndo = Boolean(
    me && events.some((event) => event.playerId === me.id),
  );
  return (
    <main className="relative h-full w-full overflow-hidden bg-ink-deep">
      <GameCanvas
        onSceneReady={handleSceneReady}
        paused={overview || registerOpen || Boolean(rewardMoment) || Boolean(shotInbox)}
        actionDockVisible={Boolean(me && !overview)}
        devHero={devHero}
        pendingChestStep={me && rewardMoments.some(moment => moment.type === "chest") ? Math.floor(me.journeySteps / STEPS_PER_LEVEL) * STEPS_PER_LEVEL : null}
        players={players}
        meId={identity}
        focusPlayerId={effectFocusId}
        effects={effects}
        onEffectDone={handleEffectDone}
        onTravelDone={handleTravelDone}
        freeCamera={DEV_BUILD && devExplore}
        devCameraTarget={devCameraTarget}
      />

      <div className="vignette absolute inset-0 z-[3]" />
      <div className="world-glaze pointer-events-none absolute inset-0 z-[3]" />

      {DEV_BUILD && !overview ? (
        <aside className="dev-explorer" data-open={devExplore}>
          <button
            type="button"
            className="dev-explorer__toggle"
            aria-pressed={devExplore}
            onClick={handleDevExplore}
          >
            <span>DEV</span>
            {devExplore ? "Caméra libre" : "Explorer le monde"}
          </button>
          {devExplore ? (
            <nav className="dev-explorer__biomes" aria-label="Biomes de test">
              <output id="scene-stats" className="dev-explorer__stats" aria-label="Performances de la scène" />
              <select aria-label="Personnage de test" value={devHero.characterId} onChange={event => setDevHero(value => ({ ...value, characterId: event.target.value }))}>
                {CHARACTERS.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
              </select>
              <select aria-label="Animation de test" value={devHero.motion} onChange={event => setDevHero(value => ({ ...value, motion: event.target.value as HeroMotion }))}>
                <option value="idle">Repos</option><option value="walk">Marche</option><option value="send">Lettre</option><option value="hurt">Réaction</option><option value="celebrate">Victoire</option>
              </select>
              <select aria-label="Effet de test" value={devEffect} onChange={event => setDevEffect(event.target.value as EffectKind)}>
                {Object.entries({ pigeon: "Candidature", lightning: "Refus", cocktail: "Entretien", legendary: "Rejet", trophy: "Embauche", chest: "Coffre", fireCurse: "Feu", dragonDrop: "Dragon", paperStorm: "Paperasse", frogCurse: "Crapaud" }).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <button type="button" onClick={() => {
                const at = devCameraTarget?.worldX ?? (me ? worldXFor(me.position) : 0);
                const x = devEffect === "chest" ? at + 110 : at;
                setEffects(previous => [...previous, { id: `preview-${Date.now()}`, kind: devEffect, origin: { x, y: surfaceAt(x) + (devEffect === "chest" ? 8 : 48) } }]);
              }}>Tester l’effet</button>
              {BIOMES.map((biome) => (
                <button
                  key={biome.id}
                  type="button"
                  onClick={() => handleDevBiome(biome.from, biome.to)}
                >
                  {biome.short}
                </button>
              ))}
              {DEV_VIEWPOINTS.map((viewpoint) => (
                <button
                  key={viewpoint.id}
                  type="button"
                  onClick={() =>
                    handleDevBiome(viewpoint.progress, viewpoint.progress)
                  }
                >
                  {viewpoint.label}
                </button>
              ))}
            </nav>
          ) : null}
        </aside>
      ) : null}

      {me && overview ? (
        <CompanyMap
          onClose={() => setOverview(false)}
          players={players}
          meId={identity}
          monthStandings={monthStandings}
          monthKeyNow={monthKeyNow}
          onOpenLeaderboard={() => setRegisterOpen(true)}
        />
      ) : null}

      {me ? (
        <div hidden={overview} className="hud-layer pointer-events-none absolute inset-0 z-10">
          <header className="hud-top">
            <div className="hud-journey">
              <QuestHud me={me} seasonRank={seasonRank} />
              <div className="hud-controls">
                <PowerDeck
                  me={me}
                  players={players}
                  attentionToken={powerAttention}
                  onCast={handleCast}
                />
                <button
                  type="button"
                  className="company-camera pointer-events-auto"
                  aria-pressed={overview}
                  onClick={() => setOverview((value) => !value)}
                >
                  <span aria-hidden>◉</span>
                  <span>Carte</span>
                  <kbd>V</kbd>
                </button>
              </div>
            </div>
            {!overview ? (
              <CompactLeaderboard
                players={players}
                monthStandings={monthStandings}
                monthKeyNow={monthKeyNow}
                meId={identity}
                onOpen={() => setRegisterOpen(true)}
              />
            ) : null}
          </header>

          {!overview ? (
            <div className="hud-bottom">
              <ActionBar
                onAction={handleAction}
                onUndo={handleUndo}
                canUndo={canUndo}
                hired={Boolean(me.hiredAt)}
                locked={
                  registerOpen ||
                  !sceneReady ||
                  rewardMoments.length > 0 ||
                  awaitingTravel ||
                  shotInbox !== null
                }
                lastActionLabel={lastActionLabel}
                feedback={!sceneReady ? "Préparation du voyage…" : actionFeedback?.text ?? null}
                feedbackKind={actionFeedback?.kind}
              />
            </div>
          ) : null}
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

      {rewardMoment ? (
        <ActionReward
          key={rewardMoment.id}
          moment={rewardMoment}
          onDone={handleRewardDone}
        />
      ) : null}

      {shotInbox ? (
        <ShotInbox
          casts={shotInbox}
          players={players}
          onLater={() => setShotInbox(null)}
          onSettle={() => {
            settleShots(shotInbox.map((cast) => cast.id));
            setShotInbox(null);
          }}
        />
      ) : null}

      {notice ? (
        <div className="toast-notice rise absolute left-1/2 z-[25] w-[min(92vw,38rem)] -translate-x-1/2">
          <div className="hud-panel toast-notice__panel">
            {notice.powerKind ? (
              <PowerArtwork kind={notice.powerKind} className="toast-notice__art" />
            ) : null}
            <div>
              <p className="font-display text-2xl text-gold-light">{notice.title}</p>
              <p className="mt-1 text-base text-parchment/75">{notice.body}</p>
            </div>
            <button type="button" onClick={() => setNotice(null)}>
              J’ai compris
            </button>
          </div>
        </div>
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

function mapRouteY(progress: number): number {
  const points = [67, 70, 69, 66, 60, 64, 68];
  const scaled = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const t = scaled - index;
  return points[index] + (points[index + 1] - points[index]) * t;
}

interface CompanyMapProps {
  onClose: () => void;
  players: ReturnType<typeof useGame>["players"];
  meId: string | null;
  monthStandings: ReturnType<typeof useGame>["monthStandings"];
  monthKeyNow: string;
  onOpenLeaderboard: () => void;
}

/** Carte d'interface : elle se fond sur le jeu sans toucher à la caméra Pixi. */
function CompanyMap({
  onClose,
  players,
  meId,
  monthStandings,
  monthKeyNow,
  onOpenLeaderboard,
}: CompanyMapProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    return () => {
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".company-camera")?.focus());
    };
  }, []);
  return (
    <section className="company-map-view is-open absolute inset-0 z-20" role="dialog" aria-modal="true" aria-labelledby="company-map-title">
      <header className="company-map-view__header">
        <h2 id="company-map-title">La compagnie</h2>
        <button ref={closeButton} type="button" className="company-map-view__close" aria-label="Fermer la carte" title="Fermer la carte (Échap)" onClick={onClose}>×</button>
      </header>
      <div className="company-map-view__scroll">
        <div className="company-map-view__content">
          <div className="company-map-view__map">
            <div
              className="company-map-view__painting"
              role="img"
              aria-label="Carte médiévale du voyage de la compagnie"
            />
            <div className="company-map-view__pins" aria-label="Position des joueurs">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`company-map-pin ${player.id === meId ? "is-me" : ""}`}
                  style={{
                    left: `${16 + (player.position % 1 || (player.position > 0 ? 1 : 0)) * 68 + ((index % 3) - 1) * 1.25}%`,
                    top: `${mapRouteY(player.position % 1 || (player.position > 0 ? 1 : 0)) + ((index % 3) - 1) * 3.2}%`,
                    zIndex: player.id === meId ? 20 : index + 1,
                  }}
                >
                  <span>{player.name.slice(0, 1).toUpperCase()}</span>
                  <strong>{player.name} · {player.journeySteps} pas<small>Voyage {Math.max(1, Math.ceil(player.position))}</small></strong>
                </div>
              ))}
            </div>
          </div>
          <OverviewLeaderboard
            players={players}
            monthStandings={monthStandings}
            monthKeyNow={monthKeyNow}
            meId={meId}
            onOpen={onOpenLeaderboard}
          />
        </div>
      </div>
    </section>
  );
}
