"use client";

import { useRef } from "react";
import { useTick } from "@pixi/react";
import type { Graphics } from "pixi.js";
import { JOURNEY_TARGET, STEPS_PER_LEVEL } from "@/lib/config";
import {
  BIOMES,
  mixColor,
  paletteAt,
  surfaceAt,
  VIEW,
  WORLD_LENGTH,
} from "@/lib/game/world";
import { scene } from "./scene";
import { atlasFrames, usePaintedAsset } from "./sprites";

/**
 * Le premier plan : la terre foulée par les personnages, le ponton du lac, la
 * taverne d'arrivée et les panneaux qui annoncent les zones.
 *
 * Tout est au facteur 1, donc parfaitement solidaire des personnages. C'est la
 * raison pour laquelle le décor qui doit toucher le sol vit ici, et pas dans une
 * couche de parallaxe.
 */

const biome = (id: string) => BIOMES.find((b) => b.id === id)!;

const LAKE = {
  from: biome("lac").from * WORLD_LENGTH,
  to: biome("lac").to * WORLD_LENGTH,
};

const CASCADE_X =
  ((biome("cascade").from + biome("cascade").to) / 2) * WORLD_LENGTH;

/** Épaisseur de la croûte d'herbe, de vase ou de sable. */
const CRUST = 14;

/* ------------------------------------------------------------------ terrain */

function paintTerrain(g: Graphics) {
  g.clear();

  const step = 26;
  // Les berges mordent légèrement sur le lac, pour venir mourir sous le ponton.
  const submerged = (x: number) => x > LAKE.from + 24 && x < LAKE.to - 24;

  for (let x = -VIEW.width; x <= WORLD_LENGTH + VIEW.width; x += step) {
    if (submerged(x)) continue;

    const palette = paletteAt(Math.max(0, Math.min(WORLD_LENGTH, x)));
    const y0 = surfaceAt(x);
    const y1 = surfaceAt(x + step);
    // Ruban de terrain, volontairement peu profond : le panorama peint reste
    // visible derrière lui et le chemin ne lit plus comme un grand mur gris.
    g.poly(
      [x, y0, x + step, y1, x + step, y1 + 54, x, y0 + 54],
      true,
    ).fill({ color: palette.ground, alpha: 0.82 });

    // Croûte de surface : c'est elle qui donne sa matière au biome.
    g.poly(
      [x, y0, x + step, y1, x + step, y1 + CRUST, x, y0 + CRUST],
      true,
    ).fill(mixColor(palette.ground, palette.near, 0.62));

    // Ombre douce sous la croûte : elle ancre les pieds sans condamner le décor.
    g.poly(
      [x, y0 + 54, x + step, y1 + 54, x + step, y1 + 92, x, y0 + 92],
      true,
    ).fill({
      color: palette.groundDark,
      alpha: 0.2,
    });
  }

  // Sente claire suivie par les personnages, tracée sur la croûte.
  for (let x = 0; x <= WORLD_LENGTH; x += step) {
    if (submerged(x)) continue;

    const palette = paletteAt(x);
    g.moveTo(x, surfaceAt(x) + 3);
    g.lineTo(x + step, surfaceAt(x + step) + 3);
    g.stroke({
      width: 5,
      color: mixColor(palette.ground, 0xffffff, 0.3),
      alpha: 0.5,
    });
  }
}

/* ------------------------------------------------------------------ le lac */

/** Le ponton : c'est lui que foulent les personnages, d'où le biome sans relief. */
function paintBridge(g: Graphics) {
  g.clear();

  const deck = surfaceAt((LAKE.from + LAKE.to) / 2);
  const palette = paletteAt((LAKE.from + LAKE.to) / 2);
  const wood = palette.ground;

  for (let x = LAKE.from; x < LAKE.to; x += 132) {
    g.rect(x + 54, deck + CRUST, 13, 148).fill(mixColor(wood, 0x000000, 0.4));
    g.rect(x + 118, deck + CRUST, 13, 122).fill(mixColor(wood, 0x000000, 0.5));
  }

  g.rect(LAKE.from, deck - 4, LAKE.to - LAKE.from, CRUST + 8).fill(wood);
  g.rect(LAKE.from, deck - 4, LAKE.to - LAKE.from, 5).fill(
    mixColor(wood, 0xffffff, 0.3),
  );

  for (let x = LAKE.from; x < LAKE.to; x += 44) {
    g.rect(x, deck - 4, 3, CRUST + 8).fill({
      color: mixColor(wood, 0x000000, 0.45),
      alpha: 0.6,
    });
  }

  // Garde-corps, côté fond seulement : devant, il masquerait les personnages.
  for (let x = LAKE.from + 20; x < LAKE.to; x += 176) {
    g.rect(x, deck - 78, 9, 78).fill(mixColor(wood, 0x000000, 0.25));
  }
  g.rect(LAKE.from + 20, deck - 78, LAKE.to - LAKE.from - 40, 8).fill(
    mixColor(wood, 0x000000, 0.15),
  );
}

/** L'eau, animée : quelques rides suffisent à la faire vivre. */
function Water() {
  const ref = useRef<Graphics>(null);
  const time = useRef(0);

  // Redessinée à chaque image, donc jamais mémorisée.
  const paint = (g: Graphics) => {
    const { camera } = scene;
    g.clear();

    // Hors champ, on ne dessine rien : inutile de rider un lac invisible.
    const left = Math.max(LAKE.from, camera.x - 200);
    const right = Math.min(LAKE.to, camera.x + camera.viewW + 200);
    if (right <= left) return;

    const palette = paletteAt((LAKE.from + LAKE.to) / 2);
    const top = surfaceAt((LAKE.from + LAKE.to) / 2) + 42;

    g.rect(left, top, right - left, 118).fill({
      color: mixColor(palette.mid, palette.near, 0.45),
      alpha: 0.52,
    });
    g.rect(left, top, right - left, 6).fill(
      mixColor(palette.accent, 0xffffff, 0.35),
    );

    for (let row = 0; row < 5; row++) {
      const y = top + 26 + row * 34;
      const phase = time.current * (0.6 + row * 0.12) + row * 1.7;

      for (let x = left; x < right; x += 96) {
        const wobble = Math.sin(x * 0.02 + phase) * 7;
        g.moveTo(x + wobble, y);
        g.lineTo(x + 52 + wobble, y);
        g.stroke({
          width: 3,
          color: mixColor(palette.accent, 0xffffff, 0.2),
          alpha: 0.3 - row * 0.04,
          cap: "round",
        });
      }
    }
  };

  useTick((ticker) => {
    time.current += ticker.deltaMS / 1000;
    const g = ref.current;
    if (g) paint(g);
  });

  return <pixiGraphics ref={ref} draw={paint} />;
}

/* ------------------------------------------------------------------ la cascade */

/** Grande cascade animée au milieu du voyage : « Les Larmes des Rejetés ». */
function Waterfall() {
  const ref = useRef<Graphics>(null);
  const time = useRef(0);

  const paint = (g: Graphics) => {
    g.clear();
    const t = time.current;
    const base = surfaceAt(CASCADE_X) + 8;
    const top = 176;
    const left = CASCADE_X - 176;
    const right = CASCADE_X + 176;
    const palette = paletteAt(CASCADE_X);
    const cliff = mixColor(palette.near, 0x151c20, 0.36);

    // Deux falaises imbriquées : la base touche franchement le sol, sans rocher flottant.
    g.poly(
      [
        left - 52,
        base,
        left - 28,
        318,
        left + 20,
        top + 28,
        CASCADE_X - 70,
        top,
        CASCADE_X - 46,
        base,
      ],
      true,
    ).fill(cliff);
    g.poly(
      [
        CASCADE_X + 46,
        base,
        CASCADE_X + 70,
        top,
        right - 20,
        top + 38,
        right + 26,
        336,
        right + 54,
        base,
      ],
      true,
    ).fill(mixColor(cliff, 0xffffff, 0.08));

    // Facettes et mousse : le rocher cesse d'être une masse noire uniforme.
    g.poly(
      [left - 28, 318, left + 20, top + 28, CASCADE_X - 92, 338, CASCADE_X - 128, base],
      true,
    ).fill({ color: mixColor(cliff, 0xffffff, 0.13), alpha: 0.62 });
    g.poly(
      [CASCADE_X + 78, top + 18, right - 20, top + 38, right - 56, 366, CASCADE_X + 104, 318],
      true,
    ).fill({ color: mixColor(cliff, 0x000000, 0.22), alpha: 0.5 });
    for (const [x, y, w] of [
      [left + 18, 302, 62],
      [right - 22, 350, 54],
      [left - 4, 430, 76],
    ] as const) {
      g.ellipse(x, y, w, 9).fill({ color: 0x6f8d69, alpha: 0.5 });
    }

    // Bords irréguliers : la chute respire au lieu de lire comme un rectangle bleu.
    const streamTop = top + 20;
    const streamLeft = CASCADE_X - 72;
    const streamRight = CASCADE_X + 72;
    const waterShape: number[] = [];
    for (let y = streamTop; y <= base; y += 34) {
      waterShape.push(
        streamLeft + Math.sin(y * 0.043 + t * 0.7) * 7,
        y,
      );
    }
    for (let y = base; y >= streamTop; y -= 34) {
      waterShape.push(
        streamRight + Math.sin(y * 0.037 + t * 0.62 + 2) * 8,
        y,
      );
    }
    g.poly(waterShape, true).fill({
      color: mixColor(palette.accent, 0x5aa6c2, 0.42),
      alpha: 0.86,
    });

    for (let i = 0; i < 9; i++) {
      const x = streamLeft + 12 + i * 15 + Math.sin(t * 1.7 + i) * 4;
      const offset = (t * (88 + i * 5) + i * 43) % 110;
      for (let y = top - 80 + offset; y < base; y += 110) {
        g.roundRect(x, y, 5 + (i % 3), 48, 4).fill({
          color: i % 2 === 0 ? 0xe8fbff : 0x9ce5ee,
          alpha: 0.42,
        });
      }
    }

    // Vasque, embruns et petites gouttes projetées.
    g.ellipse(CASCADE_X, base + 10, 184, 30).fill({
      color: mixColor(palette.accent, palette.mid, 0.45),
      alpha: 0.84,
    });
    g.ellipse(CASCADE_X, base + 2, 118, 16).fill({ color: 0xe7fbff, alpha: 0.5 });
    for (let i = 0; i < 7; i++) {
      const mistX = CASCADE_X - 132 + i * 44 + Math.sin(t * 0.45 + i) * 12;
      const mistY = base - 5 - (i % 3) * 10;
      g.ellipse(mistX, mistY, 48 + (i % 2) * 20, 14).fill({
        color: 0xe7fbff,
        alpha: 0.1 + (i % 3) * 0.035,
      });
    }
    for (let i = 0; i < 18; i++) {
      const phase = t * (1.1 + (i % 4) * 0.14) + i * 2.13;
      const spread = 42 + (i % 7) * 20;
      const x = CASCADE_X + Math.sin(phase) * spread;
      const y = base - 8 - Math.abs(Math.cos(phase * 1.3)) * (24 + (i % 5) * 9);
      g.circle(x, y, 2 + (i % 3)).fill({ color: 0xe8fbff, alpha: 0.58 });
    }
  };

  useTick((ticker) => {
    time.current += ticker.deltaMS / 1000;
    if (ref.current) {
      paint(ref.current);
    }
  });

  return <pixiGraphics ref={ref} draw={paint} />;
}

/* ------------------------------------------------------------------ coffres */

/** Coffres peints jalonnant la route, tous issus de la même texture GPU. */
export function JourneyMarkers() {
  const sheet = usePaintedAsset("/art/runtime/chest-opening-v2.webp?v=1", true);
  const chest = sheet ? atlasFrames(sheet, 4, 1)[0] : null;

  if (!chest) return null;

  const count = Math.floor(JOURNEY_TARGET / STEPS_PER_LEVEL);
  return (
    <pixiContainer>
      {Array.from({ length: count }, (_, index) => {
        const step = index + 1;
        const x = (step * STEPS_PER_LEVEL * WORLD_LENGTH) / JOURNEY_TARGET;
        const markerX = x > WORLD_LENGTH - 300 ? x - 160 : x + 160;
        return (
          <pixiSprite
            key={step}
            texture={chest}
            anchor={{ x: 0.5, y: 0.8 }}
            x={markerX}
            y={surfaceAt(markerX) + 6}
            width={112}
            height={168}
          />
        );
      })}
    </pixiContainer>
  );
}

/* ------------------------------------------------------------------ assemblage */

export function Ground() {
  return (
    <pixiContainer>
      <Water />
      <pixiGraphics draw={paintTerrain} />
      <pixiGraphics draw={paintBridge} />
      <Waterfall />
      <JourneyMarkers />
    </pixiContainer>
  );
}
