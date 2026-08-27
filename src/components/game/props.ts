import type { Graphics } from "pixi.js";
import { mixColor } from "@/lib/game/world";
import { seededRandom } from "@/lib/rng";
import type { Prop, PropKind } from "./landscape";

/**
 * L'inventaire dessiné du décor.
 *
 * Chaque élément est tracé dans le repère du monde, posé sur `y`. Les couleurs
 * arrivent de l'extérieur pour que la même forme serve à la couche proche, bien
 * contrastée, comme à la couche intermédiaire, plus pâle et plus petite.
 */

export interface PropInk {
  color: number;
  dark: number;
  accent: number;
}

const lighten = (c: number, t: number) => mixColor(c, 0xffffff, t);

type Drawer = (
  g: Graphics,
  x: number,
  y: number,
  s: number,
  ink: PropInk,
  random: () => number,
) => void;

const sapin: Drawer = (g, x, y, s, ink, random) => {
  const height = (86 + random() * 46) * s;
  const width = height * 0.44;

  g.rect(x - 3 * s, y - height * 0.24, 6 * s, height * 0.26).fill(ink.dark);

  // Trois étages qui se chevauchent : la silhouette lit mieux qu'un seul triangle.
  for (let i = 0; i < 3; i++) {
    const top = y - height + (height * 0.3 * i) / 1.4;
    const spread = (width / 2) * (0.55 + i * 0.26);
    const bottom = top + height * 0.42;
    g.poly([x, top, x + spread, bottom, x - spread, bottom], true).fill(
      i === 0 ? lighten(ink.color, 0.1) : ink.color,
    );
  }
};

const feuillu: Drawer = (g, x, y, s, ink, random) => {
  const height = (74 + random() * 30) * s;
  g.rect(x - 4 * s, y - height * 0.42, 8 * s, height * 0.44).fill(ink.dark);

  const crown = y - height * 0.62;
  const r = height * 0.3;
  g.circle(x - r * 0.55, crown + r * 0.2, r * 0.78).fill(ink.color);
  g.circle(x + r * 0.6, crown + r * 0.3, r * 0.7).fill(ink.color);
  g.circle(x, crown - r * 0.25, r * 0.86).fill(lighten(ink.color, 0.12));
};

const fougere: Drawer = (g, x, y, s, ink, random) => {
  const blades = 5;
  const height = (26 + random() * 16) * s;

  for (let i = 0; i < blades; i++) {
    const lean = (i / (blades - 1) - 0.5) * 2;
    g.moveTo(x, y);
    g.quadraticCurveTo(
      x + lean * height * 0.7,
      y - height * 0.7,
      x + lean * height * 1.25,
      y - height * (0.35 + Math.abs(lean) * 0.1),
    );
    g.stroke({
      width: 3.2 * s,
      color: i % 2 === 0 ? ink.color : lighten(ink.color, 0.14),
      cap: "round",
    });
  }
};

const champignon: Drawer = (g, x, y, s, ink, random) => {
  const height = (14 + random() * 8) * s;
  g.rect(x - 2.2 * s, y - height, 4.4 * s, height).fill(lighten(ink.color, 0.45));
  g.ellipse(x, y - height, height * 0.72, height * 0.5).fill(ink.accent);
  g.circle(x - height * 0.24, y - height * 1.05, 1.6 * s).fill(0xfff4dc);
  g.circle(x + height * 0.3, y - height * 0.9, 1.3 * s).fill(0xfff4dc);
};

const souche: Drawer = (g, x, y, s, ink, random) => {
  const height = (16 + random() * 8) * s;
  const width = height * 1.05;
  g.poly(
    [
      x - width * 0.5,
      y,
      x - width * 0.42,
      y - height,
      x + width * 0.42,
      y - height,
      x + width * 0.5,
      y,
    ],
    true,
  ).fill(ink.dark);
  g.ellipse(x, y - height, width * 0.42, height * 0.24).fill(
    lighten(ink.dark, 0.3),
  );
};

const roseau: Drawer = (g, x, y, s, ink, random) => {
  const stems = 4 + Math.floor(random() * 3);
  for (let i = 0; i < stems; i++) {
    const height = (34 + random() * 30) * s;
    const dx = (i - stems / 2) * 5 * s;
    const lean = (random() - 0.5) * height * 0.4;

    g.moveTo(x + dx, y);
    g.quadraticCurveTo(x + dx + lean * 0.4, y - height * 0.6, x + dx + lean, y - height);
    g.stroke({ width: 2.4 * s, color: ink.color, cap: "round" });

    if (random() > 0.45) {
      g.ellipse(x + dx + lean, y - height - 3 * s, 2.4 * s, 6 * s).fill(ink.dark);
    }
  }
};

const arbreMort: Drawer = (g, x, y, s, ink, random) => {
  const height = (92 + random() * 40) * s;
  g.moveTo(x, y);
  g.quadraticCurveTo(x + 6 * s, y - height * 0.6, x - 2 * s, y - height);
  g.stroke({ width: 7 * s, color: ink.dark, cap: "round" });

  for (let i = 0; i < 3; i++) {
    const at = y - height * (0.5 + i * 0.18);
    const dir = i % 2 === 0 ? 1 : -1;
    g.moveTo(x, at);
    g.quadraticCurveTo(
      x + dir * 20 * s,
      at - 6 * s,
      x + dir * 34 * s,
      at - 22 * s,
    );
    g.stroke({ width: 3.4 * s, color: ink.dark, cap: "round" });
  }
};

const nenuphar: Drawer = (g, x, y, s, ink, random) => {
  const r = (12 + random() * 7) * s;
  g.ellipse(x, y - 2 * s, r, r * 0.34).fill(ink.color);
  g.ellipse(x + r * 0.9, y - 1 * s, r * 0.6, r * 0.22).fill(lighten(ink.color, 0.1));
  if (random() > 0.6) {
    g.circle(x - r * 0.3, y - 7 * s, 3.4 * s).fill(ink.accent);
  }
};

const pilotis: Drawer = (g, x, y, s, ink, random) => {
  const height = (52 + random() * 26) * s;
  g.rect(x - 4 * s, y - height, 8 * s, height).fill(ink.dark);
  g.rect(x - 12 * s, y - height, 24 * s, 5 * s).fill(lighten(ink.dark, 0.2));
};

const rocher: Drawer = (g, x, y, s, ink, random) => {
  const w = (34 + random() * 30) * s;
  const h = w * (0.5 + random() * 0.4);

  g.poly(
    [
      x - w * 0.5,
      y,
      x - w * 0.36,
      y - h * 0.72,
      x - w * 0.05,
      y - h,
      x + w * 0.3,
      y - h * 0.8,
      x + w * 0.5,
      y - h * 0.2,
    ],
    true,
  ).fill(ink.color);
  g.poly([x - w * 0.05, y - h, x + w * 0.3, y - h * 0.8, x + w * 0.1, y - h * 0.45], true).fill(
    lighten(ink.color, 0.16),
  );
};

const cairn: Drawer = (g, x, y, s, ink, random) => {
  let at = y;
  for (let i = 0; i < 3; i++) {
    const w = (30 - i * 7) * s;
    const h = (12 + random() * 6) * s;
    g.ellipse(x + (random() - 0.5) * 5 * s, at - h * 0.5, w * 0.5, h * 0.5).fill(
      i === 2 ? lighten(ink.color, 0.18) : ink.color,
    );
    at -= h * 0.92;
  }
};

const cactus: Drawer = (g, x, y, s, ink, random) => {
  const height = (66 + random() * 44) * s;
  const w = 15 * s;

  g.roundRect(x - w / 2, y - height, w, height, w / 2).fill(ink.color);

  const armAt = y - height * (0.5 + random() * 0.16);
  const dir = random() > 0.5 ? 1 : -1;
  g.roundRect(x + dir * w * 0.4, armAt, w * 1.5 * dir, w * 0.72, w * 0.36).fill(ink.color);
  g.roundRect(
    x + dir * (w * 1.35) - w * 0.36,
    armAt - height * 0.26,
    w * 0.72,
    height * 0.3,
    w * 0.36,
  ).fill(ink.color);

  g.rect(x - w * 0.1, y - height + w * 0.4, w * 0.2, height - w * 0.6).fill(
    lighten(ink.color, 0.16),
  );
};

const os: Drawer = (g, x, y, s, ink, random) => {
  const w = (26 + random() * 12) * s;
  const pale = lighten(ink.color, 0.62);
  g.ellipse(x, y - 5 * s, w * 0.34, w * 0.26).fill(pale);
  g.rect(x - w * 0.1, y - 5 * s, w * 0.62, 3.4 * s).fill(pale);
  g.circle(x + w * 0.62, y - 4 * s, 3.6 * s).fill(pale);
  g.circle(x - w * 0.12, y - 8 * s, 2 * s).fill(ink.dark);
};

const buisson: Drawer = (g, x, y, s, ink, random) => {
  const w = (34 + random() * 24) * s;
  g.circle(x - w * 0.26, y - w * 0.16, w * 0.28).fill(ink.color);
  g.circle(x + w * 0.24, y - w * 0.14, w * 0.25).fill(ink.color);
  g.circle(x, y - w * 0.3, w * 0.32).fill(lighten(ink.color, 0.12));
};

const lanterne: Drawer = (g, x, y, s, ink) => {
  const height = 74 * s;
  g.rect(x - 2.6 * s, y - height, 5.2 * s, height).fill(ink.dark);
  g.moveTo(x, y - height + 3 * s);
  g.lineTo(x + 20 * s, y - height + 3 * s);
  g.stroke({ width: 3 * s, color: ink.dark });

  g.circle(x + 20 * s, y - height + 16 * s, 9 * s).fill({
    color: ink.accent,
    alpha: 0.25,
  });
  g.circle(x + 20 * s, y - height + 16 * s, 5.4 * s).fill(ink.accent);
};

const tonneau: Drawer = (g, x, y, s, ink, random) => {
  const h = (34 + random() * 10) * s;
  const w = h * 0.78;
  g.roundRect(x - w / 2, y - h, w, h, w * 0.2).fill(mixColor(ink.dark, 0x8a5a2a, 0.55));
  for (let i = 0; i < 2; i++) {
    g.rect(x - w / 2, y - h * (0.72 - i * 0.4), w, 3 * s).fill(lighten(ink.dark, 0.35));
  }
};

const DRAWERS: Record<PropKind, Drawer> = {
  sapin,
  feuillu,
  fougere,
  champignon,
  souche,
  roseau,
  arbreMort,
  nenuphar,
  pilotis,
  rocher,
  cairn,
  cactus,
  os,
  buisson,
  lanterne,
  tonneau,
};

export function drawProp(g: Graphics, prop: Prop, y: number, ink: PropInk): void {
  DRAWERS[prop.kind](
    g,
    prop.x,
    y + prop.sink,
    prop.scale,
    ink,
    seededRandom(prop.seed),
  );
}
