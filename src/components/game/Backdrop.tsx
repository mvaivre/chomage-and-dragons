"use client";

import { useCallback, useRef } from "react";
import { useTick } from "@pixi/react";
import type { Graphics } from "pixi.js";
import { mixColor, paletteAt, VIEW, WORLD_LENGTH } from "@/lib/game/world";
import { scene, WORLD_BOTTOM } from "./scene";
import type { Prop } from "./landscape";
import { drawProp } from "./props";

/**
 * Le ciel et les crêtes d'arrière-plan.
 *
 * Le ciel est redessiné à chaque image parce qu'il occupe l'écran et doit suivre la
 * couleur du biome courant. Les crêtes, elles, sont tracées une seule fois sur toute
 * la longueur du monde : la caméra ne fait plus que les translater.
 */

/** Nombre de bandes du dégradé du ciel. Assez pour que la transition soit invisible. */
const SKY_BANDS = 30;

export function Sky() {
  const ref = useRef<Graphics>(null);
  const time = useRef(0);

  // Redessiné à chaque image : ne pas mémoriser cette fonction est donc sans coût.
  const paint = (g: Graphics) => {
    const { camera } = scene;
    const palette = paletteAt(camera.x + camera.viewW * 0.5);
    const width = camera.viewW + 4;
    const height = VIEW.height;

    g.clear();

    for (let i = 0; i < SKY_BANDS; i++) {
      const t = i / (SKY_BANDS - 1);
      g.rect(-2, (height / SKY_BANDS) * i - 1, width, height / SKY_BANDS + 2).fill(
        mixColor(palette.sky[0], palette.sky[1], t),
      );
    }

    // Astre bas sur l'horizon : le halo suffit à donner une heure au tableau.
    const sunX = width * 0.74;
    const sunY = height * 0.24;
    g.circle(sunX, sunY, 84).fill({ color: palette.sky[1], alpha: 0.34 });
    g.circle(sunX, sunY, 52).fill({ color: palette.sky[1], alpha: 0.5 });
    g.circle(sunX, sunY, 30).fill({
      color: mixColor(palette.accent, 0xffffff, 0.5),
      alpha: 0.9,
    });

    // Voiles de nuages très lents : ils cassent les aplats et donnent une échelle au
    // voyage sans détourner l'attention des personnages.
    const cloudSpan = width + 420;
    for (let i = 0; i < 6; i++) {
      const raw =
        i * 283 - camera.x * (0.018 + i * 0.002) + time.current * (6 + i * 0.7);
      const x = ((raw % cloudSpan) + cloudSpan) % cloudSpan - 180;
      const y = 92 + (i % 3) * 68 + Math.sin(time.current * 0.14 + i) * 9;
      const cloud = mixColor(palette.sky[1], 0xffffff, 0.52);
      const alpha = 0.1 + (i % 2) * 0.035;
      g.ellipse(x, y, 86, 18).fill({ color: cloud, alpha });
      g.ellipse(x + 54, y - 7, 62, 22).fill({ color: cloud, alpha });
      g.ellipse(x - 52, y + 4, 48, 14).fill({ color: cloud, alpha: alpha * 0.8 });
    }

    // Poussières lumineuses : un mouvement minuscule évite l'impression de décor figé.
    for (let i = 0; i < 20; i++) {
      const x = ((i * 173 + time.current * (5 + (i % 4))) % (width + 80)) - 40;
      const y = 285 + ((i * 71) % 230) + Math.sin(time.current * 0.8 + i) * 14;
      g.circle(x, y, 1.2 + (i % 3) * 0.5).fill({
        color: mixColor(palette.accent, 0xffffff, 0.42),
        alpha: 0.12 + (i % 4) * 0.025,
      });
    }
  };

  useTick((ticker) => {
    time.current += ticker.deltaMS / 1000;
    const g = ref.current;
    if (g) paint(g);
  });

  return <pixiGraphics ref={ref} draw={paint} />;
}

/* ------------------------------------------------------------------ crêtes */

export type PaletteChannel = "far" | "mid" | "near";

interface RidgeLayerProps {
  /** Facteur de parallaxe de la couche. */
  factor: number;
  /** Profil de la crête, interrogé en coordonnées monde. */
  ridge: (worldX: number) => number;
  /** Canal de palette utilisé pour la masse. */
  channel: PaletteChannel;
  /** Fondu vers la couleur du ciel : plus c'est loin, plus c'est délavé. */
  haze: number;
  /** Décor posé sur la crête. */
  props?: Prop[];
}

/**
 * Une crête pleine, découpée en tranches verticales.
 *
 * Une seule forme remplie ne pourrait pas changer de couleur en cours de route :
 * les tranches permettent à chaque portion de prendre la teinte de son biome, et
 * les transitions se font donc toutes seules.
 */
export function RidgeLayer({
  factor,
  ridge,
  channel,
  haze,
  props = [],
}: RidgeLayerProps) {
  const paint = useCallback(
    (g: Graphics) => {
      g.clear();

      const span = WORLD_LENGTH * factor + VIEW.width * 1.4;
      const step = Math.max(3, 26 * factor);

      const inkAt = (worldX: number) => {
        const palette = paletteAt(worldX);
        return {
          color: mixColor(palette[channel], palette.sky[1], haze),
          dark: mixColor(
            mixColor(palette[channel], 0x000000, 0.3),
            palette.sky[1],
            haze,
          ),
          accent: mixColor(palette.accent, palette.sky[1], haze * 0.7),
        };
      };

      for (let x = -VIEW.width * 0.2; x <= span; x += step) {
        const worldX = x / factor;
        const y0 = ridge(worldX);
        const y1 = ridge((x + step) / factor);

        g.poly([x, y0, x + step, y1, x + step, WORLD_BOTTOM, x, WORLD_BOTTOM], true).fill(
          inkAt(worldX).color,
        );
      }

      // Liseré clair sur l'arête : sans lui, les couches se confondent en une bouillie.
      for (let x = -VIEW.width * 0.2; x <= span; x += step) {
        const worldX = x / factor;
        g.moveTo(x, ridge(worldX));
        g.lineTo(x + step, ridge((x + step) / factor));
        g.stroke({
          width: 2.4,
          color: mixColor(inkAt(worldX).color, 0xffffff, 0.22),
        });
      }

      for (const prop of props) {
        drawProp(g, prop, ridge(prop.worldX), inkAt(prop.worldX));
      }
    },
    [factor, ridge, channel, haze, props],
  );

  return <pixiGraphics draw={paint} />;
}
