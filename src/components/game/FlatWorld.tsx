"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import { type Container, type Graphics } from "pixi.js";
import { JOURNEY_TARGET, STEPS_PER_LEVEL } from "@/lib/config";
import {
  BIOMES,
  mixColor,
  paletteAt,
  surfaceAt,
  VIEW,
  WALKABLE_GROUND_Y,
  WORLD_LENGTH,
} from "@/lib/game/world";
import { atlasFrames, useDirectTexture } from "./textures";
import { scene, WORLD_BOTTOM } from "./scene";
import { JourneyChest } from "./JourneyChest";
import { chestXForStep, parallaxX, visibleTiles } from "./projection";

/**
 * Le monde v3 suit un contrat volontairement court :
 *
 *   ciel -> paysage lointain -> paysage proche -> décor derrière le joueur
 *        -> route continue -> joueur -> occultants proches
 *
 * Tous les décors de biome sont des îlots autonomes à bords transparents. Seule la
 * route se répète ; son bord droit est raccordé au suivant par miroir, ce qui rend
 * la couture exacte au lieu d'essayer de la cacher avec un fondu rectangulaire.
 */

export const GROUND_Y = WALKABLE_GROUND_Y;

const ART_ROOT = "/art/world-v3/runtime";

interface BiomeArt {
  far: string;
  back: string;
  mid: string;
  front: string;
}

const WORLD_ART: Record<string, BiomeArt> = Object.fromEntries(
  BIOMES.map((biome) => [
    biome.id,
    {
      far: `${ART_ROOT}/${biome.id}-far.webp`,
      back: `${ART_ROOT}/${biome.id}-back.webp`,
      mid: `${ART_ROOT}/${biome.id}-mid.webp`,
      front: `${ART_ROOT}/${biome.id}-front.webp`,
    },
  ]),
);
WORLD_ART.cascade.back = `${ART_ROOT}/cascade-back-v2.webp`;

/** Only materialize the nearby copies of the itinerary, at each layer's depth. */
export function useLayerBiomes(factor: number, width: number) {
  const measure = () => {
    const center = scene.camera.x + scene.camera.viewW / 2;
    const reach = (scene.camera.viewW / 2 + width / 2 + 400) / factor;
    const first = Math.max(0, Math.floor((center - reach) / WORLD_LENGTH));
    const last = Math.max(0, Math.floor((center + reach) / WORLD_LENGTH));
    const visible: number[] = [];
    for (let cycle = first; cycle <= last; cycle++) {
      BIOMES.forEach((biome, index) => {
        const x = cycle * WORLD_LENGTH + (biome.from + biome.to) * WORLD_LENGTH / 2;
        if (Math.abs(x - center) < reach) visible.push(cycle * BIOMES.length + index);
      });
    }
    return visible.join(",");
  };
  const [key, setKey] = useState(measure);
  useTick(() => {
    const next = measure();
    if (next !== key) setKey(next);
  });
  return useMemo(() => key ? key.split(",").map(Number).map(id => ({
    index: id % BIOMES.length, offset: Math.floor(id / BIOMES.length) * WORLD_LENGTH,
  })) : [], [key]);
}

function LayerSprite({
  url,
  factor,
  bottom,
  width,
  alpha = 1,
  mirror = false,
  worldX,
  frame,
}: {
  url: string;
  factor: number;
  bottom: number;
  width: number;
  alpha?: number;
  mirror?: boolean;
  worldX: number;
  frame?: number;
}) {
  const source = useDirectTexture(url);
  const texture = source && frame !== undefined ? atlasFrames(source, 4, 2)[frame] : source;
  const node = useRef<Container>(null);
  useTick(() => {
    if (!node.current) return;
    const x = parallaxX(worldX, scene.camera.x, scene.camera.viewW, factor);
    node.current.visible = x + width / 2 > -80 && x - width / 2 < scene.camera.viewW + 80;
  });

  if (!texture) return null;
  const height = (width * texture.height) / texture.width;

  return (
    <pixiContainer
      ref={node}
      x={worldX * factor}
      y={bottom}
    >
      <pixiContainer alpha={alpha} scale={{ x: mirror ? -1 : 1, y: 1 }}>
        <pixiSprite
          texture={texture}
          anchor={{ x: 0.5, y: 1 }}
          width={width}
          height={height}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

type ArtChannel = keyof BiomeArt;

/** Load the projected visible interval, which is wider for distant layers. */
export function BiomeArtLayer({
  channel,
  factor,
  bottom,
  width,
  alpha,
}: {
  channel: ArtChannel;
  factor: number;
  bottom: number;
  width: number;
  alpha: number;
}) {
  const indices = useLayerBiomes(factor, width);

  return (
    <pixiContainer>
      {indices.flatMap(({ index, offset: cycleOffset }) => {
        const biome = BIOMES[index];
        const center = cycleOffset + ((biome.from + biome.to) * WORLD_LENGTH) / 2;
        const offsets = index === 0 && cycleOffset === 0 ? [-width * 0.8 / factor, 0] : [0];
        return offsets.map(offset => (
          <LayerSprite
            key={`${channel}-${cycleOffset}-${biome.id}-${offset}`}
            url={WORLD_ART[biome.id][channel]}
            factor={factor}
            bottom={bottom}
            width={width}
            alpha={alpha}
            worldX={center + offset}
            mirror={(index % 2 === 1) !== (offset !== 0)}
          />
        ));
      })}
    </pixiContainer>
  );
}

/** Le décor proche derrière le joueur reste ponctuel : il n'a aucune couture à tenir. */
export function MidgroundLayer({ factor }: { factor: number }) {
  const indices = useLayerBiomes(factor, 820);

  return (
    <pixiContainer>
      {indices.map(({ index, offset: cycleOffset }) => {
        const biome = BIOMES[index];
        const center = cycleOffset + ((biome.from + biome.to) * WORLD_LENGTH) / 2;
        return (
          <LayerSprite
            key={`mid-${cycleOffset}-${biome.id}`}
            url={WORLD_ART[biome.id].mid}
            factor={factor}
            bottom={GROUND_Y + 100}
            width={820}
            alpha={1}
            worldX={center}
          />
        );
      })}
    </pixiContainer>
  );
}

const TRANSITION_ART = Array.from(
  { length: BIOMES.length - 1 },
  (_, index) => `${ART_ROOT}/transition-${index + 1}.webp`,
);

function TransitionLandmark({ boundaryIndex, offset }: { boundaryIndex: number; offset: number }) {
  const texture = useDirectTexture(TRANSITION_ART[boundaryIndex]);
  if (!texture) return null;

  const height = boundaryIndex === 5 ? 460 : 400;
  const width = (height * texture.width) / texture.height;
  const x = offset + BIOMES[boundaryIndex].to * WORLD_LENGTH;
  return (
    <pixiSprite
      texture={texture}
      anchor={{ x: 0.5, y: 1 }}
      x={x}
      y={GROUND_Y + 32}
      width={width}
      height={height}
      alpha={1}
    />
  );
}

/** Landmark autonome derrière le joueur : il transforme la frontière en lieu. */
export function TransitionLandmarks() {
  const indices = useLayerBiomes(1, 1800);
  return <pixiContainer>{indices.filter(({ index }) => index < TRANSITION_ART.length)
    .map(({ index, offset }) => <TransitionLandmark key={`${offset}-${index}`} boundaryIndex={index} offset={offset} />)}</pixiContainer>;
}

/**
 * Matière sous la route. Elle évite tout vide sur les écrans portrait sans étirer
 * une immense image : l'essentiel de la texture reste le ruban net au niveau des pieds.
 */
const paintUnderworld = (g: Graphics) => {
  g.clear();
  g.rect(0, GROUND_Y + 158, 2048, WORLD_BOTTOM - GROUND_Y + 980).fill(
    0x241d17,
  );

  for (let x = 0; x < 2048; x += 86) {
    const y = GROUND_Y + 210 + ((x * 17) % 190 + 190) % 190;
    g.ellipse(x + 30, y, 20 + (Math.abs(x) % 19), 8).stroke({
      width: 2,
      color: 0x4c3a29,
      alpha: 0.42,
    });
  }
};

function useStripTiles(tileWidth: number, factor = 1) {
  const measure = () => visibleTiles(scene.camera.x * factor - scene.camera.viewW * (1 - factor) / 2, scene.camera.viewW, tileWidth, -VIEW.width);
  const [range, setRange] = useState(measure);
  const previous = useRef(range);
  useTick(() => {
    const next = measure();
    if (next[0] === previous.current[0] && next[1] === previous.current[1]) return;
    previous.current = next;
    setRange(next);
  });
  return useMemo(() => Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i), [range]);
}

function RoadStrip() {
  const texture = useDirectTexture(`${ART_ROOT}/road-universal.webp`);
  const indices = useStripTiles(texture?.width ?? 1672);
  if (!texture) return null;

  const tileWidth = texture.width;

  return (
    <pixiContainer>
      {indices.map((index) => {
        const start = -VIEW.width + index * tileWidth;
        const mirrored = Math.abs(index % 2) === 1;
        return (
          <pixiSprite
            key={index}
            texture={texture}
            x={mirrored ? start + tileWidth : start}
            y={GROUND_Y}
            scale={{ x: mirrored ? -1 : 1, y: 1 }}
          />
        );
      })}
    </pixiContainer>
  );
}

function VergeStrip() {
  const texture = useDirectTexture(`${ART_ROOT}/verge-universal.webp`);
  const indices = useStripTiles(texture?.width ?? 2065);
  if (!texture) return null;

  const tileWidth = texture.width;
  return (
    <pixiContainer>
      {indices.map((index) => {
        const start = -VIEW.width + index * tileWidth;
        const mirrored = Math.abs(index % 2) === 1;
        return (
          <pixiSprite
            key={index}
            texture={texture}
            x={mirrored ? start + tileWidth : start}
            y={GROUND_Y + 8 - texture.height}
            scale={{ x: mirrored ? -1 : 1, y: 1 }}
          />
        );
      })}
    </pixiContainer>
  );
}

interface JourneyMarkersProps {
  journeySteps: number;
  pendingChestStep: number | null;
  activeChestX: number | null;
}

export function FlatJourneyMarkers({ journeySteps, pendingChestStep, activeChestX }: JourneyMarkersProps) {
  const spacing = WORLD_LENGTH * STEPS_PER_LEVEL / JOURNEY_TARGET;
  const indices = useStripTiles(spacing);
  return <pixiContainer>{indices.map(index => {
    const step = index * STEPS_PER_LEVEL;
    if (step <= 0) return null;
    const x = chestXForStep(step, WORLD_LENGTH, JOURNEY_TARGET);
    if (activeChestX !== null && Math.abs(x - activeChestX) < 1) return null;
    const pending = pendingChestStep !== null && pendingChestStep === step;
    return <JourneyChest key={step} x={x} y={surfaceAt(x) + 8} opened={journeySteps >= step && !pending} />;
  })}</pixiContainer>;
}

export function GroundLayer(props: JourneyMarkersProps) {
  const tiles = useStripTiles(2048);
  return <pixiContainer>
    {tiles.map(index => <pixiGraphics key={index} x={-VIEW.width + index * 2048} draw={paintUnderworld} />)}
    <VergeStrip />
    <RoadStrip />
    <FlatJourneyMarkers {...props} />
  </pixiContainer>;
}

/**
 * Deux occurrences espacées par biome donnent des passages devant la caméra sans
 * fabriquer un mur permanent. Leur base reste profondément sous le niveau des pieds.
 */
export function NearForegroundLayer({ factor }: { factor: number }) {
  const indices = useLayerBiomes(factor, 1800);

  return (
    <pixiContainer>
      {indices.flatMap(({ index, offset: cycleOffset }) => {
        const biome = BIOMES[index];
        const span = (biome.to - biome.from) * WORLD_LENGTH;
        const start = cycleOffset + biome.from * WORLD_LENGTH;
        return [0.28, 0.78].map((ratio, occurrence) => (
          <LayerSprite
            key={`front-${cycleOffset}-${biome.id}-${occurrence}`}
            url={`${ART_ROOT}/ground-props.webp`}
            frame={index}
            factor={factor}
            bottom={GROUND_Y + 166}
            width={180}
            alpha={1}
            worldX={start + span * ratio}
            mirror={(index + occurrence) % 2 === 1}
          />
        ));
      })}
    </pixiContainer>
  );
}

/** A handful of cached shapes; only their transforms move in the ticker. */
const drawMote = (g: Graphics) => { g.clear().circle(0, 0, 1.5).fill(0xf7e6b3); };
export function PaperMotes() {
  const ref = useRef<Container>(null);
  const time = useRef(0);
  useTick((ticker) => {
    time.current += Math.min(60, ticker.deltaMS) / 1000;
    const camera = scene.camera;
    ref.current?.children.forEach((node, i) => {
      const span = camera.viewW + 100;
      const raw = i * 173 - camera.x * 0.035 + time.current * (4 + i % 4);
      node.position.set(((raw % span) + span) % span - 50, 260 + (i * 79) % 280 + Math.sin(time.current + i) * 7);
    });
  });
  return <pixiContainer ref={ref} alpha={0.22}>
    {Array.from({ length: 8 }, (_, index) => <pixiGraphics key={index} draw={drawMote} />)}
  </pixiContainer>;
}

/** Continuous opaque silhouettes support the cutout islands down to the road. */
function LandscapeTile({ factor, channel, offset }: { factor: number; channel: "far" | "mid"; offset: number }) {
  const paint = useCallback((g: Graphics) => {
    g.clear();
    const step = 32;
    const ridge = (x: number) => GROUND_Y - (channel === "far" ? 90 : 15) + Math.sin(x * 0.008) * 18 + Math.sin(x * 0.021) * 7;
    for (let x = 0; x < 2048; x += step) {
      const palette = paletteAt((offset + x) / factor);
      g.poly([x, ridge(offset + x), x + step, ridge(offset + x + step), x + step, WORLD_BOTTOM, x, WORLD_BOTTOM]).fill(
        mixColor(palette[channel], palette.sky[1], channel === "far" ? 0.32 : 0.08),
      );
    }
  }, [factor, channel, offset]);
  return <pixiGraphics x={offset} draw={paint} />;
}

export function LandscapeBase({ factor, channel }: { factor: number; channel: "far" | "mid" }) {
  const tiles = useStripTiles(2048, factor);
  return <pixiContainer>{tiles.map(index => <LandscapeTile key={index} factor={factor} channel={channel} offset={-VIEW.width + index * 2048} />)}</pixiContainer>;
}
