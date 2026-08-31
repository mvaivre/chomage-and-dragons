"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics, Sprite, Texture } from "pixi.js";
import {
  biomeAt,
  mixColor,
  paletteAt,
  surfaceAt,
  WORLD_LENGTH,
  WORLD_MODULE_COUNT,
} from "@/lib/game/world";
import { scene } from "./scene";
import { usePaintedAsset } from "./sprites";

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
  chromaKey?: boolean;
  /** Largeur du fondu alpha dans le bitmap source. */
  horizontalFeather?: number;
  /** Les tuiles de transition se dessinent après leurs deux voisines. */
  renderAbove?: boolean;
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
    url: "/art/world-v2/runtime/terrain-grove-forest-safe.webp?v=2",
    ground: 0.665,
    chromaKey: true,
    renderAbove: true,
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
    url: "/art/world-v2/runtime/terrain-transition-forest-marsh-v3.webp?v=1",
    ground: 0.625,
    chromaKey: true,
    horizontalFeather: 0,
    renderAbove: true,
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
    renderAbove: true,
  },
  bridgeAlt: {
    url: "/art/world-v2/runtime/terrain-bridge-alt.webp?v=1",
    ground: 0.62,
  },
  bridgeWaterfall: {
    url: "/art/world-v2/runtime/terrain-bridge-waterfall.webp?v=7",
    ground: 0.405,
    renderAbove: true,
  },
  waterfallAlt: {
    url: "/art/world-v2/runtime/terrain-waterfall-alt.webp?v=1",
    ground: 0.58,
  },
  waterfallMountain: {
    url: "/art/world-v2/runtime/terrain-waterfall-mountain.webp?v=7",
    ground: 0.445,
    renderAbove: true,
  },
  mountain: {
    url: "/art/world-v2/runtime/terrain-mountain-v2.webp?v=7",
    ground: 0.59,
  },
  mountainAlt: {
    url: "/art/world-v2/runtime/terrain-mountain-alt.webp?v=1",
    ground: 0.6,
  },
  mountainWastes: {
    url: "/art/world-v2/runtime/terrain-mountain-wastes-v2.webp?v=7",
    ground: 0.5,
    renderAbove: true,
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
    renderAbove: true,
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

const FOREST_MARSH_ZONE = {
  terrainIndex: 5,
  midground: {
    url: "/art/world-v2/runtime/mid-transition-forest-marsh-v1.webp?v=1",
    width: 880,
    contentBase: 0.835,
    horizontalFeather: 0,
    yOffset: 88,
  },
  detail: {
    url: "/art/world-v2/runtime/mid-detail-transition-forest-marsh-v1.webp?v=1",
    width: 820,
    contentBase: 0.92,
    horizontalFeather: 0,
    yOffset: 42,
  },
  foreground: [
    {
      url: "/art/world-v2/runtime/front-standalone-forest-v1.webp?v=1",
      offset: -0.46,
      width: 620,
    },
    {
      url: "/art/world-v2/runtime/front-standalone-transition-v1.webp?v=1",
      offset: 0.08,
      width: 560,
    },
    {
      url: "/art/world-v2/runtime/front-standalone-marsh-v1.webp?v=1",
      offset: 0.54,
      width: 520,
    },
  ],
} as const;

const MOUNTAIN_WASTES_ZONE = {
  progress: 15.5 / TERRAIN_SEQUENCE.length,
  midground: {
    url: "/art/world-v2/runtime/mid-transition-mountain-wastes-v1.webp?v=1",
    width: 1080,
    contentBase: 0.79,
    horizontalFeather: 0,
    yOffset: 96,
  },
} as const;

type MidgroundId = "grove" | "marsh" | "alpine" | "wastes";
const MIDGROUND: Record<
  MidgroundId,
  {
    url: string;
    chromaKey: boolean;
    contentBase: number;
    edgeFeather?: number;
  }
> = {
  grove: {
    url: "/art/world-v2/runtime/mid-grove-standalone.webp?v=1",
    chromaKey: true,
    contentBase: 0.784,
  },
  marsh: {
    url: "/art/world-v2/runtime/mid-marsh-standalone.webp?v=1",
    chromaKey: false,
    contentBase: 0.79,
  },
  alpine: {
    url: "/art/world-v2/runtime/mid-alpine-standalone.webp?v=1",
    chromaKey: false,
    contentBase: 0.8,
    edgeFeather: 110,
  },
  wastes: {
    url: "/art/world-v2/runtime/mid-wastes-standalone.webp?v=1",
    chromaKey: false,
    contentBase: 0.838,
    edgeFeather: 110,
  },
};
const MIDGROUND_PLACEMENTS: Array<{
  progress: number;
  id: MidgroundId;
  mirror?: boolean;
  width: number;
  y: number;
}> = [
  { progress: 0.045, id: "grove", width: 1120, y: 8 },
  { progress: 0.17, id: "grove", mirror: true, width: 1240, y: -6 },
  { progress: 0.3, id: "marsh", width: 1240, y: 4 },
  { progress: 0.43, id: "marsh", mirror: true, width: 1180, y: 14 },
  { progress: 0.55, id: "alpine", width: 1360, y: -16 },
  { progress: 0.68, id: "alpine", mirror: true, width: 1280, y: -4 },
  { progress: 0.86, id: "wastes", width: 1120, y: 8 },
  { progress: 0.97, id: "wastes", mirror: true, width: 1180, y: 4 },
];

type ForegroundId =
  | "forestTall"
  | "marshTall"
  | "mountainTall"
  | "wastesTall"
  | "tavernTall";
const FOREGROUND: Record<
  ForegroundId,
  { url: string; chromaKey: boolean; contentBase: number; aspect: number }
> = {
  forestTall: {
    url: "/art/world-v2/runtime/front-forest-tall-v1.webp?v=1",
    chromaKey: true,
    contentBase: 0.94,
    aspect: 2 / 3,
  },
  marshTall: {
    url: "/art/world-v2/runtime/front-marsh-tall-v1.webp?v=1",
    chromaKey: true,
    contentBase: 0.94,
    aspect: 2 / 3,
  },
  mountainTall: {
    url: "/art/world-v2/runtime/front-mountain-tall-v1.webp?v=1",
    chromaKey: true,
    contentBase: 0.94,
    aspect: 2 / 3,
  },
  wastesTall: {
    url: "/art/world-v2/runtime/front-wastes-tall-v1.webp?v=1",
    chromaKey: true,
    contentBase: 0.94,
    aspect: 2 / 3,
  },
  tavernTall: {
    url: "/art/world-v2/runtime/front-tavern-tall-v1.webp?v=1",
    chromaKey: true,
    contentBase: 0.94,
    aspect: 2 / 3,
  },
};
const NEAR_FOREGROUND_PLACEMENTS: Array<{
  progress: number;
  id: ForegroundId;
  mirror?: boolean;
  width: number;
  y?: number;
}> = [
  { progress: 0.11, id: "forestTall", width: 450 },
  { progress: 0.225, id: "forestTall", mirror: true, width: 390, y: 10 },
  { progress: 0.35, id: "marshTall", width: 430 },
  { progress: 0.455, id: "marshTall", mirror: true, width: 380 },
  { progress: 0.6, id: "mountainTall", width: 450 },
  { progress: 0.71, id: "mountainTall", mirror: true, width: 400 },
  { progress: 0.77, id: "wastesTall", width: 450, y: 8 },
  { progress: 0.86, id: "wastesTall", mirror: true, width: 400 },
  { progress: 0.955, id: "tavernTall", width: 420 },
];

type GroundCoverId =
  | "forest"
  | "forestMarsh"
  | "marsh"
  | "marshWater"
  | "water"
  | "waterMountain"
  | "mountain"
  | "mountainWastes"
  | "wastes"
  | "wastesTavern"
  | "tavern";

interface GroundCoverDefinition {
  url: string;
  /** Première ligne opaque aux deux bords, mesurée dans le bitmap source. */
  socket: number;
  directional?: boolean;
}

const GROUND_COVER: Record<GroundCoverId, GroundCoverDefinition> = {
  forest: {
    url: "/art/world-v2/runtime/front-cover-forest-v1.webp?v=1",
    socket: 589 / 1024,
  },
  forestMarsh: {
    url: "/art/world-v2/runtime/front-cover-transition-forest-marsh-v1.webp?v=1",
    socket: 648 / 1024,
    directional: true,
  },
  marsh: {
    url: "/art/world-v2/runtime/front-cover-marsh-v1.webp?v=1",
    socket: 565 / 1024,
  },
  marshWater: {
    url: "/art/world-v2/runtime/front-cover-transition-marsh-water-v1.webp?v=1",
    socket: 560 / 1024,
    directional: true,
  },
  water: {
    url: "/art/world-v2/runtime/front-cover-water-v1.webp?v=1",
    socket: 506 / 1024,
  },
  waterMountain: {
    url: "/art/world-v2/runtime/front-cover-transition-water-mountain-v1.webp?v=1",
    socket: 582 / 1024,
    directional: true,
  },
  mountain: {
    url: "/art/world-v2/runtime/front-cover-mountain-v2.webp?v=1",
    socket: 559 / 1024,
  },
  mountainWastes: {
    url: "/art/world-v2/runtime/front-cover-transition-mountain-wastes-v1.webp?v=1",
    socket: 594 / 1024,
    directional: true,
  },
  wastes: {
    url: "/art/world-v2/runtime/front-cover-wastes-v1.webp?v=1",
    socket: 560 / 1024,
  },
  wastesTavern: {
    url: "/art/world-v2/runtime/front-cover-transition-wastes-tavern-v1.webp?v=1",
    socket: 510 / 1024,
    directional: true,
  },
  tavern: {
    url: "/art/world-v2/runtime/front-cover-tavern-v1.webp?v=1",
    socket: 683 / 1024,
  },
};

/** Une famille par module de sol ; les changements de biome se font dans le recouvrement. */
const GROUND_COVER_SEQUENCE: GroundCoverId[] = [
  "forest",
  "forest",
  "forest",
  "forest",
  "forest",
  "forestMarsh",
  "marsh",
  "marsh",
  "marshWater",
  "water",
  "water",
  "water",
  "waterMountain",
  "mountain",
  "mountain",
  "mountainWastes",
  "wastes",
  "wastes",
  "wastesTavern",
  "tavern",
  "tavern",
];

const GROUND_COVER_PLACEMENTS = Array.from(
  { length: WORLD_MODULE_COUNT + 2 },
  (_, placementIndex) => {
    const moduleIndex = placementIndex - 1;
    const sequenceIndex = Math.max(
      0,
      Math.min(WORLD_MODULE_COUNT - 1, moduleIndex),
    );
    return {
      moduleIndex,
      id: GROUND_COVER_SEQUENCE[sequenceIndex],
    };
  },
);

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
  const useTerrain = (id: TerrainId) => {
    return usePaintedAsset(
      TERRAIN[id].url.replace("?v=", "?body=1&v="),
      true,
      false,
      active.has(id),
      120,
    );
  };
  const grove = useTerrain("grove");
  const groveAlt = useTerrain("groveAlt");
  const groveForest = useTerrain("groveForest");
  const forest = useTerrain("forest");
  const forestAlt = useTerrain("forestAlt");
  const forestMarsh = useTerrain("forestMarsh");
  const marsh = useTerrain("marsh");
  const marshAlt = useTerrain("marshAlt");
  const marshBridge = useTerrain("marshBridge");
  const bridgeAlt = useTerrain("bridgeAlt");
  const bridgeWaterfall = useTerrain("bridgeWaterfall");
  const waterfallAlt = useTerrain("waterfallAlt");
  const waterfallMountain = useTerrain("waterfallMountain");
  const mountain = useTerrain("mountain");
  const mountainAlt = useTerrain("mountainAlt");
  const mountainWastes = useTerrain("mountainWastes");
  const wastes = useTerrain("wastes");
  const wastesAlt = useTerrain("wastesAlt");
  const wastesTavern = useTerrain("wastesTavern");
  const tavern = useTerrain("tavern");
  const tavernAlt = useTerrain("tavernAlt");

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
  const grove = usePaintedAsset(MIDGROUND.grove.url, MIDGROUND.grove.chromaKey);
  const marsh = usePaintedAsset(MIDGROUND.marsh.url, MIDGROUND.marsh.chromaKey);
  const alpine = usePaintedAsset(
    MIDGROUND.alpine.url,
    MIDGROUND.alpine.chromaKey,
    false,
    true,
    MIDGROUND.alpine.edgeFeather,
  );
  const wastes = usePaintedAsset(
    MIDGROUND.wastes.url,
    MIDGROUND.wastes.chromaKey,
    false,
    true,
    MIDGROUND.wastes.edgeFeather,
  );
  return { grove, marsh, alpine, wastes };
}

function useForegroundTextures(): Record<ForegroundId, Texture | null> {
  const forestTall = usePaintedAsset(
    FOREGROUND.forestTall.url,
    FOREGROUND.forestTall.chromaKey,
    false,
    true,
    0,
    3,
  );
  const marshTall = usePaintedAsset(
    FOREGROUND.marshTall.url,
    FOREGROUND.marshTall.chromaKey,
    false,
    true,
    0,
    3,
  );
  const mountainTall = usePaintedAsset(
    FOREGROUND.mountainTall.url,
    FOREGROUND.mountainTall.chromaKey,
    false,
    true,
    0,
    3,
  );
  const wastesTall = usePaintedAsset(
    FOREGROUND.wastesTall.url,
    FOREGROUND.wastesTall.chromaKey,
    false,
    true,
    0,
    3,
  );
  const tavernTall = usePaintedAsset(
    FOREGROUND.tavernTall.url,
    FOREGROUND.tavernTall.chromaKey,
    false,
    true,
    0,
    3,
  );
  return {
    forestTall,
    marshTall,
    mountainTall,
    wastesTall,
    tavernTall,
  };
}

function useGroundCoverTexture(
  id: GroundCoverId,
  enabled: boolean,
): Texture | null {
  return usePaintedAsset(
    GROUND_COVER[id].url,
    true,
    false,
    enabled,
    64,
    0,
    2,
    true,
    "organic-left",
  );
}

function useGroundCoverTextures(
  active: ReadonlySet<GroundCoverId>,
): Record<GroundCoverId, Texture | null> {
  const forest = useGroundCoverTexture("forest", active.has("forest"));
  const forestMarsh = useGroundCoverTexture(
    "forestMarsh",
    active.has("forestMarsh"),
  );
  const marsh = useGroundCoverTexture("marsh", active.has("marsh"));
  const marshWater = useGroundCoverTexture(
    "marshWater",
    active.has("marshWater"),
  );
  const water = useGroundCoverTexture("water", active.has("water"));
  const waterMountain = useGroundCoverTexture(
    "waterMountain",
    active.has("waterMountain"),
  );
  const mountain = useGroundCoverTexture("mountain", active.has("mountain"));
  const mountainWastes = useGroundCoverTexture(
    "mountainWastes",
    active.has("mountainWastes"),
  );
  const wastes = useGroundCoverTexture("wastes", active.has("wastes"));
  const wastesTavern = useGroundCoverTexture(
    "wastesTavern",
    active.has("wastesTavern"),
  );
  const tavern = useGroundCoverTexture("tavern", active.has("tavern"));
  return {
    forest,
    forestMarsh,
    marsh,
    marshWater,
    water,
    waterMountain,
    mountain,
    mountainWastes,
    wastes,
    wastesTavern,
    tavern,
  };
}

/**
 * Prolonge la roche sous les bitmaps sur les écrans plus hauts que le cadre 16:9.
 * Le remplissage reste derrière les tuiles : il n'altère jamais leur dessin et ne
 * devient visible qu'une fois leur bord inférieur dépassé.
 */
function TerrainDepthUnderlay() {
  const ref = useRef<Graphics>(null);

  const paint = useCallback((g: Graphics) => {
    const { camera } = scene;
    const palette = paletteAt(camera.x + camera.viewW * 0.5);
    const worldCenter = camera.x + camera.viewW * 0.5;
    const top = surfaceAt(worldCenter) + 18;
    const height = Math.max(260, camera.viewH + camera.y - top + 220);
    const left = camera.x - 160;
    const width = camera.viewW + 320;

    g.clear();
    for (let band = 0; band < 8; band++) {
      const y = top + (height * band) / 8;
      const t = band / 7;
      g.rect(left, y, width, height / 8 + 2).fill(
        mixColor(palette.groundDark, 0x11151a, t * 0.62),
      );
    }
  }, []);

  useTick(() => {
    if (ref.current) paint(ref.current);
  });

  return <pixiGraphics ref={ref} draw={paint} />;
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
      const definition = MIDGROUND[placement.id];
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
      sprite.y = Math.round(
        700 - tileHeight * definition.contentBase + placement.y,
      );
    });
  });

  return (
    <pixiContainer alpha={0.78}>
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
  const bodyTextures = useTerrainTextures(activeIds);
  const bodySprites = useRef<Array<Sprite | null>>([]);
  const renderOrder = useMemo(
    () =>
      TERRAIN_SEQUENCE.map((_, index) => index).sort(
        (left, right) =>
          Number(Boolean(TERRAIN[TERRAIN_SEQUENCE[left]].renderAbove)) -
          Number(Boolean(TERRAIN[TERRAIN_SEQUENCE[right]].renderAbove)),
      ),
    [],
  );

  useTick(() => {
    const cameraCenter = scene.camera.x + scene.camera.viewW * 0.5;
    const nextIndex = Math.max(
      0,
      Math.min(
        TERRAIN_SEQUENCE.length - 1,
        Math.floor(cameraCenter / TERRAIN_TILE_WIDTH),
      ),
    );
    if (nextIndex !== trackedIndex.current) {
      trackedIndex.current = nextIndex;
      setActiveIndex(nextIndex);
    }

    const visibleLeft = scene.camera.x - TERRAIN_TILE_WIDTH;
    const visibleRight = scene.camera.x + scene.camera.viewW + TERRAIN_TILE_WIDTH;

    bodySprites.current.forEach((sprite, index) => {
      if (!sprite) return;
      const id = TERRAIN_SEQUENCE[index];
      const definition = TERRAIN[id];
      const start = index * TERRAIN_TILE_WIDTH;
      const width = TERRAIN_TILE_WIDTH + 240;
      const height = width / 1.5;

      sprite.visible =
        start + TERRAIN_TILE_WIDTH + 120 > visibleLeft &&
        start - 120 < visibleRight;
      if (!sprite.visible) return;

      sprite.width = width;
      sprite.height = height;
      sprite.scale.x = Math.abs(sprite.scale.x);
      sprite.x = start - 120;
      sprite.y =
        surfaceAt(start) - definition.ground * height;
    });

  });

  return (
    <pixiContainer>
      <TerrainDepthUnderlay />
      {renderOrder.map((index) => {
        const id = TERRAIN_SEQUENCE[index];
        return activeIds.has(id) && bodyTextures[id] ? (
          <pixiSprite
            key={`body-${id}-${index}`}
            ref={(node) => {
              bodySprites.current[index] = node;
            }}
            texture={bodyTextures[id]}
          />
        ) : null;
      })}
    </pixiContainer>
  );
}

interface TransitionLayerProps {
  factor: number;
  progress: number;
  layer:
    | typeof FOREST_MARSH_ZONE.midground
    | typeof FOREST_MARSH_ZONE.detail
    | typeof MOUNTAIN_WASTES_ZONE.midground;
}

/** Une pièce autonome : marges alpha, ancrage au sol et vitesse propres. */
function ParallaxTransitionLayer({
  factor,
  progress,
  layer,
}: TransitionLayerProps) {
  const texture = usePaintedAsset(
    layer.url,
    true,
    false,
    true,
    layer.horizontalFeather,
  );
  const ref = useRef<Sprite>(null);

  useTick(() => {
    const sprite = ref.current;
    if (!sprite) return;

    const centerX = progress * WORLD_LENGTH;
    const screenX = (centerX - scene.camera.x) * factor;

    sprite.visible =
      screenX > -layer.width && screenX < scene.camera.viewW + layer.width;
    sprite.x = centerX * factor;
    sprite.y = surfaceAt(centerX) + layer.yOffset;
    sprite.width = layer.width;
    sprite.height = layer.width / 1.5;
  });

  return texture ? (
    <pixiSprite
      ref={ref}
      texture={texture}
      anchor={{
        x: 0.5,
        y: layer.contentBase,
      }}
    />
  ) : null;
}

export function ParallaxTransitionMidground({ factor }: { factor: number }) {
  return (
    <>
      <ParallaxTransitionLayer
        factor={factor}
        progress={
          (FOREST_MARSH_ZONE.terrainIndex + 0.5) / TERRAIN_SEQUENCE.length
        }
        layer={FOREST_MARSH_ZONE.midground}
      />
      <ParallaxTransitionLayer
        factor={factor}
        progress={MOUNTAIN_WASTES_ZONE.progress}
        layer={MOUNTAIN_WASTES_ZONE.midground}
      />
    </>
  );
}

export function ParallaxTransitionDetails({ factor }: { factor: number }) {
  return (
    <ParallaxTransitionLayer
      factor={factor}
      progress={
        (FOREST_MARSH_ZONE.terrainIndex + 0.5) / TERRAIN_SEQUENCE.length
      }
      layer={FOREST_MARSH_ZONE.detail}
    />
  );
}

export function ParallaxTransitionForeground({ factor }: { factor: number }) {
  const forest = usePaintedAsset(FOREST_MARSH_ZONE.foreground[0].url, true);
  const transition = usePaintedAsset(FOREST_MARSH_ZONE.foreground[1].url, true);
  const marsh = usePaintedAsset(FOREST_MARSH_ZONE.foreground[2].url, true);
  const textures = [forest, transition, marsh];
  const refs = useRef<Array<Sprite | null>>([]);

  useTick(() => {
    const zoneCenter =
      (FOREST_MARSH_ZONE.terrainIndex + 0.5) * TERRAIN_TILE_WIDTH;

    refs.current.forEach((sprite, index) => {
      if (!sprite) return;
      const placement = FOREST_MARSH_ZONE.foreground[index];
      const worldX = zoneCenter + placement.offset * TERRAIN_TILE_WIDTH;
      const screenX = (worldX - scene.camera.x) * factor;

      sprite.visible =
        screenX > -placement.width &&
        screenX < scene.camera.viewW + placement.width;
      sprite.x = worldX * factor;
      sprite.y = scene.camera.y * factor + scene.camera.viewH - 64;
      sprite.width = placement.width;
      sprite.height = placement.width;
    });
  });

  return (
    <pixiContainer alpha={0.94}>
      {textures.map((texture, index) =>
        texture ? (
          <pixiSprite
            key={FOREST_MARSH_ZONE.foreground[index].url}
            ref={(node) => {
              refs.current[index] = node;
            }}
            texture={texture}
            anchor={{ x: 0.5, y: 1 }}
          />
        ) : null,
      )}
    </pixiContainer>
  );
}

/**
 * Surface nette et couvrante. Chaque module possède deux sockets latérales au même
 * niveau ; seul son centre peut remonter. Les bords se touchent avec deux pixels de
 * garde contre les fentes sous-pixel, sans superposer deux murs opaques.
 */
export function ParallaxGroundCover({ factor }: { factor: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackedIndex = useRef(0);
  const activeIds = useMemo(() => {
    const ids = new Set<GroundCoverId>();
    for (let offset = -2; offset <= 2; offset += 1) {
      const index = Math.max(
        0,
        Math.min(WORLD_MODULE_COUNT - 1, activeIndex + offset),
      );
      ids.add(GROUND_COVER_SEQUENCE[index]);
    }
    return ids;
  }, [activeIndex]);
  const textures = useGroundCoverTextures(activeIds);
  const sprites = useRef<Array<Sprite | null>>([]);

  useTick(() => {
    const cameraCenter = scene.camera.x + scene.camera.viewW * 0.5;
    const nextIndex = Math.max(
      0,
      Math.min(
        WORLD_MODULE_COUNT - 1,
        Math.floor(cameraCenter / TERRAIN_TILE_WIDTH),
      ),
    );
    if (nextIndex !== trackedIndex.current) {
      trackedIndex.current = nextIndex;
      setActiveIndex(nextIndex);
    }

    const width = TERRAIN_TILE_WIDTH * factor + 48;
    const height = width / 1.5;
    const visibleLeft = scene.camera.x * factor - width;
    const visibleRight = visibleLeft + scene.camera.viewW + width * 2;

    sprites.current.forEach((sprite, index) => {
      if (!sprite) return;
      const placement = GROUND_COVER_PLACEMENTS[index];
      const definition = GROUND_COVER[placement.id];
      const worldX = (placement.moduleIndex + 0.5) * TERRAIN_TILE_WIDTH;
      const socketWorldY = surfaceAt(
        placement.moduleIndex * TERRAIN_TILE_WIDTH,
      );
      const center = worldX * factor;
      const left = center - width * 0.5;
      sprite.visible = left + width > visibleLeft && left < visibleRight;
      if (!sprite.visible) return;

      sprite.width = width;
      sprite.height = height;
      const mirror = !definition.directional && index % 2 === 1;
      sprite.scale.x = Math.abs(sprite.scale.x) * (mirror ? -1 : 1);
      sprite.x = center;
      sprite.y =
        socketWorldY * factor + 24 - definition.socket * height;
    });
  });

  return (
    <pixiContainer>
      {GROUND_COVER_PLACEMENTS.map((placement, index) => {
        const texture = textures[placement.id];
        return texture ? (
          <pixiSprite
            key={`${placement.moduleIndex}-${placement.id}`}
            ref={(node) => {
              sprites.current[index] = node;
            }}
            texture={texture}
            anchor={{ x: 0.5, y: 0 }}
          />
        ) : null;
      })}
    </pixiContainer>
  );
}

/** Branches proches préfloutées : rares, ancrées hors cadre, jamais flottantes. */
export function ParallaxNearForeground({ factor }: { factor: number }) {
  const textures = useForegroundTextures();
  const root = useRef<Container>(null);
  const sprites = useRef<Array<Sprite | null>>([]);

  useTick((ticker) => {
    const maxWidth = 840;
    const visibleLeft = scene.camera.x * factor - maxWidth;
    const visibleRight = visibleLeft + scene.camera.viewW + maxWidth * 2;
    const breathe = Math.sin(ticker.lastTime * 0.0007) * 2.2;

    if (root.current) root.current.alpha = 0.48;

    sprites.current.forEach((sprite, index) => {
      if (!sprite) return;
      const placement = NEAR_FOREGROUND_PLACEMENTS[index];
      const definition = FOREGROUND[placement.id];
      const width = placement.width;
      const height = width / definition.aspect;
      const center = placement.progress * WORLD_LENGTH * factor;
      const left = center - width * 0.5;
      sprite.visible = left + width > visibleLeft && left < visibleRight;
      if (!sprite.visible) return;

      sprite.width = width;
      sprite.height = height;
      sprite.scale.x = Math.abs(sprite.scale.x) * (placement.mirror ? -1 : 1);
      sprite.x = placement.mirror ? center + width * 0.5 : left;
      sprite.y =
        scene.camera.y * factor +
        scene.camera.viewH +
        80 -
        height * definition.contentBase +
        (placement.y ?? 0) +
        breathe;
    });
  });

  return (
    <pixiContainer ref={root}>
      {NEAR_FOREGROUND_PLACEMENTS.map((placement, index) => {
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
