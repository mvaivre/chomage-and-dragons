"use client";

import { useCallback, useEffect, useRef } from "react";
import { Application, useApplication, useTick } from "@pixi/react";
import type { Container, Graphics } from "pixi.js";
import type { PlayerView } from "@/hooks/useGame";
import {
  paletteAt,
  surfaceAt,
  VIEW,
  worldXFor,
  WORLD_LENGTH,
} from "@/lib/game/world";
import { RidgeLayer, Sky } from "./Backdrop";
import { resetScene, scene } from "./scene";
import { EFFECT_COMPONENTS, type Effect } from "./Effects";
import { Ground } from "./Ground";
import { Hero } from "./Hero";
import { laneFor } from "./lanes";
import {
  closeRidgeY,
  CLOSE_PROPS,
  farRidgeY,
  FRONT_BASE,
  FRONT_PROPS,
  LAYERS,
  midRidgeY,
  MID_PROPS,
} from "./landscape";
import { drawProp } from "./props";
import "./extendPixi";

/** Altitude de référence du sol, pour mesurer les écarts de relief. */
const REST_SURFACE = 556;

/** Le personnage suivi se tient à cette fraction de la largeur visible. */
const FOLLOW_ANCHOR = 0.36;

/* ------------------------------------------------------------------ premier plan */

/** Touffes qui passent devant les personnages. Leur base est sous l'écran. */
function FrontLayer() {
  const paint = useCallback((g: Graphics) => {
    g.clear();
    for (const prop of FRONT_PROPS) {
      const palette = paletteAt(prop.worldX);
      drawProp(g, prop, FRONT_BASE, {
        color: palette.near,
        dark: palette.groundDark,
        accent: palette.accent,
      });
    }
  }, []);

  return <pixiGraphics draw={paint} />;
}

/* ------------------------------------------------------------------ caméra */

/**
 * Met le monde à l'échelle, suit le personnage et fait trembler l'écran.
 * Tout passe par mutation dans le ticker : aucun rendu React par image.
 */
function CameraRig({ children }: { children: React.ReactNode }) {
  const root = useRef<Container>(null);
  const { app, isInitialised } = useApplication();

  useTick((ticker) => {
    const node = root.current;
    if (!node || !isInitialised) return;

    const { camera } = scene;
    const dt = Math.min(ticker.deltaMS, 60) / 1000;
    const { width, height } = app.screen;

    // On remplit la hauteur : la largeur visible varie avec la fenêtre, et c'est
    // très bien pour un défilement horizontal.
    camera.scale = height / VIEW.height;
    camera.viewW = width / camera.scale;

    // Le regard revient tout seul sur le personnage dès que le joueur lâche.
    if (!scene.dragging && scene.pan !== 0) {
      const eased = scene.pan * (1 - Math.min(1, dt * 2.2));
      scene.pan = Math.abs(eased) < 1 ? 0 : eased;
    }

    const wanted = scene.focus - camera.viewW * FOLLOW_ANCHOR + scene.pan;
    const maxX = Math.max(0, WORLD_LENGTH + 420 - camera.viewW);
    const clamped = Math.max(-240, Math.min(maxX, wanted));

    camera.x += (clamped - camera.x) * Math.min(1, dt * 4.5);

    const wantedY = (surfaceAt(scene.focus) - REST_SURFACE) * 0.45;
    camera.y += (wantedY - camera.y) * Math.min(1, dt * 3);

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
  effects: Effect[];
  onEffectDone: (id: string) => void;
}

function WorldScene({ players, meId, effects, onEffectDone }: SceneProps) {
  // Les plus en avant dans la profondeur sont dessinés en dernier.
  const ordered = players
    .map((player, index) => ({ player, lane: laneFor(index) }))
    .sort((a, b) => a.lane.dy - b.lane.dy);

  return (
    <CameraRig>
      <Sky />

      <Layer factor={LAYERS.far}>
        <RidgeLayer factor={LAYERS.far} ridge={farRidgeY} channel="far" haze={0.45} />
      </Layer>

      <Layer factor={LAYERS.mid}>
        <RidgeLayer
          factor={LAYERS.mid}
          ridge={midRidgeY}
          channel="mid"
          haze={0.22}
          props={MID_PROPS}
        />
      </Layer>

      <Layer factor={LAYERS.close}>
        <RidgeLayer
          factor={LAYERS.close}
          ridge={closeRidgeY}
          channel="near"
          haze={0.07}
          props={CLOSE_PROPS}
        />
      </Layer>

      <Layer factor={LAYERS.ground}>
        <Ground />

        {ordered.map(({ player, lane }) => (
          <Hero
            key={player.id}
            player={player}
            isMe={player.id === meId}
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

      <Layer factor={LAYERS.front}>
        <FrontLayer />
      </Layer>
    </CameraRig>
  );
}

/* ------------------------------------------------------------------ hôte */

export interface GameCanvasProps {
  players: PlayerView[];
  meId: string | null;
  effects: Effect[];
  onEffectDone: (id: string) => void;
}

export default function GameCanvas({
  players,
  meId,
  effects,
  onEffectDone,
}: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null);

  const me = players.find((p) => p.id === meId) ?? players[0] ?? null;
  const focus = me ? worldXFor(me.position) : 0;

  useEffect(() => {
    resetScene();
  }, []);

  useEffect(() => {
    scene.focus = focus;
  }, [focus]);

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
      className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Application
        resizeTo={host}
        background={0x1b2430}
        antialias
        autoDensity
        resolution={
          typeof window === "undefined"
            ? 1
            : Math.min(2, window.devicePixelRatio || 1)
        }
      >
        <WorldScene
          players={players}
          meId={meId}
          effects={effects}
          onEffectDone={onEffectDone}
        />
      </Application>
    </div>
  );
}
