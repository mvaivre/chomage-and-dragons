"use client";

import { useCallback, useEffect, useRef } from "react";
import { Application, useApplication, useTick } from "@pixi/react";
import type { Container } from "pixi.js";
import type { PlayerView } from "@/hooks/useGame";
import {
  surfaceAt,
  VIEW,
  worldXFor,
  WORLD_LENGTH,
} from "@/lib/game/world";
import { resetScene, scene } from "./scene";
import { EFFECT_COMPONENTS, type Effect } from "./Effects";
import { Sky } from "./Backdrop";
import { JourneyMarkers } from "./Ground";
import { Hero } from "./Hero";
import { laneFor } from "./lanes";
import {
  AnimatedLandmarks,
  AtmosphericMotes,
  ParallaxBackdrop,
  ParallaxForeground,
  ParallaxGround,
} from "./ParallaxWorld";
import "./extendPixi";

/** Altitude de référence du sol, pour mesurer les écarts de relief. */
const REST_SURFACE = 556;

/** Le personnage suivi se tient à cette fraction de la largeur visible. */
const FOLLOW_ANCHOR = 0.36;
const MIDGROUND_FACTOR = 0.34;
const FOREGROUND_FACTOR = 1.12;

/* ------------------------------------------------------------------ caméra */

/**
 * Met le monde à l'échelle, suit le personnage et fait trembler l'écran.
 * Tout passe par mutation dans le ticker : aucun rendu React par image.
 */
function CameraRig({
  initialFocus,
  children,
}: {
  initialFocus: number;
  children: React.ReactNode;
}) {
  const root = useRef<Container>(null);
  const ready = useRef(false);
  const { app, isInitialised } = useApplication();

  useTick((ticker) => {
    const node = root.current;
    if (!node || !isInitialised) return;

    const firstFrame = !ready.current;
    if (firstFrame) {
      resetScene();
      scene.focus = initialFocus;
      scene.targetFocus = initialFocus;
    }

    const { camera } = scene;
    const dt = Math.min(ticker.deltaMS, 60) / 1000;
    const { width, height } = app.screen;

    const baseScale = height / VIEW.height;
    camera.scale = baseScale;
    camera.viewW = width / camera.scale;

    // Le paysage se découvre avec le personnage au lieu de téléporter le regard au
    // résultat final. Une exponentielle garde la même sensation pour +1 et +10 pas.
    const focusEase = 1 - Math.exp(-scene.focusSpeed * dt);
    scene.focus += (scene.targetFocus - scene.focus) * focusEase;

    // Le regard revient tout seul sur le personnage dès que le joueur lâche.
    if (!scene.dragging && scene.pan !== 0) {
      const eased = scene.pan * (1 - Math.min(1, dt * 2.2));
      scene.pan = Math.abs(eased) < 1 ? 0 : eased;
    }

    const wanted = scene.focus - camera.viewW * FOLLOW_ANCHOR + scene.pan;
    const maxX = Math.max(0, WORLD_LENGTH + 420 - camera.viewW);
    const clamped = Math.max(-240, Math.min(maxX, wanted));

    const wantedY = (surfaceAt(scene.focus) - REST_SURFACE) * 0.45;

    // Au premier dessin, on cadre le héros sans traverser tout le monde depuis
    // l'origine. Les déplacements gagnés après cela restent, eux, animés.
    if (firstFrame) {
      camera.x = clamped;
      camera.y = wantedY;
      ready.current = true;
    } else {
      const horizontalFollow = scene.focusSpeed > 2 ? 12 : 4.5;
      camera.x += (clamped - camera.x) * Math.min(1, dt * horizontalFollow);
      camera.y += (wantedY - camera.y) * Math.min(1, dt * 3);
    }

    node.scale.set(camera.scale);

    const jitter = scene.shake * 18 * camera.scale;
    node.x = (Math.random() - 0.5) * jitter;
    node.y = (Math.random() - 0.5) * jitter;

    // Décroissance par défaut ; un effet actif réécrit la valeur à chaque image.
    if (scene.shake > 0) scene.shake = Math.max(0, scene.shake - dt * 2.6);
  });

  return <pixiContainer ref={root}>{children}</pixiContainer>;
}

/** Une couche qui défile à sa propre vitesse. */
function Layer({
  factor,
  children,
}: {
  factor: number;
  children: React.ReactNode;
}) {
  const ref = useRef<Container>(null);

  useTick(() => {
    const node = ref.current;
    if (!node) return;
    node.x = -scene.camera.x * factor;
    node.y = -scene.camera.y * factor;
  });

  return <pixiContainer ref={ref}>{children}</pixiContainer>;
}

/* ------------------------------------------------------------------ scène */

interface SceneProps {
  players: PlayerView[];
  meId: string | null;
  focusPlayerId: string | null;
  initialFocus: number;
  effects: Effect[];
  onEffectDone: (id: string) => void;
}

function WorldScene({
  players,
  meId,
  focusPlayerId,
  initialFocus,
  effects,
  onEffectDone,
}: SceneProps) {
  // Les plus en avant dans la profondeur sont dessinés en dernier.
  const ordered = players
    .map((player, index) => ({ player, lane: laneFor(index) }))
    .sort((a, b) => a.lane.dy - b.lane.dy);
  return (
    <CameraRig initialFocus={initialFocus}>
      <Sky />

      <Layer factor={MIDGROUND_FACTOR}>
        <ParallaxBackdrop factor={MIDGROUND_FACTOR} />
      </Layer>
      <AtmosphericMotes />

      <Layer factor={1}>
        <ParallaxGround />
        <AnimatedLandmarks />
        <JourneyMarkers />
      </Layer>

      <Layer factor={FOREGROUND_FACTOR}>
        <ParallaxForeground factor={FOREGROUND_FACTOR} />
      </Layer>

      <Layer factor={1}>

        {ordered.map(({ player, lane }) => (
          <Hero
            key={player.id}
            player={player}
            isMe={player.id === meId}
            isFocused={player.id === focusPlayerId}
            lane={lane}
          />
        ))}

        {effects.map((effect) => {
          const Animation = EFFECT_COMPONENTS[effect.kind];
          return (
            <Animation
              key={effect.id}
              origin={effect.origin}
              onDone={() => onEffectDone(effect.id)}
            />
          );
        })}
      </Layer>
    </CameraRig>
  );
}

/* ------------------------------------------------------------------ hôte */

export interface GameCanvasProps {
  players: PlayerView[];
  meId: string | null;
  /** Cible temporairement suivie pendant une farce, puis null pour revenir à soi. */
  focusPlayerId?: string | null;
  effects: Effect[];
  onEffectDone: (id: string) => void;
}

export default function GameCanvas({
  players,
  meId,
  focusPlayerId = null,
  effects,
  onEffectDone,
}: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const renderResolution =
    typeof window === "undefined"
      ? 1
      : window.innerWidth <= 760
        ? 1
        : Math.min(1.25, window.devicePixelRatio || 1);

  const me = players.find((p) => p.id === meId) ?? players[0] ?? null;
  const focusPlayer =
    players.find((player) => player.id === focusPlayerId) ?? me;
  const focus = focusPlayer ? worldXFor(focusPlayer.position) : 0;

  useEffect(() => {
    if (!focusPlayer) return;
    scene.targetFocus = focus;
    scene.focusSpeed = focusPlayerId ? 3.4 : 1.35;
  }, [focus, focusPlayer, focusPlayerId]);

  // Glisser à la souris ou au doigt décale la vue, qui revient ensuite d'elle-même
  // sur le personnage : on peut aller voir le peloton sans perdre son repère.
  const drag = useRef<{ x: number; pan: number } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    drag.current = { x: event.clientX, pan: scene.pan };
    scene.dragging = true;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const start = drag.current;
    if (!start) return;
    scene.pan = start.pan - (event.clientX - start.x) / scene.camera.scale;
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
    scene.dragging = false;
  }, []);

  return (
    <div
      ref={host}
      className="relative z-[1] h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Application
        resizeTo={host}
        backgroundAlpha={0}
        antialias
        autoDensity
        resolution={renderResolution}
      >
        <WorldScene
          players={players}
          meId={meId}
          focusPlayerId={focusPlayer?.id ?? null}
          initialFocus={focus}
          effects={effects}
          onEffectDone={onEffectDone}
        />
      </Application>
    </div>
  );
}
