"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chestXForStep } from "@/components/game/projection";
import type { Effect, EffectKind } from "@/components/game/Effects";
import GameCanvas from "@/components/game/GameCanvas";
import { heroOrigin } from "@/components/game/lanes";
import type { HeroMotion } from "@/components/game/animation";
import { CHARACTERS } from "@/lib/game/characters";
import { ActionBar } from "@/components/hud/ActionBar";
import dynamic from "next/dynamic";
import { retainTextures } from "@/components/game/textures";
import { CHARACTER_ANIMATIONS } from "@/components/game/animation";
import { decodedImage, whenIdle } from "@/lib/client/preload";
import { ACTION_ART, MINI_GAME_IMAGES, POWER_ART } from "@/lib/game/art";

/** Mini-games load on their own, fetched ahead of need once the world is up. */
const loadMiniGames = () => import("@/components/hud/mini-games/MiniGame");
const MiniGame = dynamic(() => loadMiniGames().then((m) => m.MiniGame), { ssr: false });
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
import { ClaimDialog, TitleScreen } from "@/components/hud/TitleScreen";
import { MiniGameInvite } from "@/components/hud/MiniGameInvite";
import { moment, MomentOverlay } from "@/components/hud/Moment";
import { SoundToggle } from "@/components/hud/SoundToggle";
import { DaylightVeil } from "@/components/hud/DaylightVeil";
import { Chronicle } from "@/components/hud/Chronicle";
import { DailyChallenge } from "@/components/hud/DailyChallenge";
import { Album } from "@/components/hud/Album";
import { dailyChallenge, dailyRanking, zurichDay } from "@/lib/game/daily";
import { AwayRecap, NewsToast, type NewsItem } from "@/components/hud/News";
import { loadSeen, saveSeen } from "@/lib/client/seen";
import type { CheerEmoji, Cheer, GameEvent } from "@/lib/data/types";
import type { HudTiming } from "@/components/hud/QuestHud";
import { reactionTiming } from "@/components/game/Effects";
import { CHOREOGRAPHIES } from "@/components/game/reactions";
import { REACTION_HOLD } from "@/components/game/Hero";
import { fx } from "@/components/game/fx";
import { leanIn, leanOut, scene, worldToScreen } from "@/components/game/scene";
import { sfx, warmUpAudio } from "@/lib/client/sound";
import { VARIANTS, variantFor } from "@/lib/game/variants";
import { groupRecord, personalBest } from "@/lib/game/scores";
import { TALES, taleFor, TALE_LABELS } from "@/lib/game/tales";
import { weeklyStreak } from "@/lib/game/streak";
import { PowerArtwork } from "@/components/hud/Artwork";
import { useGame, type GameMode } from "@/hooks/useGame";
import { RemoteStore } from "@/lib/data/remote-store";
import Link from "next/link";
import { clearSession, loadSession, saveSession } from "@/lib/data/session";
import type { ActionKind, MiniGameKind, MiniGameResult, PowerCast, PowerKind } from "@/lib/data/types";
import {
  POWERS,
  powerForSlot,
  type AvailablePower,
} from "@/lib/game/powers";
import { stepsFor, stepsForEvent } from "@/lib/game/scoring";
import { MINI_GAMES, miniGameBonus } from "@/lib/game/mini-games";
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

/** Diagnostics only: `?debug&variant=storm` forces a staging, to review each one. */
function forcedVariant(kind: ActionKind) {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.has("debug") ? params.get("variant") : null;
  return id ? VARIANTS[kind].find((variant) => variant.id === id) ?? null : null;
}

/** Diagnostics only: `?debug&tale=boss` tells a tale of that kind after the next action. */
function forcedTale() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const kind = params.has("debug") ? params.get("tale") : null;
  return kind ? TALES.find((tale) => tale.kind === kind) ?? null : null;
}

/** Every staging the scene knows, to guard against a variant without a choreography. */
const REACTION_KINDS = CHOREOGRAPHIES;

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

interface MiniGameOffer {
  attemptId: string;
  eventId: string;
  kind: MiniGameKind;
  action: ActionKind | "chest";
  /** The player chose to play: the invitation card gives way to the game. */
  accepted?: boolean;
  resolved?: boolean;
}

/** The light that fills the screen at the instant of impact. */
const FLASH: Record<ActionKind, { color: string; strength: number }> = {
  candidature: { color: "#fff6dc", strength: 0.22 },
  refus: { color: "#d8ecff", strength: 0.75 },
  entretien: { color: "#ffe7a8", strength: 0.35 },
  rejetApresEntretien: { color: "#ffd76c", strength: 0.85 },
  embauche: { color: "#fff1bd", strength: 0.6 },
};

interface Notice {
  title: string;
  body: string;
  powerKind?: PowerKind;
}

export function Game({ slug = null }: { slug?: string | null }) {
  // A group's game lives on the server; without a slug this device plays alone.
  const store = useMemo(() => (slug ? new RemoteStore(slug) : null), [slug]);
  const mode = useMemo<GameMode>(() => (store ? { kind: "remote", store } : { kind: "local" }), [store]);
  const scope = slug ?? "local";
  const {
    loaded,
    groupName,
    remoteMe,
    syncError,
    clearSyncError,
    claim,
    players,
    events,
    casts,
    cheers,
    cheer,
    miniGames,
    daily,
    recordDaily,
    startDaily,
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
  } = useGame(mode);

  const [meId, setMeId] = useState<string | null>(() => loadSession(scope));
  const [claiming, setClaiming] = useState<string | null>(null);
  // This component never renders on the server, so the origin is known at once.
  const inviteUrl = useMemo(() => (slug ? `${window.location.origin}/g/${slug}/rejoindre` : null), [slug]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [rewardMoments, setRewardMoments] = useState<RewardMoment[]>([]);
  const [miniGameOffer, setMiniGameOffer] = useState<MiniGameOffer | null>(null);
  const pendingChestGame = useRef<{ attemptId: string; eventId: string } | null>(null);
  const [devMiniGame, setDevMiniGame] = useState<{ kind: MiniGameKind; seed: string } | null>(null);
  const [powerAttention, setPowerAttention] = useState(0);
  const [shotInbox, setShotInbox] = useState<PowerCast[] | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; text: string; kind?: ActionKind } | null>(null);
  /** An action's moment is playing: the camera leans in and the HUD steps back. */
  const [momentActive, setMomentActive] = useState(false);
  const [hudTiming, setHudTiming] = useState<HudTiming | null>(null);
  const momentTimers = useRef<number[]>([]);
  const pendingBanner = useRef<{ kicker: string; title: string } | null>(null);
  const pendingTale = useRef<ReturnType<typeof taleFor>>(null);
  const lastAction = useRef<ActionKind | null>(null);
  const schedule = useCallback((ms: number, run: () => void) => {
    const timer = window.setTimeout(() => {
      momentTimers.current = momentTimers.current.filter((id) => id !== timer);
      run();
    }, ms);
    momentTimers.current.push(timer);
  }, []);
  useEffect(() => () => { momentTimers.current.forEach((timer) => window.clearTimeout(timer)); }, []);
  const actionInFlight = useRef(false);
  const [awaitingTravel, setAwaitingTravel] = useState(false);
  // A safety net: whatever happens to the walk, the action bar never stays locked.
  useEffect(() => {
    if (!awaitingTravel) return;
    const timer = window.setTimeout(() => {
      setAwaitingTravel(false);
      actionInFlight.current = false;
      leanOut();
      setMomentActive(false);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [awaitingTravel]);
  const [effectFocusId, setEffectFocusId] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  useEffect(() => warmUpAudio(), []);

  // Once the world is up, warm what the next action will need: its reaction art,
  // the loot art, the mini-games' code and images. Actions are rare, so otherwise
  // every one of them would be a cold first display.
  useEffect(() => {
    if (!sceneReady) return;
    return whenIdle(() => {
      retainTextures([...Object.values(ACTION_ART), ...Object.values(POWER_ART)]);
      for (const url of MINI_GAME_IMAGES) void decodedImage(url).catch(() => {});
      void loadMiniGames();
    });
  }, [sceneReady]);
  const [devExplore, setDevExplore] = useState(false);
  const [devEffect, setDevEffect] = useState<EffectKind>("pigeon");
  const [devHero, setDevHero] = useState<{ characterId: string; motion: HeroMotion }>({ characterId: "voleur", motion: "idle" });
  const [devCameraTarget, setDevCameraTarget] = useState<{
    worldX: number;
    revision: number;
  } | null>(null);
  const shownCasts = useRef(new Set<string>());
  // The group's life: a chronicle, live news of friends, and a recap after an absence.
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [recap, setRecap] = useState<{ events: GameEvent[]; cheers: Cheer[] } | null>(null);
  // Today's challenge: the same game and course for everyone in the group.
  const today = zurichDay();
  const todayGame = useMemo(() => dailyChallenge(today), [today]);
  const [dailyOpen, setDailyOpen] = useState(false);
  const seenRef = useRef<{ events: Set<string>; cheers: Set<string> } | null>(null);
  const pendingChestEffect = useRef<Effect | null>(null);
  const chestAnimationId = useRef<string | null>(null);
  const focusTimeout = useRef<number | null>(null);

  // The server's word on who this device plays wins: a character claimed elsewhere drops out here.
  const identityRevoked = Boolean(store && loaded && meId && remoteMe !== meId);
  const sessionLost = syncError?.status === 401;
  const shownNotice: Notice | null = notice ?? (syncError && !sessionLost
    ? { title: syncError.status === 403 ? "Appareil non reconnu" : syncError.status === 0 ? "Hors ligne" : "Synchronisation", body: syncError.message }
    : null);
  const meIndex = identityRevoked ? -1 : players.findIndex((p) => p.id === meId);
  const me = meIndex === -1 ? null : players[meIndex];
  // Your own hero gates the action bar: request its atlas before the scenery.
  const myAtlas = me ? CHARACTER_ANIMATIONS[me.characterId]?.url : undefined;
  useEffect(() => { if (myAtlas) retainTextures([myAtlas]); }, [myAtlas]);

  // Une session qui désigne quelqu'un de retiré de la partie ne vaut rien : on
  // repart de l'écran de titre, et le prochain choix écrasera la valeur périmée.
  const identity = me ? meId : null;
  const queuedRewardMoment = rewardMoments[0] ?? null;
  const rewardMoment = awaitingTravel ? null : queuedRewardMoment;
  const miniGameReady = Boolean(miniGameOffer && (miniGameOffer.resolved ||
    (!awaitingTravel && rewardMoments.length === 0 && !shotInbox && !overview && !registerOpen && !chronicleOpen && !dailyOpen && !recap)));
  // First an invitation card, then the game itself once the player accepts.
  const inviteVisible = Boolean(!devMiniGame && miniGameReady && miniGameOffer && !miniGameOffer.accepted && !miniGameOffer.resolved);
  const miniGameVisible = Boolean(devMiniGame) || (miniGameReady && !inviteVisible);
  const handleRewardDone = useCallback(() => {
    if (rewardMoments[0]?.type === "chest") {
      setPowerAttention(value => value + 1);
      // The chest's double bottom opens once the loot is put away and no other game waits.
      if (!miniGameOffer && pendingChestGame.current) {
        setMiniGameOffer({ ...pendingChestGame.current, kind: "slots", action: "chest" });
        pendingChestGame.current = null;
      }
    }
    setRewardMoments(moments => moments.slice(1));
    actionInFlight.current = false;
  }, [rewardMoments, miniGameOffer]);

  useEffect(() => {
    if (!actionFeedback) return;
    const timeout = window.setTimeout(() => setActionFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [actionFeedback]);

  const handleTravelDone = useCallback(
    (playerId: string) => {
      if (playerId !== identity) return;
      // The hero has arrived: the camera steps back, the HUD returns, a new land is announced.
      schedule(350, () => { leanOut(); setMomentActive(false); });
      const banner = pendingBanner.current;
      if (banner) { pendingBanner.current = null; moment.cue({ type: "banner", ...banner }); }
      const tale = pendingTale.current;
      if (tale) {
        pendingTale.current = null;
        schedule(banner ? 2600 : 500, () => moment.cue({ type: "tale", kind: tale.kind, label: TALE_LABELS[tale.kind], title: tale.title, text: tale.text }));
      }
      if (lastAction.current === "embauche") {
        lastAction.current = null;
        const hero = scene.heroes.get(playerId);
        if (hero) {
          [[-180, -250, 0, 0xffd76c], [160, -280, 0.35, 0x9fd4ff], [0, -320, 0.7, 0xff9a8a], [-60, -230, 1.05, 0xb8e08a]].forEach(([dx, dy, delay, color]) => {
            fx.burst({ preset: "firework", x: hero.x + dx, y: hero.y + dy, count: 50, colors: [color, 0xffffff], delay });
            schedule(delay * 1000, sfx.firework);
          });
          fx.burst({ preset: "confetti", x: hero.x, y: hero.y - 180, count: 90 });
        }
        // Let the fireworks play before the reward card covers the world.
        schedule(2300, () => { setAwaitingTravel(false); actionInFlight.current = false; });
        return;
      }
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
    [identity, schedule],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // The native mini-game dialog owns Escape, Space, Enter and focus; the invitation owns Escape.
      if (miniGameVisible || inviteVisible) return;
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
  }, [awaitingTravel, handleRewardDone, notice, overview, registerOpen, rewardMoment, shotInbox, miniGameVisible, inviteVisible]);

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
          playerId: me.id,
          loud: true,
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

  // News of the others. The first look after arriving is compared with what this
  // device saw last time: the difference is a recap. Afterwards, anything new is live.
  useEffect(() => {
    if (!me || !loaded) return;
    const others = events.filter((e) => e.playerId !== me.id);
    const received = cheers.filter((c) => events.some((e) => e.id === c.eventId && e.playerId === me.id) && c.playerId !== me.id);
    if (!seenRef.current) {
      const stored = loadSeen(`${scope}:${me.id}`);
      const older = (at: string) => Boolean(stored?.before) && at < stored!.before;
      const seenEvents = new Set(stored ? [...stored.events, ...others.filter((e) => older(e.at)).map((e) => e.id)] : others.map((e) => e.id));
      const seenCheers = new Set(stored ? [...stored.cheers, ...received.filter((c) => older(c.at)).map((c) => c.id)] : received.map((c) => c.id));
      seenRef.current = { events: seenEvents, cheers: seenCheers };
      const missedEvents = others.filter((e) => !seenEvents.has(e.id));
      const missedCheers = received.filter((c) => !seenCheers.has(c.id));
      // Shown after this commit: the effect only reads what this device remembers.
      if (stored && (missedEvents.length || missedCheers.length)) queueMicrotask(() => setRecap({ events: missedEvents, cheers: missedCheers }));
    } else {
      const fresh: NewsItem[] = [
        ...others.filter((e) => !seenRef.current!.events.has(e.id)).map((event) => ({ id: event.id, kind: "event" as const, event })),
        ...received.filter((c) => !seenRef.current!.cheers.has(c.id)).map((c) => ({ id: c.id, kind: "cheer" as const, cheer: c })),
      ];
      if (fresh.length) {
        queueMicrotask(() => setNews((items) => [...items, ...fresh].slice(-3)));
        const liveEvent = fresh.find((item) => item.kind === "event")?.event;
        if (liveEvent) {
          // A friend's action plays in the world too, quietly, on their own hero.
          const index = players.findIndex((p) => p.id === liveEvent.playerId);
          const player = players[index];
          if (player) {
            const variant = variantFor(liveEvent.id, liveEvent.kind);
            const kind = (variant.id in REACTION_KINDS ? variant.id : EFFECT_FOR[liveEvent.kind]) as EffectKind;
            const effect = { id: `news-${liveEvent.id}`, kind, origin: heroOrigin(player, index), playerId: player.id, loud: false };
            queueMicrotask(() => {
              setEffects((previous) => [...previous, effect]);
              // A glance at the friend who acted, unless you are busy with your own moment.
              if (actionInFlight.current) return;
              if (focusTimeout.current !== null) window.clearTimeout(focusTimeout.current);
              setEffectFocusId(player.id);
              focusTimeout.current = window.setTimeout(() => { setEffectFocusId(null); focusTimeout.current = null; }, 3400);
            });
          }
          sfx.chime();
        } else sfx.coin();
      }
    }
    for (const e of others) seenRef.current.events.add(e.id);
    for (const c of received) seenRef.current.cheers.add(c.id);
    saveSeen(`${scope}:${me.id}`, { events: others, cheers: received });
  }, [events, cheers, me, loaded, scope, players]);

  useEffect(() => {
    if (!news.length) return;
    const timer = window.setTimeout(() => setNews((items) => items.slice(1)), 5200);
    return () => window.clearTimeout(timer);
  }, [news]);

  /** The group's record for a game, named, to show what to beat. */
  const recordFor = useCallback((kind: MiniGameKind) => {
    const best = groupRecord(miniGames, kind);
    if (!best || best.score === undefined) return null;
    return { score: best.score, holder: players.find((p) => p.id === best.playerId)?.name ?? "?" };
  }, [miniGames, players]);

  const handleCheer = useCallback((eventId: string, emoji: CheerEmoji) => {
    if (!me) return;
    cheer(me.id, eventId, emoji);
    sfx.press();
  }, [me, cheer]);

  const streak = useMemo(() => (me ? weeklyStreak(events.filter((e) => e.playerId === me.id)) : 0), [events, me]);

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
      if (!me || me.hiredAt || actionInFlight.current || rewardMoments.length > 0 || miniGameOffer) return;
      actionInFlight.current = true;
      setAwaitingTravel(true);
      setOverview(false);

      const { event, offer, chestGame } = addEvent(me.id, kind);
      if (!event) {
        // Refused by the rules (unknown or hired player): nothing to animate.
        actionInFlight.current = false;
        setAwaitingTravel(false);
        return;
      }
      if (offer) setMiniGameOffer({ attemptId: event.id, eventId: event.id, kind: offer, action: kind });
      pendingChestGame.current = chestGame?.offer ? { attemptId: chestGame.attemptId, eventId: event.id } : null;
      const origin = heroOrigin(me, meIndex);

      // The staging is drawn from the event id: every friend sees the same variant.
      const variant = forcedVariant(kind) ?? variantFor(event.id, kind);
      const reactionKind = (variant.id in REACTION_KINDS ? variant.id : EFFECT_FOR[kind]) as EffectKind;
      const queued: Effect[] = [
        { id: event.id, kind: reactionKind, origin, playerId: me.id, loud: true },
      ];
      pendingChestEffect.current = null;

      const beforeChest = me.earnedChests;
      const afterSteps = Math.max(0, me.journeySteps + stepsForEvent(event));
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

      // The moment: lean in, impact, points flying to their counter, then the walk.
      sfx.press();
      const legendary = kind === "rejetApresEntretien" || kind === "embauche" || variant.rarity === "legendary";
      const { impact, duration } = reactionTiming(reactionKind);
      if (variant.rarity !== "common") schedule(impact + 250, () => moment.cue({ type: "badge", rarity: variant.rarity as "rare" | "legendary", name: variant.name }));
      if (reactionKind === "storm" || reactionKind === "refusalAvalanche") moment.cue({ type: "shade", color: "#0b1526", opacity: 0.42, ms: duration });
      const hold = REACTION_HOLD[kind] * 1000;
      const travelSteps = kind === "embauche" ? 12 : Math.max(1, Math.abs(afterSteps - me.journeySteps));
      leanIn(legendary ? 1.14 : 1.08, 0.42);
      setMomentActive(true);
      setHudTiming({ steps: { delay: hold, duration: travelSteps * 320 }, points: { delay: impact + 1500, duration: 300 } });
      if (legendary) moment.cue({ type: "letterbox", ms: duration });
      schedule(impact, () => {
        moment.cue({ type: "flash", ...FLASH[kind] });
        const hero = scene.heroes.get(me.id) ?? origin;
        // Points rise from the hero's shoulder, inside the visible band, then fly to their counter.
        if (POINTS[kind] !== 0) moment.cue({ type: "points", value: POINTS[kind], from: worldToScreen(hero.x - 70, hero.y - 130) });
      });
      pendingTale.current = forcedTale() ?? taleFor(event);
      pendingBanner.current = beforeZone.id !== afterZone.id
        ? { kicker: afterSteps < me.journeySteps ? "De retour" : "Nouvelle contrée", title: afterZone.name }
        : null;
      lastAction.current = kind;

      const steps = stepsForEvent(event);
      setActionFeedback({ id: event.id, kind, text: kind === "embauche" ? "En route pour la taverne !" : `${ACTION_LABELS_ONE[kind]}${event.journeyBonus ? " + bonus" : ""} · ${steps > 0 ? "+" : ""}${steps} pas${beforeZone.id !== afterZone.id ? ` · ${afterZone.short}` : ""}` });
      setRewardMoments(moments);
    },
    [addEvent, me, meIndex, rewardMoments.length, miniGameOffer, schedule],
  );

  const handleMiniGameResult = useCallback((result: MiniGameResult, score?: number) => {
    if (!miniGameOffer || !me) return;
    const { changed, chestGame, moved } = finishMiniGame(miniGameOffer.attemptId, result, score);
    if (!changed) return;
    setMiniGameOffer(offer => offer ? { ...offer, resolved: true } : null);
    if (result !== "won") return;
    const copy = MINI_GAMES[miniGameOffer.kind];
    if (miniGameOffer.action === "chest") {
      setPowerAttention(value => value + 1);
      setActionFeedback({ id: `${miniGameOffer.attemptId}-bonus`, text: copy.winFeedback });
      return;
    }
    // Only a bonus that moves the hero waits for the walk; otherwise nothing would end it.
    if (moved) {
      actionInFlight.current = true;
      setAwaitingTravel(true);
    }
    const bonus = miniGameBonus(miniGameOffer.action);
    if (chestGame) {
      const afterChest = me.earnedChests + 1;
      const x = chestXForStep(afterChest * STEPS_PER_LEVEL, WORLD_LENGTH, JOURNEY_TARGET);
      pendingChestEffect.current = { id: `${miniGameOffer.eventId}-bonus-chest`, kind: "chest", origin: { x, y: surfaceAt(x) + 8 } };
      setRewardMoments([{ id: `${miniGameOffer.eventId}-bonus-reward`, type: "chest", powerKind: powerForSlot(afterChest - 1) }]);
      pendingChestGame.current = chestGame.offer ? { attemptId: chestGame.attemptId, eventId: miniGameOffer.eventId } : null;
    }
    setActionFeedback({ id: `${miniGameOffer.eventId}-bonus`, kind: miniGameOffer.action, text: `${copy.winFeedback} · +${bonus} pas bonus` });
  }, [miniGameOffer, me, finishMiniGame]);

  const handleMiniGameDone = useCallback(() => {
    setMiniGameOffer(null);
    if (pendingChestGame.current) {
      setMiniGameOffer({ ...pendingChestGame.current, kind: "slots", action: "chest" });
      pendingChestGame.current = null;
    }
  }, []);

  // Passing on the invitation records a skip, exactly like closing the game.
  const handlePassMiniGame = useCallback(() => {
    handleMiniGameResult("skipped");
    handleMiniGameDone();
  }, [handleMiniGameResult, handleMiniGameDone]);

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
          playerId: target.id,
          loud: true,
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
    if (!me || actionInFlight.current || rewardMoments.length > 0 || miniGameOffer) return;
    actionInFlight.current = true;
    setAwaitingTravel(true);
    setEffects([]);
    setActionFeedback({ id: crypto.randomUUID(), text: "Dernière action annulée" });
    undoLast(me.id);
  }, [me, undoLast, rewardMoments.length, miniGameOffer]);

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
    momentTimers.current.forEach((timer) => window.clearTimeout(timer));
    momentTimers.current = [];
    leanOut();
    setMomentActive(false);
    setHudTiming(null);
    pendingBanner.current = null;
    pendingTale.current = null;
    actionInFlight.current = false;
    pendingChestEffect.current = null;
    chestAnimationId.current = null;
    setAwaitingTravel(false);
    setRewardMoments([]);
    setMiniGameOffer(null);
    pendingChestGame.current = null;
    setEffects([]);
    setActionFeedback(null);
    setOverview(false);
    setEffectFocusId(null);
  }, []);

  const enter = useCallback((playerId: string) => {
    seenRef.current = null;
    resetPresentation();
    shownCasts.current.clear();
    setShotInbox(null);
    setSceneReady(false);
    saveSession(playerId, scope);
    setMeId(playerId);
  }, [resetPresentation, scope]);

  // In a group, a character belongs to one device: any other one has to show its PIN first.
  const handlePick = useCallback((playerId: string) => {
    if (store && remoteMe !== playerId) { setClaiming(playerId); return; }
    enter(playerId);
  }, [store, remoteMe, enter]);

  const handleClaim = useCallback(async (playerId: string, pin: string) => {
    await claim(playerId, pin);
    setClaiming(null);
    enter(playerId);
  }, [claim, enter]);

  const handleCreate = useCallback(
    (name: string, characterId: string, pin?: string) => {
      const id = addPlayer(name, characterId, pin);
      if (!id) {
        setNotice({ title: "Personnage refusé", body: "Ce nom ou cette classe ne passe pas. Essaie autre chose." });
        return;
      }
      enter(id);
    },
    [addPlayer, enter],
  );

  const handleChangeIdentity = useCallback(() => {
    resetPresentation();
    shownCasts.current.clear();
    setShotInbox(null);
    clearSession(scope);
    setMeId(null);
    setRegisterOpen(false);
  }, [resetPresentation, scope]);


  const canUndo = Boolean(
    me && events.some((event) => event.playerId === me.id),
  );
  if (!loaded) {
    return (
      <main className="flex h-full w-full items-center justify-center bg-ink-deep">
        <p className="engrave animate-pulse text-sm">Chargement de la partie…</p>
      </main>
    );
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-ink-deep" data-moment={momentActive ? "on" : undefined}>
      <GameCanvas
        onSceneReady={handleSceneReady}
        paused={overview || registerOpen || chronicleOpen || dailyOpen || Boolean(recap) || Boolean(rewardMoment) || Boolean(shotInbox) || miniGameVisible}
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
      <DaylightVeil />
      <MomentOverlay />

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
                {[...Object.values(VARIANTS).flat().map((variant) => [variant.id, `${variant.name} (${variant.rarity})`]), ["chest", "Coffre"], ["fireCurse", "Feu"], ["dragonDrop", "Dragon"], ["paperStorm", "Paperasse"], ["frogCurse", "Crapaud"]].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <select aria-label="Tester un mini-jeu" value="" onChange={event => { if (event.target.value) setDevMiniGame({ kind: event.target.value as MiniGameKind, seed: `dev-${event.target.value}-${Date.now()}` }); }}>
                <option value="">Mini-jeu (entraînement)…</option>
                {Object.values(MINI_GAMES).map(game => <option key={game.kind} value={game.kind}>{game.title}</option>)}
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
              <QuestHud me={me} seasonRank={seasonRank} timing={hudTiming} streak={streak} />
              <div className="hud-controls">
                <PowerDeck
                  me={me}
                  players={players}
                  attentionToken={powerAttention}
                  onCast={handleCast}
                />
                <SoundToggle />
                <button type="button" className="chronicle-button pointer-events-auto" onClick={() => setChronicleOpen(true)} aria-label="Ouvrir la chronique de la compagnie">
                  <span aria-hidden>📜</span>
                  <span>Chronique</span>
                </button>
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
                  miniGameOffer !== null ||
                  devMiniGame !== null ||
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

      {news.length && !chronicleOpen ? <div className="news-stack" aria-live="polite">
        {news.map((item) => <NewsToast key={item.id} item={item} players={players} onOpen={() => { setNews([]); setChronicleOpen(true); }} />)}
      </div> : null}
      {chronicleOpen ? <Chronicle events={events} players={players} cheers={cheers} meId={identity} onCheer={handleCheer} onClose={() => setChronicleOpen(false)}
        daily={<DailyChallenge kind={todayGame.kind} runs={dailyRanking(daily, today)} players={players} meId={identity} onPlay={() => { if (me) startDaily(me.id, today, todayGame.kind); setChronicleOpen(false); setDailyOpen(true); }} />} /> : null}
      {dailyOpen && me ? <MiniGame key={todayGame.seedId} kind={todayGame.kind} seedId={todayGame.seedId}
        record={(() => { const top = dailyRanking(daily, today).find((run) => !run.pending); return top ? { score: top.score, holder: players.find((p) => p.id === top.playerId)?.name ?? "?" } : null; })()}
        onResolve={(result, score) => { recordDaily(me.id, today, todayGame.kind, result === "skipped" ? 0 : score ?? 0); }}
        onDone={() => { setDailyOpen(false); setChronicleOpen(true); }} /> : null}
      {recap && me && !chronicleOpen ? <AwayRecap events={recap.events} cheers={recap.cheers} players={players}
        onClose={() => setRecap(null)} onOpen={() => { setRecap(null); setChronicleOpen(true); }} /> : null}

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
          groupName={groupName}
          inviteUrl={inviteUrl}
          album={me ? <Album me={me} events={events} miniGames={miniGames} /> : null}
          onAddPlayer={store ? null : addPlayer}
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

      {devMiniGame ? <MiniGame key={devMiniGame.seed} kind={devMiniGame.kind} seedId={devMiniGame.seed} practice onResolve={() => {}} onDone={() => setDevMiniGame(null)} /> :
        inviteVisible && miniGameOffer ? <MiniGameInvite key={`invite-${miniGameOffer.attemptId}`} kind={miniGameOffer.kind} action={miniGameOffer.action} record={recordFor(miniGameOffer.kind)}
          onPlay={() => setMiniGameOffer((offer) => offer ? { ...offer, accepted: true } : null)}
          onPass={handlePassMiniGame} /> :
        miniGameVisible && miniGameOffer ? <MiniGame key={miniGameOffer.attemptId} kind={miniGameOffer.kind} seedId={miniGameOffer.attemptId} onResolve={handleMiniGameResult} onDone={handleMiniGameDone}
          record={recordFor(miniGameOffer.kind)} best={me ? personalBest(miniGames, miniGameOffer.kind, me.id) : null} /> : null}

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

      {shownNotice ? (
        <div className="toast-notice rise absolute left-1/2 z-[25] w-[min(92vw,38rem)] -translate-x-1/2">
          <div className="hud-panel toast-notice__panel">
            {shownNotice.powerKind ? (
              <PowerArtwork kind={shownNotice.powerKind} className="toast-notice__art" />
            ) : null}
            <div>
              <p className="font-display text-2xl text-gold-light">{shownNotice.title}</p>
              <p className="mt-1 text-base text-parchment/75">{shownNotice.body}</p>
            </div>
            <button type="button" onClick={() => { setNotice(null); clearSyncError(); }}>
              J’ai compris
            </button>
          </div>
        </div>
      ) : null}

      {sessionLost && slug ? (
        <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/80 px-4">
          <div className="frame riveted rise grid w-full max-w-sm gap-3 p-5 text-center">
            <p className="engrave text-sm">Session expirée</p>
            <Link href={`/g/${slug}/rejoindre`} className="slot px-4 py-2.5 font-display text-sm tracking-widest text-gold-light">Entrer le mot de passe</Link>
          </div>
        </div>
      ) : null}

      {me ? null : (
        <TitleScreen
          players={players}
          freeCharacters={freeCharacters}
          groupName={groupName}
          requirePin={Boolean(store)}
          message={identityRevoked ? "Ton personnage a été repris sur un autre appareil." : null}
          onPick={handlePick}
          onCreate={handleCreate}
        />
      )}
      {claiming ? (
        <ClaimDialog
          player={players.find((player) => player.id === claiming) ?? null}
          onSubmit={(pin) => handleClaim(claiming, pin)}
          onCancel={() => setClaiming(null)}
        />
      ) : null}
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
