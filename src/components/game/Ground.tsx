"use client";

import { useCallback, useRef } from "react";
import { useTick } from "@pixi/react";
import type { Graphics } from "pixi.js";
import {
  BIOMES,
  mixColor,
  paletteAt,
  surfaceAt,
  VIEW,
  WORLD_LENGTH,
} from "@/lib/game/world";
import { scene, WORLD_BOTTOM } from "./scene";
import { GROUND_PROPS } from "./landscape";
import { drawProp } from "./props";
import { BIOME_SIGN_STYLE } from "./style";

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

const TAVERN_X = 0.955 * WORLD_LENGTH;

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
    const deep = Math.max(y0, y1) + 132;

    // Masse de terre.
    g.poly(
      [x, y0, x + step, y1, x + step, WORLD_BOTTOM, x, WORLD_BOTTOM],
      true,
    ).fill(palette.ground);

    // Croûte de surface : c'est elle qui donne sa matière au biome.
    g.poly(
      [x, y0, x + step, y1, x + step, y1 + CRUST, x, y0 + CRUST],
      true,
    ).fill(mixColor(palette.ground, palette.near, 0.62));

    // Assise sombre, pour que le sol ne paraisse pas plat sur toute sa hauteur.
    g.rect(x, deep, step + 1, WORLD_BOTTOM - deep).fill({
      color: palette.groundDark,
      alpha: 0.55,
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

function paintGroundProps(g: Graphics) {
  g.clear();

  for (const prop of GROUND_PROPS) {
    // Le lac n'a pas de berge à décorer sous le ponton.
    if (prop.worldX > LAKE.from && prop.worldX < LAKE.to) continue;

    const palette = paletteAt(prop.worldX);
    drawProp(g, prop, surfaceAt(prop.worldX) + CRUST * 0.4, {
      color: palette.near,
      dark: mixColor(palette.near, 0x000000, 0.35),
      accent: palette.accent,
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

    g.rect(left, top, right - left, WORLD_BOTTOM - top).fill(
      mixColor(palette.mid, palette.near, 0.45),
    );
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

/* ------------------------------------------------------------------ taverne */

/** La Taverne du Champion, but du voyage. Fenêtres allumées, enseigne dorée. */
function paintTavern(g: Graphics) {
  g.clear();

  const base = surfaceAt(TAVERN_X);
  const palette = paletteAt(TAVERN_X);
  const wall = mixColor(palette.ground, 0xd8c49a, 0.55);
  const beam = mixColor(palette.groundDark, 0x000000, 0.15);
  const width = 300;
  const height = 210;
  const left = TAVERN_X - width / 2;
  const top = base - height;

  g.rect(left, top, width, height).fill(wall);

  // Colombages : quelques poutres suffisent à dire « auberge ».
  for (const x of [left + 22, left + width / 2 - 6, left + width - 34]) {
    g.rect(x, top, 12, height).fill(beam);
  }
  g.rect(left, top + height * 0.52, width, 11).fill(beam);
  g.moveTo(left + 34, top + height * 0.52);
  g.lineTo(left + width / 2 - 6, top + 12);
  g.lineTo(left + width - 34, top + height * 0.52);
  g.stroke({ width: 10, color: beam });

  // Toit débordant.
  g.poly(
    [
      left - 34,
      top + 6,
      TAVERN_X,
      top - 78,
      left + width + 34,
      top + 6,
      left + width + 18,
      top + 22,
      TAVERN_X,
      top - 48,
      left - 18,
      top + 22,
    ],
    true,
  ).fill(mixColor(palette.groundDark, 0x6a3f2a, 0.5));

  // Fenêtres et porte : la lumière chaude est le seul point vif de la nuit.
  for (const x of [left + 52, left + width - 96]) {
    g.rect(x, top + height * 0.62, 46, 40).fill(palette.accent);
    g.rect(x, top + height * 0.62, 46, 40).stroke({ width: 5, color: beam });
  }
  g.roundRect(TAVERN_X - 30, base - 92, 60, 92, 6).fill(beam);
  g.roundRect(TAVERN_X - 22, base - 84, 44, 84, 4).fill(
    mixColor(palette.accent, 0x000000, 0.45),
  );

  // Enseigne suspendue.
  g.rect(left + width + 4, top - 6, 8, 54).fill(beam);
  g.moveTo(left + width + 8, top + 10);
  g.lineTo(left + width + 62, top + 10);
  g.stroke({ width: 5, color: beam });
  g.roundRect(left + width + 30, top + 14, 64, 44, 5).fill(palette.accent);
  g.roundRect(left + width + 30, top + 14, 64, 44, 5).stroke({
    width: 4,
    color: beam,
  });
}

/* ------------------------------------------------------------------ coffres */

/** Coffres jalonnant la route, un par palier de niveau. */
function paintChests(g: Graphics) {
  g.clear();

  const count = 11;

  for (let i = 1; i <= count; i++) {
    const x = (i / (count + 1)) * WORLD_LENGTH;
    const y = surfaceAt(x) + CRUST * 0.5;
    const palette = paletteAt(x);
    const wood = mixColor(palette.groundDark, 0x7a4a24, 0.6);
    const w = 46;
    const h = 30;

    g.rect(x - w / 2, y - h, w, h).fill(wood);
    g.ellipse(x, y - h, w / 2, 13).fill(mixColor(wood, 0xffffff, 0.16));
    g.rect(x - w / 2, y - h - 4, w, 7).fill(palette.accent);
    g.rect(x - 6, y - h - 6, 12, 16).fill(palette.accent);
    g.circle(x, y - h + 4, 3.4).fill(mixColor(palette.accent, 0x000000, 0.5));
  }
}

/* ------------------------------------------------------------------ panneaux */

interface SignProps {
  x: number;
  label: string;
}

/** Panneau de bois planté au seuil de chaque zone. */
function Sign({ x, label }: SignProps) {
  const base = surfaceAt(x);
  const palette = paletteAt(x);

  const paint = useCallback(
    (g: Graphics) => {
      const wood = mixColor(palette.groundDark, 0x8a5a2a, 0.55);
      g.clear();
      g.rect(-6, -92, 12, 92).fill(wood);
      g.roundRect(-104, -148, 208, 62, 7).fill(mixColor(0xe9d5a8, wood, 0.16));
      g.roundRect(-104, -148, 208, 62, 7).stroke({ width: 6, color: wood });
      g.circle(-88, -117, 4).fill(wood);
      g.circle(88, -117, 4).fill(wood);
    },
    [palette.groundDark],
  );

  return (
    <pixiContainer x={x} y={base + 6}>
      <pixiGraphics draw={paint} />
      <pixiText
        text={label}
        style={BIOME_SIGN_STYLE}
        anchor={{ x: 0.5, y: 0.5 }}
        y={-117}
        scale={0.92}
      />
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
      <pixiGraphics draw={paintTavern} />
      <pixiGraphics draw={paintGroundProps} />
      <pixiGraphics draw={paintChests} />
      {BIOMES.map((b) => (
        <Sign
          key={b.id}
          x={Math.max(190, b.from * WORLD_LENGTH + 150)}
          label={b.name}
        />
      ))}
    </pixiContainer>
  );
}
