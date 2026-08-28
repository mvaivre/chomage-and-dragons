"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics, Sprite, Texture } from "pixi.js";
import { biomeAt, surfaceAt, VIEW, WORLD_LENGTH } from "@/lib/game/world";
import { scene } from "./scene";
import { usePaintedAsset } from "./sprites";
import { BODY } from "./style";

type TerrainId =
  | "grove"
  | "groveAlt"
  | "groveForest"
  | "forest"
  | "forestAlt"
  | "forestMarsh"
  | "marsh"
  | "marshAlt"
  | "marshBridge"
  | "bridgeAlt"
  | "bridgeWaterfall"
  | "waterfallAlt"
  | "waterfallMountain"
  | "mountain"
  | "mountainAlt"
  | "mountainWastes"
  | "wastes"
  | "wastesAlt"
  | "wastesTavern"
  | "tavern"
  | "tavernAlt";

interface TerrainDefinition {
  url: string;
  /** Hauteur de la ligne de marche dans le PNG, en fraction de sa hauteur. */
  ground: number;
}

const TERRAIN: Record<TerrainId, TerrainDefinition> = {
  grove: {
    url: "/art/world-v2/runtime/terrain-grove-v2.webp?v=7",
    ground: 0.615,
  },
  groveAlt: {
    url: "/art/world-v2/runtime/terrain-grove-alt.webp?v=1",
    ground: 0.62,
  },
  groveForest: {
    url: "/art/world-v2/runtime/terrain-grove-forest.webp?v=7",
    ground: 0.665,
  },
  forest: {
    url: "/art/world-v2/runtime/terrain-forest-v2.webp?v=7",
    ground: 0.69,
  },
  forestAlt: {
    url: "/art/world-v2/runtime/terrain-forest-alt.webp?v=1",
    ground: 0.67,
  },
  forestMarsh: {
    url: "/art/world-v2/runtime/terrain-forest-marsh-v2.webp?v=7",
    ground: 0.67,
  },
  marsh: {
    url: "/art/world-v2/runtime/terrain-marsh-v2.webp?v=7",
    ground: 0.655,
  },
  marshAlt: {
    url: "/art/world-v2/runtime/terrain-marsh-alt.webp?v=1",
    ground: 0.63,
  },
  marshBridge: {
    url: "/art/world-v2/runtime/terrain-marsh-bridge.webp?v=7",
    ground: 0.62,
  },
  bridgeAlt: {
    url: "/art/world-v2/runtime/terrain-bridge-alt.webp?v=1",
    ground: 0.48,
  },
  bridgeWaterfall: {
    url: "/art/world-v2/runtime/terrain-bridge-waterfall.webp?v=7",
    ground: 0.405,
  },
  waterfallAlt: {
    url: "/art/world-v2/runtime/terrain-waterfall-alt.webp?v=1",
    ground: 0.47,
  },
  waterfallMountain: {
    url: "/art/world-v2/runtime/terrain-waterfall-mountain.webp?v=7",
    ground: 0.445,
  },
  mountain: {
    url: "/art/world-v2/runtime/terrain-mountain-v2.webp?v=7",
    ground: 0.62,
  },
  mountainAlt: {
    url: "/art/world-v2/runtime/terrain-mountain-alt.webp?v=1",
    ground: 0.6,
  },
  mountainWastes: {
    url: "/art/world-v2/runtime/terrain-mountain-wastes-v2.webp?v=7",
    ground: 0.5,
  },
  wastes: {
    url: "/art/world-v2/runtime/terrain-wastes-v2.webp?v=7",
    ground: 0.61,
  },
  wastesAlt: {
    url: "/art/world-v2/runtime/terrain-wastes-alt.webp?v=1",
    ground: 0.59,
  },
  wastesTavern: {
    url: "/art/world-v2/runtime/terrain-wastes-tavern.webp?v=7",
    ground: 0.625,
  },
  tavern: {
    url: "/art/world-v2/runtime/terrain-tavern-v2.webp?v=7",
    ground: 0.665,
  },
  tavernAlt: {
    url: "/art/world-v2/runtime/terrain-tavern-alt.webp?v=1",
    ground: 0.64,
  },
};

/**
 * Chaque image est unique. Les frontières sont peintes dans la matière — racines
 * vers vase, vase vers maçonnerie, glace vers roche — plutôt que fabriquées par
 * transparence entre deux panoramas incompatibles.
 */
const TERRAIN_SEQUENCE: TerrainId[] = [
  "grove",
  "groveAlt",
  "groveForest",
  "forest",
  "forestAlt",
  "forestMarsh",
  "marsh",
  "marshAlt",
  "marshBridge",
  "bridgeAlt",
  "bridgeWaterfall",
  "waterfallAlt",
  "waterfallMountain",
  "mountain",
  "mountainAlt",
  "mountainWastes",
  "wastes",
  "wastesAlt",
  "wastesTavern",
  "tavern",
  "tavernAlt",
];

const TERRAIN_TILE_WIDTH = WORLD_LENGTH / TERRAIN_SEQUENCE.length;
/** Un recouvrement minuscule ferme uniquement les fentes dues aux sous-pixels. */
const TERRAIN_BLEED = 4;

type MidgroundId = "grove" | "marsh" | "alpine" | "wastes";
const MIDGROUND_PLACEMENTS: Array<{
  progress: number;
  id: MidgroundId;
  mirror?: boolean;
  width: number;
  y: number;
}> = [
  { progress: 0.02, id: "grove", width: 2140, y: -30 },
  { progress: 0.15, id: "grove", mirror: true, width: 1940, y: 2 },
  { progress: 0.27, id: "marsh", width: 2160, y: -22 },
  { progress: 0.4, id: "marsh", mirror: true, width: 1960, y: 8 },
  { progress: 0.51, id: "alpine", width: 2200, y: -50 },
  { progress: 0.64, id: "alpine", mirror: true, width: 2040, y: -12 },
  { progress: 0.76, id: "wastes", width: 2180, y: -34 },
  { progress: 0.89, id: "wastes", mirror: true, width: 1980, y: 4 },
  { progress: 0.99, id: "wastes", width: 2100, y: -18 },
];

type ForegroundId = "forest" | "marsh" | "mountain" | "wastes" | "tavern";
const FOREGROUND_PLACEMENTS: Array<{
  progress: number;
  id: ForegroundId;
  mirror?: boolean;
}> = [
  { progress: 0.06, id: "forest" },
  { progress: 0.17, id: "forest", mirror: true },
  { progress: 0.29, id: "marsh" },
  { progress: 0.42, id: "marsh", mirror: true },
  { progress: 0.56, id: "mountain" },
  { progress: 0.69, id: "mountain", mirror: true },
  { progress: 0.81, id: "wastes" },
  { progress: 0.9, id: "wastes", mirror: true },
  { progress: 0.96, id: "tavern" },
];

type SeamId = "forest" | "marsh" | "mountain" | "wastes";
const SEAM_CONNECTORS: Array<{
  boundary: number;
  id: SeamId;
  width: number;
}> = [
  { boundary: 1, id: "forest", width: 430 },
  { boundary: 2, id: "forest", width: 470 },
  { boundary: 3, id: "forest", width: 420 },
  { boundary: 4, id: "forest", width: 480 },
  { boundary: 5, id: "forest", width: 440 },
  { boundary: 6, id: "marsh", width: 470 },
  { boundary: 7, id: "marsh", width: 430 },
  { boundary: 8, id: "marsh", width: 480 },
  { boundary: 9, id: "marsh", width: 440 },
  { boundary: 10, id: "marsh", width: 460 },
  { boundary: 11, id: "mountain", width: 430 },
  { boundary: 12, id: "mountain", width: 470 },
  { boundary: 13, id: "mountain", width: 420 },
  { boundary: 14, id: "mountain", width: 480 },
  { boundary: 15, id: "mountain", width: 440 },
  { boundary: 16, id: "wastes", width: 470 },
  { boundary: 17, id: "wastes", width: 430 },
  { boundary: 18, id: "wastes", width: 480 },
  { boundary: 19, id: "wastes", width: 440 },
  { boundary: 20, id: "forest", width: 460 },
];

const REJECTION_SIGNS = [
  { x: 0.102, y: 0.495, text: "PAS ASSEZ\nGRAND" },
  { x: 0.473, y: 0.532, text: "15 ANS\nD’EXPÉRIENCE" },
  { x: 0.87, y: 0.56, text: "J’AIME PAS\nTON PARFUM" },
] as const;

const MOTE_BY_BIOME: Record<string, number> = {
  plaine: 0xf8d873,
  foret: 0xc7eb91,
  marais: 0x9ff5dc,
  lac: 0xc3f5ff,
  cascade: 0xe2fbff,
  montagne: 0xffffff,
  desert: 0xffc16a,
  taverne: 0xffd277,
};

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function useTerrainTextures(
  active: ReadonlySet<TerrainId>,
): Record<TerrainId, Texture | null> {
  const grove = usePaintedAsset(TERRAIN.grove.url, false, false, active.has("grove"));
  const groveAlt = usePaintedAsset(
    TERRAIN.groveAlt.url,
    false,
    false,
    active.has("groveAlt"),
  );
  const groveForest = usePaintedAsset(
    TERRAIN.groveForest.url,
    false,
    false,
    active.has("groveForest"),
  );
  const forest = usePaintedAsset(
    TERRAIN.forest.url,
    false,
    false,
    active.has("forest"),
  );
  const forestAlt = usePaintedAsset(
    TERRAIN.forestAlt.url,
    false,
    false,
    active.has("forestAlt"),
  );
  const forestMarsh = usePaintedAsset(
    TERRAIN.forestMarsh.url,
    false,
    false,
    active.has("forestMarsh"),
  );
  const marsh = usePaintedAsset(TERRAIN.marsh.url, false, false, active.has("marsh"));
  const marshAlt = usePaintedAsset(
    TERRAIN.marshAlt.url,
    false,
    false,
    active.has("marshAlt"),
  );
  const marshBridge = usePaintedAsset(
    TERRAIN.marshBridge.url,
    false,
    false,
    active.has("marshBridge"),
  );
  const bridgeAlt = usePaintedAsset(
    TERRAIN.bridgeAlt.url,
    false,
    false,
    active.has("bridgeAlt"),
  );
  const bridgeWaterfall = usePaintedAsset(
    TERRAIN.bridgeWaterfall.url,
    false,
    false,
    active.has("bridgeWaterfall"),
  );
  const waterfallAlt = usePaintedAsset(
    TERRAIN.waterfallAlt.url,
    false,
    false,
    active.has("waterfallAlt"),
  );
  const waterfallMountain = usePaintedAsset(
    TERRAIN.waterfallMountain.url,
    false,
    false,
    active.has("waterfallMountain"),
  );
  const mountain = usePaintedAsset(
    TERRAIN.mountain.url,
    false,
    false,
    active.has("mountain"),
  );
  const mountainAlt = usePaintedAsset(
    TERRAIN.mountainAlt.url,
    false,
    false,
    active.has("mountainAlt"),
  );
  const mountainWastes = usePaintedAsset(
    TERRAIN.mountainWastes.url,
    false,
    false,
    active.has("mountainWastes"),
  );
  const wastes = usePaintedAsset(
    TERRAIN.wastes.url,
    false,
    false,
    active.has("wastes"),
  );
  const wastesAlt = usePaintedAsset(
    TERRAIN.wastesAlt.url,
    false,
    false,
    active.has("wastesAlt"),
  );
  const wastesTavern = usePaintedAsset(
    TERRAIN.wastesTavern.url,
    false,
    false,
    active.has("wastesTavern"),
  );
  const tavern = usePaintedAsset(
    TERRAIN.tavern.url,
    false,
    false,
    active.has("tavern"),
  );
  const tavernAlt = usePaintedAsset(
    TERRAIN.tavernAlt.url,
    false,
    false,
    active.has("tavernAlt"),
  );

  return {
    grove,
    groveAlt,
    groveForest,
    forest,
    forestAlt,
    forestMarsh,
    marsh,
    marshAlt,
    marshBridge,
    bridgeAlt,
    bridgeWaterfall,
    waterfallAlt,
    waterfallMountain,
    mountain,
    mountainAlt,
    mountainWastes,
    wastes,
    wastesAlt,
    wastesTavern,
    tavern,
    tavernAlt,
  };
}

function useMidgroundTextures(): Record<MidgroundId, Texture | null> {
  const grove = usePaintedAsset("/art/world-v2/runtime/mid-grove.webp?v=5");
  const marsh = usePaintedAsset("/art/world-v2/runtime/mid-marsh.webp?v=5");
  const alpine = usePaintedAsset("/art/world-v2/runtime/mid-alpine.webp?v=5");
  const wastes = usePaintedAsset("/art/world-v2/runtime/mid-wastes.webp?v=5");
  return { grove, marsh, alpine, wastes };
}

function useSeamTextures(): Record<SeamId, Texture | null> {
  const forest = usePaintedAsset(
    "/art/world-v2/runtime/front-forest-low.webp?v=1",
  );
  const marsh = usePaintedAsset(
    "/art/world-v2/runtime/front-marsh-low.webp?v=1",
  );
  const mountain = usePaintedAsset(
    "/art/world-v2/runtime/front-mountain-low.webp?v=1",
  );
  const wastes = usePaintedAsset(
    "/art/world-v2/runtime/front-wastes-low.webp?v=1",
  );
  return { forest, marsh, mountain, wastes };
}

function useForegroundTextures(): Record<ForegroundId, Texture | null> {
  const forest = usePaintedAsset(
    "/art/world-v2/runtime/front-forest-strip.webp?v=1",
  );
  const marsh = usePaintedAsset(
    "/art/world-v2/runtime/front-marsh-strip.webp?v=1",
  );
  const mountain = usePaintedAsset(
    "/art/world-v2/runtime/front-mountain-strip.webp?v=1",
  );
  const wastes = usePaintedAsset(
    "/art/world-v2/runtime/front-wastes-strip.webp?v=1",
  );
  const tavern = usePaintedAsset(
    "/art/world-v2/runtime/front-tavern-strip.webp?v=1",
  );
  return { forest, marsh, mountain, wastes, tavern };
}

/** Vallées peintes à 34 % de la vitesse du terrain, devant le ciel animé. */
export function ParallaxBackdrop({ factor }: { factor: number }) {
  const textures = useMidgroundTextures();
  const sprites = useRef<Array<Sprite | null>>([]);

  useTick(() => {
    const layerSpan = WORLD_LENGTH * factor;
    const maxWidth = 2200;
    const visibleLeft = scene.camera.x * factor - maxWidth;
    const visibleRight = visibleLeft + scene.camera.viewW + maxWidth * 2;

    sprites.current.forEach((sprite, index) => {
      if (!sprite) return;
      const placement = MIDGROUND_PLACEMENTS[index];
      const tileWidth = placement.width;
      const tileHeight = tileWidth / 1.5;
      const center = placement.progress * layerSpan;
      const left = center - tileWidth * 0.5;
      sprite.visible = left + tileWidth > visibleLeft && left < visibleRight;
      if (!sprite.visible) return;

      sprite.width = tileWidth;
      sprite.height = tileHeight;
      sprite.scale.x = Math.abs(sprite.scale.x) * (placement.mirror ? -1 : 1);
      sprite.x = placement.mirror ? center + tileWidth * 0.5 : left;
      sprite.y = 568 - tileHeight * 0.75 + placement.y;
    });
  });

  return (
    <pixiContainer alpha={0.76}>
      {MIDGROUND_PLACEMENTS.map((placement, index) => {
        const texture = textures[placement.id];
        return texture ? (
          <pixiSprite
            key={`${placement.id}-${index}`}
            ref={(node) => {
              sprites.current[index] = node;
            }}
            texture={texture}
          />
        ) : null;
      })}
    </pixiContainer>
  );
}

/**
 * La ligne peinte et la ligne physique sont la même coordonnée. Les images restent
 * à leur définition native ; de petits sprites de matière recouvrent leurs joints.
 */
export function ParallaxGround() {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackedIndex = useRef(0);
  const activeIds = useMemo(() => {
    const ids = new Set<TerrainId>();
    const from = Math.max(0, activeIndex - 2);
    const to = Math.min(TERRAIN_SEQUENCE.length - 1, activeIndex + 2);
    for (let index = from; index <= to; index++) ids.add(TERRAIN_SEQUENCE[index]);
    return ids;
  }, [activeIndex]);
  const textures = useTerrainTextures(activeIds);
  const seamTextures = useSeamTextures();
  const sprites = useRef<Array<Sprite | null>>([]);

  useTick(() => {
    const nextIndex = Math.max(
      0,
      Math.min(
        TERRAIN_SEQUENCE.length - 1,
        Math.floor(scene.focus / TERRAIN_TILE_WIDTH),
      ),
    );
    if (nextIndex !== trackedIndex.current) {
      trackedIndex.current = nextIndex;
      setActiveIndex(nextIndex);
    }

    const tileHeight = TERRAIN_TILE_WIDTH / 1.5;
    const visibleLeft = scene.camera.x - TERRAIN_TILE_WIDTH;
    const visibleRight = scene.camera.x + scene.camera.viewW + TERRAIN_TILE_WIDTH;

    sprites.current.forEach((sprite, index) => {
      if (!sprite) return;
      const id = TERRAIN_SEQUENCE[index];
      const definition = TERRAIN[id];
      const start = index * TERRAIN_TILE_WIDTH;

      sprite.visible =
        start + TERRAIN_TILE_WIDTH > visibleLeft && start < visibleRight;
      if (!sprite.visible) return;

      sprite.width = TERRAIN_TILE_WIDTH + TERRAIN_BLEED;
      sprite.height = tileHeight;
      sprite.scale.x = Math.abs(sprite.scale.x);
      sprite.x = start - TERRAIN_BLEED * 0.5;
      sprite.y =
        surfaceAt(start + TERRAIN_TILE_WIDTH * 0.5) -
        definition.ground * tileHeight;
    });
  });

  const tileHeight = TERRAIN_TILE_WIDTH / 1.5;
  const forestIndex = TERRAIN_SEQUENCE.indexOf("forest");
  const forestStart = forestIndex * TERRAIN_TILE_WIDTH;
  const forestTop =
    surfaceAt(forestStart + TERRAIN_TILE_WIDTH * 0.5) -
    TERRAIN.forest.ground * tileHeight;

  return (
    <pixiContainer>
      {TERRAIN_SEQUENCE.map((id, index) =>
        textures[id] ? (
          <pixiSprite
            key={`${id}-${index}`}
            ref={(node) => {
              sprites.current[index] = node;
            }}
            texture={textures[id]}
          />
        ) : null,
      )}
      {SEAM_CONNECTORS.map((connector) => {
        const texture = seamTextures[connector.id];
        const x = connector.boundary * TERRAIN_TILE_WIDTH;
        return texture ? (
          <pixiSprite
            key={`${connector.id}-${connector.boundary}`}
            texture={texture}
            anchor={{ x: 0.5, y: 1 }}
            x={x}
            y={surfaceAt(x) + 18}
            width={connector.width}
            height={connector.width / 1.5}
          />
        ) : null;
      })}
      {REJECTION_SIGNS.map((sign) => (
        <pixiText
          key={sign.text}
          text={sign.text}
          style={{
            fontFamily: BODY,
            fontSize: 19,
            fontWeight: "800",
            fill: 0x2b180c,
            align: "center",
            lineHeight: 17,
            letterSpacing: 0.3,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          x={forestStart + sign.x * TERRAIN_TILE_WIDTH}
          y={forestTop + sign.y * tileHeight}
          resolution={2}
        />
      ))}
    </pixiContainer>
  );
}

/** Branches et rochers proches : peu nombreux, mais leur vitesse crée le relief. */
export function ParallaxForeground({ factor }: { factor: number }) {
  const textures = useForegroundTextures();
  const root = useRef<Container>(null);
  const sprites = useRef<Array<Sprite | null>>([]);

  useTick((ticker) => {
    const maxWidth = 1500;
    const visibleLeft = scene.camera.x * factor - maxWidth;
    const visibleRight = visibleLeft + scene.camera.viewW + maxWidth * 2;
    const breathe = Math.sin(ticker.lastTime * 0.0007) * 2.2;

    if (root.current) root.current.alpha = 0.9;

    sprites.current.forEach((sprite, index) => {
      if (!sprite) return;
      const placement = FOREGROUND_PLACEMENTS[index];
      const width = Math.min(
        maxWidth,
        Math.max(900, scene.camera.viewW * 1.2),
      );
      const height = width / 1.5;
      const center = placement.progress * WORLD_LENGTH * factor;
      const left = center - width * 0.5;
      sprite.visible = left + width > visibleLeft && left < visibleRight;
      if (!sprite.visible) return;

      sprite.width = width;
      sprite.height = height;
      sprite.scale.x = Math.abs(sprite.scale.x) * (placement.mirror ? -1 : 1);
      sprite.x = placement.mirror ? center + width * 0.5 : left;
      // Ces images sont de vraies bandes : leur base opaque coïncide toujours
      // avec le bas du cadre et ne peut donc jamais flotter dans le décor.
      sprite.y = VIEW.height - height + breathe;
    });
  });

  return (
    <pixiContainer ref={root}>
      {FOREGROUND_PLACEMENTS.map((placement, index) => {
        const texture = textures[placement.id];
        return texture ? (
          <pixiSprite
            key={`${placement.id}-${index}`}
            ref={(node) => {
              sprites.current[index] = node;
            }}
            texture={texture}
          />
        ) : null;
      })}
    </pixiContainer>
  );
}

/** Un peu de mouvement réel dans la grande cascade peinte, derrière les héros. */
export function AnimatedLandmarks() {
  const root = useRef<Container>(null);
  const streams = useRef<Array<Graphics | null>>([]);
  const waterfallX = (10.7 / TERRAIN_SEQUENCE.length) * WORLD_LENGTH;
  const paintStream = useCallback((g: Graphics) => {
    g.clear();
    g.roundRect(-3, 0, 6, 74, 3).fill({ color: 0xd8ffff, alpha: 0.36 });
    g.roundRect(-1, 8, 2, 54, 1).fill({ color: 0xffffff, alpha: 0.68 });
  }, []);

  useTick((ticker) => {
    const node = root.current;
    if (!node) return;
    const time = ticker.lastTime / 1000;
    node.x = waterfallX;
    node.y = surfaceAt(waterfallX) + 18;

    streams.current.forEach((stream, index) => {
      if (!stream) return;
      stream.x = -150 + index * 43 + Math.sin(time * 1.3 + index) * 7;
      stream.y = positiveModulo(time * (52 + index * 5) + index * 37, 210) - 42;
      stream.alpha = 0.18 + Math.sin(time * 2.1 + index) * 0.09;
      stream.scale.y = 0.82 + (index % 3) * 0.17;
    });
  });

  return (
    <pixiContainer ref={root}>
      {Array.from({ length: 8 }, (_, index) => (
        <pixiGraphics
          key={index}
          ref={(node) => {
            streams.current[index] = node;
          }}
          draw={paintStream}
        />
      ))}
    </pixiContainer>
  );
}

/** Lucioles, neige, gouttes ou braises selon le pays actuellement traversé. */
export function AtmosphericMotes() {
  const particles = useRef<Array<Graphics | null>>([]);
  const paint = useCallback((g: Graphics) => {
    g.clear();
    g.circle(0, 0, 2.2).fill(0xffffff);
    g.circle(0, 0, 7).fill({ color: 0xffffff, alpha: 0.12 });
  }, []);

  useTick((ticker) => {
    const biome = biomeAt(scene.focus);
    const time = ticker.lastTime / 1000;
    particles.current.forEach((particle, index) => {
      if (!particle) return;
      const speed = 10 + (index % 5) * 3;
      const seed = index * 97.13;
      particle.tint = MOTE_BY_BIOME[biome.id] ?? 0xffffff;
      particle.x =
        positiveModulo(
          seed * 7 + time * speed - scene.camera.x * 0.08,
          scene.camera.viewW + 80,
        ) - 40;
      particle.y =
        90 + positiveModulo(seed * 3 - time * (7 + (index % 4) * 2), 420);
      particle.alpha = 0.35 + Math.sin(time * 1.7 + index) * 0.22;
      particle.scale.set(0.65 + (index % 3) * 0.2);
    });
  });

  return (
    <pixiContainer alpha={0.78}>
      {Array.from({ length: 14 }, (_, index) => (
        <pixiGraphics
          key={index}
          ref={(node) => {
            particles.current[index] = node;
          }}
          draw={paint}
        />
      ))}
    </pixiContainer>
  );
}
