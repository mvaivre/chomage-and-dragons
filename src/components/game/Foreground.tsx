"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Texture } from "pixi.js";
import { BIOMES, biomeAt, mixColor, WORLD_LENGTH, type Biome } from "@/lib/game/world";
import { useSceneTick as useTick } from "./useSceneTick";
import { scene } from "./scene";

/**
 * Out-of-focus vegetation between the camera and the road. Two planes scroll
 * faster than the ground, pinned to the bottom of the clear window above the
 * dock: tufts that are slightly soft, and closer silhouettes, large, dark and
 * very blurred. Both stay low and sparse, framing the road without ever
 * covering a hero's body. Each tuft is painted once per biome on a small
 * canvas; the GPU only scales it.
 */

export interface ForegroundPlane {
  id: string;
  /** Height of the continuous bank of earth the tufts grow from; 0 for none. */
  bank: number;
  factor: number;
  /** Distance between two candidate tufts, in the plane's own units. */
  spacing: number;
  /** Share of candidates left empty. */
  gaps: number;
  /** Displayed width of a tuft, in world units; the height follows. */
  width: [number, number];
  /** Height over width of the painted tuft. */
  aspect: number;
  /** The tuft is painted this many times smaller, then scaled up by the GPU. */
  shrink: number;
  /** Blur radius in the small canvas's pixels. */
  radius: number;
  /** How far the tufts' feet sink below the clear window, behind the dock. */
  sink: number;
  /** 0 keeps the biome's colours and ink, 1 turns the tuft into a dark silhouette. */
  shadow: number;
  seed: number;
}

export const NEAR_PLANE: ForegroundPlane = {
  id: "near", bank: 46, factor: 1.32, spacing: 700, gaps: 0.2, width: [220, 300], aspect: 0.55,
  shrink: 1.5, radius: 0.9, sink: 34, shadow: 0, seed: 11,
};
export const CLOSE_PLANE: ForegroundPlane = {
  id: "close", bank: 0, factor: 1.8, spacing: 1350, gaps: 0.4, width: [420, 560], aspect: 0.6,
  shrink: 5, radius: 2.6, sink: 150, shadow: 0.72, seed: 29,
};

type Kind = "grass" | "fern" | "reed" | "dry";

/** What grows in front of each land. */
const FLORA: Record<string, Kind[]> = {
  plaine: ["grass", "grass", "fern"],
  foret: ["fern", "grass", "fern"],
  marais: ["reed", "grass", "reed"],
  lac: ["reed", "grass", "grass"],
  cascade: ["fern", "reed", "grass"],
  montagne: ["dry", "grass", "dry"],
  desert: ["dry", "dry", "grass"],
  taverne: ["grass", "fern", "grass"],
};
const VARIANTS = 3;

const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** A small seeded generator: the same tuft is painted identically on every device. */
function generator(seed: number) {
  let state = Math.abs(Math.floor(seed)) % 233280;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/** One tapered, bending blade from (x, base) up to its tip, inked like the rest of the art when asked. */
function blade(context: CanvasRenderingContext2D, x: number, base: number, height: number, width: number, bend: number, inked: boolean) {
  context.beginPath();
  context.moveTo(x - width / 2, base);
  context.quadraticCurveTo(x - width / 3 + bend * 0.2, base - height * 0.55, x + bend, base - height);
  context.quadraticCurveTo(x + width / 3 + bend * 0.35, base - height * 0.5, x + width / 2, base);
  context.closePath();
  context.fill();
  if (inked) context.stroke();
}

function daisy(context: CanvasRenderingContext2D, x: number, y: number, size: number, petals: string, heart: string) {
  context.fillStyle = petals;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    context.beginPath();
    context.ellipse(x + Math.cos(angle) * size * 0.7, y + Math.sin(angle) * size * 0.7, size * 0.62, size * 0.36, angle, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.fillStyle = heart;
  context.beginPath();
  context.arc(x, y, size * 0.45, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

function paintTuft(context: CanvasRenderingContext2D, width: number, height: number, kind: Kind, biome: Biome, shadow: number, seed: number) {
  const random = generator(seed);
  const { near, mid, accent, groundDark } = biome.palette;
  const night = 0x0d0f0b;
  // The soft plane keeps the art's ink and colours; the close one is only a silhouette.
  const inked = shadow < 0.5;
  const back = inked ? mixColor(near, night, 0.2) : mixColor(near, night, 0.72);
  const body = inked ? mixColor(near, mid, 0.55) : mixColor(near, night, 0.62);
  const light = inked ? mixColor(mid, 0xf2e6b0, 0.3) : mixColor(mid, night, 0.6);
  const straw = inked ? 0xc9a45c : mixColor(0xc9a45c, night, 0.66);
  const base = height - 2;
  const thick = inked ? 1 : 1.9;
  context.strokeStyle = "#20201d";
  context.lineWidth = 2.6;
  context.lineJoin = "round";

  // A low mound of earth and leaves holds the tuft together.
  context.fillStyle = css(mixColor(groundDark, night, inked ? 0.1 : 0.6));
  context.beginPath();
  context.ellipse(width / 2, base, width * 0.42, height * (inked ? 0.1 : 0.2), 0, 0, Math.PI * 2);
  context.fill();

  const blades = kind === "dry" ? 24 : kind === "reed" ? 15 : 20;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < blades; i++) {
      context.fillStyle = css(layer === 0 ? back : kind === "dry" ? straw : random() < 0.3 ? light : body);
      const spread = (random() - 0.5) * width * 0.78;
      const tall = kind === "reed" ? 0.7 + random() * 0.3 : 0.35 + random() * 0.55;
      const lean = spread / (width * 0.4);
      const bladeWidth = (kind === "dry" ? 5 : kind === "reed" ? 10 : 13) * thick * (0.7 + random() * 0.6) * (layer === 0 ? 1.2 : 1);
      blade(context, width / 2 + spread, base, height * tall * (1 - Math.abs(lean) * 0.35), bladeWidth, lean * height * 0.28 + (random() - 0.5) * 18, inked);
    }
  }

  if (kind === "fern") {
    for (let frond = 0; frond < 4; frond++) {
      const side = frond % 2 ? 1 : -1;
      const reach = width * (0.18 + random() * 0.16);
      const rise = height * (0.55 + random() * 0.3);
      const x0 = width / 2 + (random() - 0.5) * width * 0.2;
      for (let leaf = 1; leaf <= 9; leaf++) {
        const t = leaf / 10;
        const x = x0 + side * reach * t * t;
        const y = base - rise * t;
        context.fillStyle = css(leaf % 2 ? body : light);
        for (const tilt of [side * (0.9 - t * 0.6), -side * (0.4 + t * 0.4)]) {
          context.beginPath();
          context.ellipse(x, y, 12 * thick * (1 - t * 0.6), 5 * thick * (1 - t * 0.5), tilt, 0, Math.PI * 2);
          context.fill();
          if (inked) context.stroke();
        }
      }
    }
  }

  if (kind === "reed") {
    context.fillStyle = css(inked ? 0x7a4e2a : mixColor(0x6b4424, night, 0.66));
    for (let i = 0; i < 3; i++) {
      context.beginPath();
      context.ellipse(width / 2 + (random() - 0.5) * width * 0.5, base - height * (0.72 + random() * 0.2), 7, 18, (random() - 0.5) * 0.3, 0, Math.PI * 2);
      context.fill();
      if (inked) context.stroke();
    }
  } else if (kind !== "dry" && inked) {
    for (let i = 0; i < 3; i++) {
      daisy(context, width / 2 + (random() - 0.5) * width * 0.55, base - height * (0.3 + random() * 0.35), 9 + random() * 4,
        i === 1 ? css(mixColor(accent, 0xffffff, 0.2)) : "#f4efe0", css(accent));
    }
  }
}

const painted = new Map<string, Texture>();
/** Room around the painted tuft for the blur to fade out. */
const padding = (radius: number) => Math.ceil(radius * 3);
/** Width of the sharp painting, before it is shrunk and blurred. */
const PAINT_WIDTH = 320;

/** One tuft per biome, plane and variant: painted, shrunk and blurred once, then kept. */
function tuftTexture(plane: ForegroundPlane, biome: Biome, variant: number): Texture {
  const key = `${plane.id}:${biome.id}:${variant}`;
  const cached = painted.get(key);
  if (cached && !cached.destroyed) return cached;
  const width = Math.round(PAINT_WIDTH / plane.shrink);
  const height = Math.round(width * plane.aspect);
  const pad = padding(plane.radius);
  const sharp = document.createElement("canvas");
  sharp.width = PAINT_WIDTH;
  sharp.height = Math.round(PAINT_WIDTH * plane.aspect);
  const soft = document.createElement("canvas");
  soft.width = width + pad * 2;
  soft.height = height + pad * 2;
  const sharpContext = sharp.getContext("2d");
  const softContext = soft.getContext("2d");
  if (!sharpContext || !softContext) return Texture.EMPTY;
  const kind = (FLORA[biome.id] ?? FLORA.plaine)[variant % VARIANTS];
  paintTuft(sharpContext, sharp.width, sharp.height, kind, biome, plane.shadow, plane.seed * 31 + BIOMES.indexOf(biome) * 7 + variant);
  softContext.imageSmoothingQuality = "high";
  // Browsers without canvas filters still get the softness of the upscaled small copy.
  if ("filter" in softContext) softContext.filter = `blur(${plane.radius}px)`;
  softContext.drawImage(sharp, pad, pad, width, height);
  const texture = Texture.from(soft);
  painted.set(key, texture);
  return texture;
}

/** Width of one tile of the bank, in world units; its edge wave repeats exactly on it. */
const BANK_TILE = 1024;
let bankTexture: Texture | null = null;

/** A soft bank of dark earth along the bottom of the window: the ground the camera stands on. */
function bank(): Texture {
  if (bankTexture && !bankTexture.destroyed) return bankTexture;
  const width = BANK_TILE / 2;
  const height = 48;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return Texture.EMPTY;
  const edge = (x: number) => 12 + Math.sin((x / width) * Math.PI * 2 * 3) * 4 + Math.sin((x / width) * Math.PI * 2 * 7 + 1) * 2.5;
  if ("filter" in context) context.filter = "blur(1.6px)";
  const fill = context.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, "#3a2c1f");
  fill.addColorStop(0.5, "#251c14");
  fill.addColorStop(1, "#18120d");
  context.fillStyle = fill;
  context.beginPath();
  // Start and end beyond the tile so the blur does not fade its sides.
  context.moveTo(-8, height + 8);
  for (let x = -8; x <= width + 8; x += 4) context.lineTo(x, edge(x));
  context.lineTo(width + 8, height + 8);
  context.closePath();
  context.fill();
  // A few pebbles catch the light on the lip.
  context.fillStyle = "#5a4633";
  for (let i = 0; i < 9; i++) {
    const x = ((i * 157) % width) + 10;
    context.beginPath();
    context.ellipse(x, edge(x) + 6, 7 + (i % 3) * 3, 3.5, 0, 0, Math.PI * 2);
    context.fill();
  }
  bankTexture = Texture.from(canvas);
  return bankTexture;
}

/** Deterministic noise per candidate: the same tuft comes back when the camera does. */
function noise(index: number, seed: number, channel: number): number {
  const value = Math.sin(index * 127.1 + seed * 311.7 + channel * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

interface Placed {
  key: number;
  x: number;
  biome: Biome;
  variant: number;
  width: number;
  mirror: boolean;
}

function place(plane: ForegroundPlane, index: number): Placed | null {
  if (noise(index, plane.seed, 0) < plane.gaps) return null;
  const x = index * plane.spacing + (noise(index, plane.seed, 1) - 0.5) * plane.spacing * 0.5;
  const worldX = x / plane.factor;
  if (worldX < -200) return null;
  const [min, max] = plane.width;
  return {
    key: index,
    x,
    biome: biomeAt(((worldX % WORLD_LENGTH) + WORLD_LENGTH) % WORLD_LENGTH),
    variant: Math.floor(noise(index, plane.seed, 4) * VARIANTS),
    width: min + (max - min) * noise(index, plane.seed, 2),
    mirror: noise(index, plane.seed, 3) < 0.5,
  };
}

/** Paint every tuft of the plane in idle time, one per callback, so a new land never costs a frame. */
function useIdlePainting(plane: ForegroundPlane) {
  useEffect(() => {
    const queue = BIOMES.flatMap((biome) => Array.from({ length: VARIANTS }, (_, variant) => [biome, variant] as const));
    const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 60));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    let handle = 0;
    const next = () => {
      const job = queue.shift();
      if (!job) return;
      tuftTexture(plane, job[0], job[1]);
      handle = idle(next);
    };
    handle = idle(next);
    return () => cancel(handle);
  }, [plane]);
}

function ForegroundPlaneLayer({ plane }: { plane: ForegroundPlane }) {
  useIdlePainting(plane);
  const measure = () => {
    // The plane's container sits at parallaxX(0): its visible interval in its own units.
    const left = (scene.camera.x + scene.camera.viewW / 2) * plane.factor - scene.camera.viewW / 2;
    const reach = plane.width[1];
    return `${Math.floor((left - reach) / plane.spacing)}:${Math.floor((left + scene.camera.viewW + reach) / plane.spacing)}`;
  };
  const [range, setRange] = useState(measure);
  const last = useRef(range);
  useTick(() => {
    const next = measure();
    if (next === last.current) return;
    last.current = next;
    setRange(next);
  });
  const placed = useMemo(() => {
    const [first, final] = range.split(":").map(Number);
    const list: Placed[] = [];
    for (let index = first; index <= final; index++) {
      const tuft = place(plane, index);
      if (tuft) list.push(tuft);
    }
    return list;
  }, [range, plane]);

  const pad = padding(plane.radius);
  const [first, final] = range.split(":").map(Number);
  const tiles: number[] = [];
  if (plane.bank) {
    for (let tile = Math.floor(first * plane.spacing / BANK_TILE) - 1; tile <= Math.ceil(final * plane.spacing / BANK_TILE) + 1; tile++) tiles.push(tile);
  }
  return <pixiContainer>
    {tiles.map((tile) => <pixiSprite key={`bank-${tile}`} texture={bank()} x={tile * BANK_TILE} y={plane.sink - plane.bank} width={BANK_TILE + 1} height={plane.bank * 2} />)}
    {placed.map((tuft) => {
      const texture = tuftTexture(plane, tuft.biome, tuft.variant);
      // The blur's padding surrounds the painted tuft: scale by the tuft, stand it on its base.
      const scale = tuft.width / (texture.width - pad * 2);
      return <pixiSprite
        key={tuft.key}
        texture={texture}
        x={tuft.x}
        y={plane.sink - plane.bank * 0.4}
        anchor={{ x: 0.5, y: (texture.height - pad) / texture.height }}
        scale={{ x: tuft.mirror ? -scale : scale, y: scale }}
      />;
    })}
  </pixiContainer>;
}

/** Static until the camera brings new tufts into view. */
export const Foreground = memo(ForegroundPlaneLayer);
