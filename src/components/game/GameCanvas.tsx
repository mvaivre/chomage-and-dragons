"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Application, useApplication } from "@pixi/react";
import { useSceneTick as useTick } from "./useSceneTick";
import type { Application as PixiApplication, Container, Sprite, TextureSource } from "pixi.js";
import type { PlayerView } from "@/hooks/useGame";
import {
  surfaceAt,
  worldXFor,
  WORLD_LENGTH,
} from "@/lib/game/world";
import { resetScene, scene } from "./scene";
import { EFFECT_COMPONENTS, type Effect } from "./Effects";
import { Sky } from "./Backdrop";
import {
  BiomeArtLayer,
  GROUND_Y,
  GroundLayer,
  LandscapeBase,
  MidgroundLayer,
  NearForegroundLayer,
  PaperMotes,
  TransitionLandmarks,
} from "./FlatWorld";
import { Hero } from "./Hero";
import { AmbientLife } from "./AmbientLife";
import { laneFor } from "./lanes";
import type { HeroMotion } from "./animation";
import { frameComposition, parallaxX, renderResolution } from "./projection";
import "./extendPixi";

/** Altitude de référence du sol, pour mesurer les écarts de relief. */
const REST_SURFACE = GROUND_Y;

/** Le personnage suivi se tient à cette fraction de la largeur visible. */
const FOLLOW_ANCHOR = 0.36;
const FAR_FACTOR = 0.16;
const BACKGROUND_FACTOR = 0.36;
const MIDGROUND_FACTOR = 0.76;
const NEAR_FOREGROUND_FACTOR = 1.12;

/* ------------------------------------------------------------------ caméra */

/**
 * Met le monde à l'échelle, suit le personnage et fait trembler l'écran.
 * Tout passe par mutation dans le ticker : aucun rendu React par image.
 */
function CameraRig({
  initialFocus,
  freeCamera,
  children,
}: {
  initialFocus: number;
  freeCamera: boolean;
  children: React.ReactNode;
}) {
  const root = useRef<Container>(null);
  const ready = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const { app, isInitialised } = useApplication();

  useTick({ priority: 50, callback: (ticker) => {
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
    if (width <= 0 || height <= 0) return;

    const composition = frameComposition(width, height, scene.topInset, scene.bottomInset, GROUND_Y);
    const baseScale = composition.scale;
    camera.scale = baseScale;
    camera.viewW = width / camera.scale;
    camera.viewH = height / camera.scale;
    camera.screenOffsetY = composition.screenOffsetY;

    // Le paysage se découvre avec le personnage au lieu de téléporter le regard au
    // résultat final. Une exponentielle garde la même sensation pour +1 et +10 pas.
    const focusEase = 1 - Math.exp(-scene.focusSpeed * dt);
    scene.focus += (scene.targetFocus - scene.focus) * focusEase;

    // Le regard revient tout seul sur le personnage dès que le joueur lâche.
    if (!freeCamera && !scene.dragging && scene.pan !== 0) {
      const eased = scene.pan * (1 - Math.min(1, dt * 2.2));
      scene.pan = Math.abs(eased) < 1 ? 0 : eased;
    }

    const wanted = (freeCamera && scene.exploreCenter !== null
      ? scene.exploreCenter - camera.viewW * 0.5
      : scene.focus - camera.viewW * FOLLOW_ANCHOR) + scene.pan;
    const maxX = Math.max(0, Math.max(WORLD_LENGTH, scene.targetFocus + camera.viewW) + 420 - camera.viewW);
    const clamped = Math.max(-240, Math.min(maxX, wanted));

    const wantedY = (surfaceAt(scene.focus) - REST_SURFACE) * 0.45;

    // Au premier dessin, on cadre le héros sans traverser tout le monde depuis
    // l'origine. Les déplacements gagnés après cela restent, eux, animés.
    if (firstFrame) {
      camera.x = clamped;
      camera.y = wantedY;
      ready.current = true;
      setCameraReady(true);
    } else {
      const horizontalFollow = scene.focusSpeed > 2 ? 12 : 4.5;
      camera.x += (clamped - camera.x) * Math.min(1, dt * horizontalFollow);
      camera.y += (wantedY - camera.y) * Math.min(1, dt * 3);
    }

    node.scale.set(camera.scale);

    const jitter = scene.shake * 18 * camera.scale;
    node.x = (Math.random() - 0.5) * jitter;
    node.y = camera.screenOffsetY + (Math.random() - 0.5) * jitter;

    // Décroissance par défaut ; un effet actif réécrit la valeur à chaque image.
    if (scene.shake > 0) scene.shake = Math.max(0, scene.shake - dt * 2.6);
  }});

  return <pixiContainer eventMode="none" ref={root}>{cameraReady ? children : null}</pixiContainer>;
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
    // Le pivot au centre de la fenêtre évite que les couches lentes dérivent vers
    // le bord gauche du canvas au fil du voyage.
    node.x = parallaxX(0, scene.camera.x, scene.camera.viewW, factor);
    node.y = -scene.camera.y * factor;
  });

  return <pixiContainer ref={ref}>{children}</pixiContainer>;
}

function configureRenderer(app: PixiApplication) {
  app.ticker.maxFPS = 60;
  if (process.env.NODE_ENV !== "development") return;
  let samples: number[] = [];
  let elapsed = 0;
  app.ticker.add((ticker) => {
    elapsed += ticker.elapsedMS;
    samples.push(ticker.elapsedMS);
    if (elapsed < 1000) return;
    const output = document.getElementById("scene-stats");
    if (output) {
      const sources = new Set<TextureSource>();
      let sprites = 0;
      const inspect = (node: Container, visible = true) => {
        const texture = (node as Sprite).texture;
        if (texture?.source) {
          sources.add(texture.source);
          if (visible && node.visible) sprites += 1;
        }
        node.children?.forEach(child => inspect(child, visible && node.visible));
      };
      inspect(app.stage);
      const bytes = [...sources].reduce((sum, source) => sum + source.pixelWidth * source.pixelHeight * 4, 0);
      const ordered = [...samples].sort((a, b) => a - b);
      const p95 = ordered[Math.floor(ordered.length * 0.95)] ?? 0;
      output.textContent = `${Math.round(samples.length * 1000 / elapsed)} fps · p95 ${p95.toFixed(1)} ms · ${sprites} sprites · textures ${(bytes / 1048576).toFixed(0)} Mio`;
    }
    samples = [];
    elapsed = 0;
  });
}

/** No work is scheduled while the document is in the background. */
function RenderLifecycle() {
  const { app, isInitialised } = useApplication();
  useEffect(() => {
    if (!isInitialised || !app.renderer) return;
    const sync = () => {
      if (!app.ticker) return;
      if (document.hidden) app.stop();
      else app.start();
    };
    const host = app.canvas.parentElement;
    const resize = () => {
      // An observer notification may already be queued when Pixi is destroyed.
      if (!host || !app.renderer) return;
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const resolution = renderResolution(width, height, window.devicePixelRatio || 1);
      if (app.screen.width === width && app.screen.height === height && app.renderer.resolution === resolution) return;
      app.renderer.resize(width, height, resolution);
    };
    const observer = new ResizeObserver(resize);
    if (host) observer.observe(host);
    resize();
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [app, isInitialised]);
  return null;
}

/* ------------------------------------------------------------------ scène */

interface SceneProps {
  players: PlayerView[];
  meId: string | null;
  focusPlayerId: string | null;
  initialFocus: number;
  effects: Effect[];
  onEffectDone: (id: string) => void;
  onTravelDone: (playerId: string) => void;
  freeCamera: boolean;
  previewAt: number | null;
  pendingChestStep: number | null;
  devHero: { characterId: string; motion: HeroMotion };
}

function WorldScene({
  players,
  meId,
  focusPlayerId,
  initialFocus,
  effects,
  onEffectDone,
  onTravelDone,
  freeCamera,
  previewAt,
  devHero,
  pendingChestStep,
}: SceneProps) {
  // Les plus en avant dans la profondeur sont dessinés en dernier.
  const ordered = players
    .map((player, index) => ({ player, lane: laneFor(index) }))
    .sort((a, b) => a.lane.dy - b.lane.dy);
  return (
    <>
    <RenderLifecycle />
    <CameraRig initialFocus={initialFocus} freeCamera={freeCamera}>
      <Sky />

      <Layer factor={FAR_FACTOR}>
        <LandscapeBase factor={FAR_FACTOR} channel="far" />
        <BiomeArtLayer
          channel="far"
          factor={FAR_FACTOR}
          bottom={636}
          width={980}
          alpha={1}
        />
      </Layer>

      <Layer factor={BACKGROUND_FACTOR}>
        <LandscapeBase factor={BACKGROUND_FACTOR} channel="mid" />
        <BiomeArtLayer
          channel="back"
          factor={BACKGROUND_FACTOR}
          bottom={686}
          width={1120}
          alpha={1}
        />
      </Layer>

      <Layer factor={MIDGROUND_FACTOR}>
        <MidgroundLayer factor={MIDGROUND_FACTOR} />
        <AmbientLife factor={MIDGROUND_FACTOR} />
      </Layer>

      <Layer factor={1}>
        <TransitionLandmarks />
      </Layer>

      <PaperMotes />

      <Layer factor={1}>
        <GroundLayer journeySteps={players.find(player => player.id === meId)?.journeySteps ?? 0} pendingChestStep={pendingChestStep} activeChestX={effects.find(effect => effect.kind === "chest")?.origin.x ?? null} />
      </Layer>

      <Layer factor={1}>
        {previewAt !== null && players[0] ? <Hero
          key={`preview-${previewAt}`}
          player={{ ...players.find(player => player.id === meId) ?? players[0], characterId: devHero.characterId, id: "visual-preview", name: "Repère visuel", position: previewAt / WORLD_LENGTH }}
          isMe={false}
          isFocused={false}
          lane={{ dx: 0, dy: 48, scale: 0.9 }}
          previewMotion={devHero.motion}
        /> : null}
        {ordered.map(({ player, lane }) => (
          <Hero
            key={player.id}
            player={player}
            isMe={player.id === meId}
            isFocused={player.id === focusPlayerId}
            lane={lane}
            onTravelDone={onTravelDone}
          />
        ))}
      </Layer>

      <Layer factor={NEAR_FOREGROUND_FACTOR}>
        <NearForegroundLayer factor={NEAR_FOREGROUND_FACTOR} />
      </Layer>

      <Layer factor={1}>
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
    </>
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
  onTravelDone: (playerId: string) => void;
  freeCamera?: boolean;
  actionDockVisible: boolean;
  pendingChestStep: number | null;
  devHero: { characterId: string; motion: HeroMotion };
  devCameraTarget?: { worldX: number; revision: number } | null;
}

export default function GameCanvas({
  players,
  meId,
  focusPlayerId = null,
  effects,
  onEffectDone,
  onTravelDone,
  freeCamera = false,
  actionDockVisible,
  devHero,
  pendingChestStep,
  devCameraTarget = null,
}: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null);

  const me = players.find((p) => p.id === meId) ?? players[0] ?? null;
  const focusPlayer =
    players.find((player) => player.id === focusPlayerId) ?? me;
  const focus = focusPlayer ? worldXFor(focusPlayer.position) : 0;

  useEffect(() => {
    if (!focusPlayer) return;
    scene.targetFocus = focus;
    scene.focusSpeed = focusPlayerId ? 3.4 : 1.35;
  }, [focus, focusPlayer, focusPlayerId]);

  useEffect(() => {
    if (!freeCamera) {
      scene.pan = 0;
      scene.exploreCenter = null;
      return;
    }
    if (!devCameraTarget) return;
    scene.exploreCenter = devCameraTarget.worldX;
    scene.pan = 0;
  }, [devCameraTarget, freeCamera]);

  // Glisser à la souris ou au doigt décale la vue, qui revient ensuite d'elle-même
  // sur le personnage : on peut aller voir le peloton sans perdre son repère.
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const dock = actionDockVisible ? root.parentElement?.querySelector<HTMLElement>(".hud-bottom") : null;
    const top = root.parentElement?.querySelector<HTMLElement>(".hud-journey");
    const measure = () => {
      scene.bottomInset = dock ? Math.max(0, root.getBoundingClientRect().bottom - dock.getBoundingClientRect().top) : 80;
      scene.topInset = top ? Math.max(0, top.getBoundingClientRect().bottom - root.getBoundingClientRect().top) : 0;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (dock) observer.observe(dock);
    if (top) observer.observe(top);
    measure();
    return () => observer.disconnect();
  }, [meId, actionDockVisible]);

  const drag = useRef<{ x: number; pan: number; id: number } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, pan: scene.pan, id: event.pointerId };
    scene.dragging = true;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    scene.pan = start.pan - (event.clientX - start.x) / scene.camera.scale;
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
    scene.dragging = false;
  }, []);

  useEffect(() => {
    const root = host.current;
    if (!root || !freeCamera) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      scene.pan += delta / scene.camera.scale;
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [freeCamera]);

  return (
    <div
      ref={host}
      className="relative z-[1] h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
    >
      <Application
        onInit={configureRenderer}
        backgroundAlpha={1}
        backgroundColor={0x292b2c}
        antialias={false}
        autoDensity
        resolution={1}
      >
        <WorldScene
          players={players}
          meId={meId}
          focusPlayerId={focusPlayer?.id ?? null}
          initialFocus={focus}
          effects={effects}
          onEffectDone={onEffectDone}
          onTravelDone={onTravelDone}
          freeCamera={freeCamera}
          previewAt={freeCamera ? devCameraTarget?.worldX ?? null : null}
          devHero={devHero}
          pendingChestStep={pendingChestStep}
        />
      </Application>
    </div>
  );
}
