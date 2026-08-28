"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics, Sprite, Texture } from "pixi.js";
import { biomeAt, surfaceAt, WORLD_LENGTH } from "@/lib/game/world";
import { scene } from "./scene";
import { usePaintedAsset } from "./sprites";

type TerrainId =
  | "grove"
  | "forest"
  | "forestMarsh"
  | "marsh"
  | "bridge"
  | "waterfall"
  | "mountain"
  | "mountainWastes"
  | "wastes"
  | "tavern";

interface TerrainDefinition {
  url: string;
  /** Hauteur de la ligne de marche dans le PNG, en fraction de sa hauteur. */
  ground: number;
}

const TERRAIN: Record<TerrainId, TerrainDefinition> = {
  grove: {
    url: "/art/world-v2/runtime/terrain-grove.webp?v=4",
    ground: 0.605,
  },
  forest: {
    url: "/art/world-v2/runtime/terrain-forest.webp?v=4",
    ground: 0.69,
  },
  forestMarsh: {
    url: "/art/world-v2/runtime/terrain-forest-marsh.webp?v=4",
    ground: 0.65,
  },
  marsh: {
    url: "/art/world-v2/runtime/terrain-marsh.webp?v=4",
    ground: 0.685,
  },
  bridge: {
    url: "/art/world-v2/runtime/terrain-bridge.webp?v=4",
    ground: 0.61,
  },
  waterfall: {
    url: "/art/world-v2/runtime/terrain-waterfall.webp?v=4",
    ground: 0.555,
  },
  mountain: {
    url: "/art/world-v2/runtime/terrain-mountain.webp?v=4",
    ground: 0.675,
  },
  mountainWastes: {
    url: "/art/world-v2/runtime/terrain-mountain-wastes.webp?v=4",
    ground: 0.64,
  },
  wastes: {
    url: "/art/world-v2/runtime/terrain-wastes.webp?v=4",
    ground: 0.585,
  },
  tavern: {
    url: "/art/world-v2/runtime/terrain-tavern.webp?v=4",
    ground: 0.675,
  },
};

/**
 * Une frontière est désormais une vraie portion du pays. La forêt devient humide,
 * le marais devient maçonnerie, puis la neige fond dans la roche ocre. Aucun décor
 * complet n'est superposé à un autre.
 */
const TERRAIN_SEQUENCE: TerrainId[] = [
  "grove",
  "grove",
  "grove",
  "forest",
  "forest",
  "forest",
  "forest",
  "forestMarsh",
  "forestMarsh",
  "marsh",
  "marsh",
  "marsh",
  "bridge",
  "bridge",
  "bridge",
  "waterfall",
  "waterfall",
  "mountain",
  "mountain",
  "mountain",
  "mountain",
  "mountainWastes",
  "mountainWastes",
  "wastes",
  "wastes",
  "wastes",
  "wastes",
  "tavern",
  "tavern",
];

const TERRAIN_TILE_WIDTH = WORLD_LENGTH / TERRAIN_SEQUENCE.length;
const TERRAIN_OVERLAP = 180;

type MidgroundId = "grove" | "marsh" | "alpine" | "wastes";
const MIDGROUND_PLACEMENTS: Array<{
  progress: number;
  id: MidgroundId;
}> = [
  { progress: 0.04, id: "grove" },
  { progress: 0.3, id: "marsh" },
  { progress: 0.56, id: "alpine" },
  { progress: 0.82, id: "wastes" },
];

type ForegroundId = "forest" | "marsh" | "mountain" | "wastes";
const FOREGROUND_PLACEMENTS: Array<{
  progress: number;
  id: ForegroundId;
  mirror?: boolean;
}> = [
  { progress: 0.095, id: "forest" },
  { progress: 0.18, id: "forest", mirror: true },
  { progress: 0.235, id: "forest" },
  { progress: 0.3, id: "marsh" },
  { progress: 0.39, id: "marsh", mirror: true },
  { progress: 0.5, id: "marsh" },
  { progress: 0.61, id: "mountain" },
  { progress: 0.7, id: "mountain", mirror: true },
  { progress: 0.79, id: "wastes" },
  { progress: 0.9, id: "wastes", mirror: true },
];

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
  const forest = usePaintedAsset(
    TERRAIN.forest.url,
    false,
    false,
    active.has("forest"),
  );
  const forestMarsh = usePaintedAsset(
    TERRAIN.forestMarsh.url,
    false,
    false,
    active.has("forestMarsh"),
  );
  const marsh = usePaintedAsset(TERRAIN.marsh.url, false, false, active.has("marsh"));
  const bridge = usePaintedAsset(
    TERRAIN.bridge.url,
    false,
    false,
    active.has("bridge"),
  );
  const waterfall = usePaintedAsset(
    TERRAIN.waterfall.url,
    false,
    false,
    active.has("waterfall"),
  );
  const mountain = usePaintedAsset(
    TERRAIN.mountain.url,
    false,
    false,
    active.has("mountain"),
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
  const tavern = usePaintedAsset(
    TERRAIN.tavern.url,
    false,
    false,
    active.has("tavern"),
  );

  return {
    grove,
    forest,
    forestMarsh,
    marsh,
    bridge,
    waterfall,
    mountain,
    mountainWastes,
    wastes,
    tavern,
  };
}

function useMidgroundTextures(): Record<MidgroundId, Texture | null> {
  const grove = usePaintedAsset("/art/world-v2/runtime/mid-grove.webp?v=5");
  const marsh = usePaintedAsset("/art/world-v2/runtime/mid-marsh.webp?v=5");
  const alpine = usePaintedAsset("/art/world-v2/runtime/mid-alpine.webp?v=5");
  const wastes = usePaintedAsset("/art/world-v2/runtime/mid-wastes.webp?v=5");
  return { grove, marsh, alpine, wastes };
}

function useForegroundTextures(): Record<ForegroundId, Texture | null> {
  const forest = usePaintedAsset("/art/world-v2/runtime/front-forest.webp?v=6");
  const marsh = usePaintedAsset("/art/world-v2/runtime/front-marsh.webp?v=6");
  const mountain = usePaintedAsset("/art/world-v2/runtime/front-mountain.webp?v=6");
  const wastes = usePaintedAsset("/art/world-v2/runtime/front-wastes.webp?v=6");
  return { forest, marsh, mountain, wastes };
}

/** Vallées peintes à 34 % de la vitesse du terrain, devant le ciel animé. */
export function ParallaxBackdrop({ factor }: { factor: number }) {
  const textures = useMidgroundTextures();
  const sprites = useRef<Array<Sprite | null>>([]);

  useTick(() => {
    const layerSpan = WORLD_LENGTH * factor;
    const tileWidth = 1900;
    const tileHeight = tileWidth / 1.5;
    const visibleLeft = scene.camera.x * factor - tileWidth;
    const visibleRight = visibleLeft + scene.camera.viewW + tileWidth * 2;

    sprites.current.forEach((sprite, index) => {
      if (!sprite) return;
      const x = MIDGROUND_PLACEMENTS[index].progress * layerSpan - tileWidth * 0.5;
      sprite.visible = x + tileWidth > visibleLeft && x < visibleRight;
      if (!sprite.visible) return;
      sprite.x = x;
      sprite.y = 568 - tileHeight * 0.75;
      sprite.width = tileWidth;
      sprite.height = tileHeight;
    });
  });

  return (
    <pixiContainer alpha={0.76}>
      {MIDGROUND_PLACEMENTS.map((placement, index) => {
        const texture = textures[placement.id];
        return texture ? (
          <pixiSprite
            key={placement.id}
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
 * La ligne peinte et la ligne physique sont la même coordonnée. Dix unités de
 * chevauchement empêchent un sous-pixel d'ouvrir un jour entre deux pays.
 */
export function ParallaxGround() {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackedIndex = useRef(0);
  const activeIds = useMemo(() => {
    const ids = new Set<TerrainId>();
    const from = Math.max(0, activeIndex - 3);
    const to = Math.min(TERRAIN_SEQUENCE.length - 1, activeIndex + 3);
    for (let index = from; index <= to; index++) ids.add(TERRAIN_SEQUENCE[index]);
    return ids;
  }, [activeIndex]);
  const textures = useTerrainTextures(activeIds);
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
      // Le raccord alpha est préparé sur le bord gauche du fichier. Retourner la
      // texture déplacerait cette lisière du mauvais côté.
      const mirrored = false;

      sprite.visible =
        start + TERRAIN_TILE_WIDTH > visibleLeft && start < visibleRight;
      if (!sprite.visible) return;

      sprite.width = TERRAIN_TILE_WIDTH + TERRAIN_OVERLAP;
      sprite.height = tileHeight;
      sprite.scale.x = Math.abs(sprite.scale.x) * (mirrored ? -1 : 1);
      sprite.x = mirrored
        ? start + TERRAIN_TILE_WIDTH + TERRAIN_OVERLAP * 0.5
        : start - TERRAIN_OVERLAP * 0.5;
      sprite.y =
        surfaceAt(start + TERRAIN_TILE_WIDTH * 0.5) -
        definition.ground * tileHeight;
    });
  });

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
    </pixiContainer>
  );
}

/** Branches et rochers proches : peu nombreux, mais leur vitesse crée le relief. */
export function ParallaxForeground({ factor }: { factor: number }) {
  const textures = useForegroundTextures();
  const root = useRef<Container>(null);
  const sprites = useRef<Array<Sprite | null>>([]);

  useTick((ticker) => {
    const width = 1450;
    const height = width / 1.5;
    const visibleLeft = scene.camera.x * factor - width;
    const visibleRight = visibleLeft + scene.camera.viewW + width * 2;
    const breathe = Math.sin(ticker.lastTime * 0.0007) * 2.2;

    if (root.current) root.current.alpha = 0.9;

    sprites.current.forEach((sprite, index) => {
      if (!sprite) return;
      const placement = FOREGROUND_PLACEMENTS[index];
      const x = placement.progress * WORLD_LENGTH * factor;
      sprite.visible = x + width > visibleLeft && x < visibleRight;
      if (!sprite.visible) return;

      sprite.width = width;
      sprite.height = height;
      sprite.scale.x = Math.abs(sprite.scale.x) * (placement.mirror ? -1 : 1);
      sprite.x = placement.mirror ? x + width : x;
      // La masse opaque reste sous les héros : pas besoin de masquer les bords
      // avec un fondu qui donnait l'impression d'un calque découpé.
      sprite.y = -38 + breathe;
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
  const waterfallX = (15.9 / TERRAIN_SEQUENCE.length) * WORLD_LENGTH;
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
