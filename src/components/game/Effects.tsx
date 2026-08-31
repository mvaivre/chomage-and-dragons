"use client";

import { useCallback, useMemo, useRef } from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics, Sprite, Text } from "pixi.js";
import { POINTS } from "@/lib/config";
import { seededRandom } from "@/lib/rng";
import { WORLD_LENGTH } from "@/lib/game/world";
import { scene } from "./scene";
import { atlasFrames, usePaintedAsset } from "./sprites";
import { GOLD, GOLD_LIGHT, SHOUT_STYLE, TAG_STYLE } from "./style";

/**
 * Les animations des cinq actions officielles, plus le coffre.
 *
 * Chaque effet vit dans le repère du monde, à l'aplomb du personnage concerné, et
 * s'annonce terminé tout seul. Le jeu n'a donc jamais à savoir combien de temps
 * dure une animation.
 */

export type EffectKind =
  | "pigeon"
  | "lightning"
  | "cocktail"
  | "legendary"
  | "trophy"
  | "chest"
  | "fireCurse"
  | "dragonDrop"
  | "paperStorm"
  | "frogCurse";

export interface Effect {
  id: string;
  kind: EffectKind;
  /** Aux pieds du personnage, en unités monde. */
  origin: { x: number; y: number };
}

export interface EffectProps {
  origin: { x: number; y: number };
  onDone: () => void;
}

/** Hauteur approximative d'un personnage, pour viser la tête. */
const HEAD = 104;
const safeLabelX = (x: number) => Math.max(320, Math.min(WORLD_LENGTH - 320, x));

const noDraw = (g: Graphics) => {
  g.clear();
};

/** Compte le temps écoulé et signale la fin une seule fois. */
function useClock(duration: number, onDone: () => void) {
  const elapsed = useRef(0);
  const finished = useRef(false);

  return (deltaMS: number) => {
    elapsed.current += deltaMS;
    if (!finished.current && elapsed.current >= duration) {
      finished.current = true;
      onDone();
    }
    return Math.min(1, elapsed.current / duration);
  };
}

/* ------------------------------------------------------------------ confettis */

const CONFETTI = [0xd94f4f, 0xe8b84b, 0x4fa3d1, 0x63b96a, 0xb96ac9, GOLD_LIGHT];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  spin: number;
  angle: number;
}

function useConfetti(
  origin: { x: number; y: number },
  count: number,
  seed: number,
  ref: React.RefObject<Graphics | null>,
) {
  const particles = useRef<Particle[]>(
    (() => {
      const random = seededRandom(seed);
      return Array.from({ length: count }, () => {
        const angle = random() * Math.PI * 2;
        const speed = 70 + random() * 240;
        return {
          x: origin.x,
          y: origin.y - HEAD * 0.6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 190,
          size: 3 + random() * 4.5,
          color: CONFETTI[Math.floor(random() * CONFETTI.length)],
          spin: (random() - 0.5) * 10,
          angle: random() * Math.PI,
        };
      });
    })(),
  );

  return (deltaMS: number, fade: number) => {
    const g = ref.current;
    if (!g) return;

    const dt = Math.min(deltaMS, 60) / 1000;
    g.clear();

    for (const p of particles.current) {
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;

      const h = p.size;
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      g.poly(
        [
          p.x - h * cos,
          p.y - h * sin,
          p.x + h * sin,
          p.y - h * cos,
          p.x + h * cos,
          p.y + h * sin,
          p.x - h * sin,
          p.y + h * cos,
        ],
        true,
      ).fill({ color: p.color, alpha: fade });
    }
  };
}

/* ------------------------------------------------------------------ points */

/** Le gain de points qui s'envole : le retour le plus lisible du jeu. */
function Points({ origin, value }: { origin: { x: number; y: number }; value: number }) {
  const ref = useRef<Text>(null);
  const t = useRef(0);

  useTick((ticker) => {
    t.current = Math.min(1, t.current + ticker.deltaMS / 1400);
    const node = ref.current;
    if (!node) return;
    node.y = origin.y - HEAD - 26 - t.current * 72;
    node.alpha = t.current > 0.6 ? 1 - (t.current - 0.6) / 0.4 : 1;
    node.scale.set(0.7 + Math.min(1, t.current * 5) * 0.5);
  });

  return (
    <pixiText
      ref={ref}
      text={value > 0 ? `+${value}` : `${value}`}
      style={{
        ...TAG_STYLE,
        fontSize: 34,
        fontWeight: "700",
        fill: value > 0 ? GOLD_LIGHT : 0xff9a8a,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      x={origin.x}
      y={origin.y - HEAD - 26}
    />
  );
}

/* ------------------------------------------------------------------ pigeon */

function drawPigeonBody(g: Graphics) {
  g.clear();
  g.ellipse(0, 0, 15, 9).fill(0xe8eef4);
  g.ellipse(-11, -5, 7, 6.5).fill(0xf4f8fc);
  g.poly([-17, -5, -25, -3, -17, -1], true).fill(0xe0a54a);
  g.circle(-13, -7, 1.6).fill(0x2a2118);
  g.poly([13, 1, 26, -3, 24, 3], true).fill(0xc9d4de);
  // Le rouleau de parchemin ficelé à la patte : la candidature.
  g.rect(2, 8, 11, 5).fill(0xf2e3c0);
  g.rect(2, 8, 11, 5).stroke({ width: 1, color: 0xa8905e });
}

function drawPigeonWing(g: Graphics) {
  g.clear();
  g.poly([0, 0, 20, -13, 26, -2, 8, 6], true).fill(0xd4dee8);
  g.poly([0, 0, 18, -10, 22, -3], true).fill(0xf4f8fc);
}

/** La brieftaube part avec la candidature. */
export function PigeonEffect({ origin, onDone }: EffectProps) {
  const root = useRef<Container>(null);
  const wing = useRef<Container>(null);
  const tick = useClock(2500, onDone);

  const from = useMemo(
    () => ({ x: origin.x + 18, y: origin.y - HEAD * 0.7 }),
    [origin],
  );

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);
    const ease = t * t * (3 - 2 * t);

    const node = root.current;
    if (node) {
      node.x = from.x + ease * 1180;
      node.y = from.y - ease * 300 + Math.sin(t * 8) * 18;
      node.rotation = -0.18 + Math.sin(t * 8) * 0.12;
      node.alpha = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
    }
    if (wing.current) {
      wing.current.scale.y = Math.sin(t * 58) * 0.9;
    }
  });

  return (
    <pixiContainer>
      <Points origin={origin} value={POINTS.candidature} />
      <pixiContainer ref={root} x={from.x} y={from.y}>
        <pixiGraphics draw={drawPigeonBody} />
        <pixiContainer ref={wing} x={-2} y={-4}>
          <pixiGraphics draw={drawPigeonWing} />
        </pixiContainer>
      </pixiContainer>
    </pixiContainer>
  );
}

/* ------------------------------------------------------------------ foudre */

/** Éclair sur le personnage : flash, secousse et zigzag. */
export function LightningEffect({ origin, onDone }: EffectProps) {
  const bolt = useRef<Graphics>(null);
  const flash = useRef<Graphics>(null);
  const stars = useRef<Graphics>(null);
  const tick = useClock(1350, onDone);

  const path = useMemo(() => {
    const random = seededRandom(Math.floor(origin.x * 977 + origin.y));
    const steps = 8;
    const top = origin.y - 820;
    const points: number[] = [origin.x + (random() - 0.5) * 90, top];

    for (let i = 1; i <= steps; i++) {
      const ratio = i / steps;
      points.push(
        origin.x + (random() - 0.5) * 70 * (1 - ratio),
        top + (origin.y - HEAD * 0.75 - top) * ratio,
      );
    }
    return points;
  }, [origin]);

  const drawBolt = useCallback(
    (g: Graphics) => {
      g.clear();
      g.poly(path, false).stroke({
        width: 14,
        color: 0xfff3b0,
        alpha: 0.45,
        join: "round",
      });
      g.poly(path, false).stroke({ width: 5, color: 0xffffff, join: "round" });
    },
    [path],
  );

  const drawFlash = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(origin.x - 2600, origin.y - 1600, 5200, 2600).fill(0xfffbe6);
    },
    [origin],
  );

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);

    if (bolt.current) {
      // Trois éclats successifs, puis extinction.
      bolt.current.alpha = t < 0.4 ? (Math.sin(t * 66) > -0.2 ? 1 : 0.2) : 0;
    }
    if (flash.current) {
      flash.current.alpha = Math.max(0, 0.5 - t * 1.5);
    }

    const g = stars.current;
    if (g) {
      g.clear();
      if (t > 0.16) {
        const spin = t * 7;
        for (let i = 0; i < 3; i++) {
          const a = spin + (i / 3) * Math.PI * 2;
          const x = origin.x + Math.cos(a) * 26;
          const y = origin.y - HEAD - 8 + Math.sin(a) * 9;
          g.star(x, y, 4, 7 * (1 - t * 0.5)).fill({
            color: GOLD_LIGHT,
            alpha: Math.max(0, 1 - (t - 0.16) / 0.84),
          });
        }
      }
    }

    scene.shake = Math.max(0, 1 - t * 2);
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={flash} draw={drawFlash} alpha={0.5} />
      <pixiGraphics ref={bolt} draw={drawBolt} />
      <pixiGraphics ref={stars} draw={noDraw} />
      <Points origin={origin} value={POINTS.refus} />
    </pixiContainer>
  );
}

/* ------------------------------------------------------------------ coupe */

function drawGoblet(g: Graphics) {
  g.clear();
  g.poly([-15, -18, 15, -18, 9, 4, -9, 4], true).fill(GOLD);
  g.poly([-13, -15, 13, -15, 9, -6, -9, -6], true).fill(0xd94f6a);
  g.ellipse(0, -15, 13, 3.4).fill(0xf07a8e);
  g.rect(-3, 4, 6, 12).fill(GOLD);
  g.roundRect(-11, 16, 22, 5, 2.5).fill(GOLD_LIGHT);
  g.circle(-6, -12, 2).fill({ color: 0xffffff, alpha: 0.7 });
}

/** Entretien décroché : confettis et coupe levée. Le score, lui, prend −3. */
export function CocktailEffect({ origin, onDone }: EffectProps) {
  const goblet = useRef<Container>(null);
  const confetti = useRef<Graphics>(null);
  const tick = useClock(2400, onDone);
  const step = useConfetti(origin, 46, 4242, confetti);

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);
    step(ticker.deltaMS, Math.max(0, 1 - t * 1.15));

    const node = goblet.current;
    if (node) {
      const pop = Math.min(1, t / 0.22);
      node.scale.set(0.4 + pop * 0.9);
      node.y = origin.y - HEAD - 20 - t * 52;
      node.rotation = Math.sin(t * 11) * 0.22;
      node.alpha = t > 0.64 ? 1 - (t - 0.64) / 0.36 : 1;
    }
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={confetti} draw={noDraw} />
      <pixiContainer ref={goblet} x={origin.x} y={origin.y - HEAD - 20}>
        <pixiGraphics draw={drawGoblet} />
      </pixiContainer>
      <Points
        origin={{ x: origin.x - 54, y: origin.y }}
        value={POINTS.entretien}
      />
    </pixiContainer>
  );
}

/* ------------------------------------------------------------------ crâne */

function drawSkull(g: Graphics) {
  g.clear();
  g.circle(0, 0, 22).fill(0xe8e2d2);
  g.roundRect(-13, 16, 26, 14, 5).fill(0xe8e2d2);
  g.ellipse(-8.5, -2, 6.5, 7.5).fill(0x1a1410);
  g.ellipse(8.5, -2, 6.5, 7.5).fill(0x1a1410);
  g.circle(-7, -3, 2.4).fill(0xd94f4f);
  g.circle(10, -3, 2.4).fill(0xd94f4f);
  g.poly([-3.5, 9, 3.5, 9, 0, 15], true).fill(0x1a1410);
  for (const x of [-8, -2.5, 3, 8.5]) {
    g.rect(x, 19, 3.4, 9).fill(0x2a2118);
  }
}

/** Rejet après entretien : la LEGENDARY REJECTION, +5 points. */
export function LegendaryEffect({ origin, onDone }: EffectProps) {
  const skull = useRef<Container>(null);
  const banner = useRef<Container>(null);
  const tick = useClock(2700, onDone);

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);

    const node = skull.current;
    if (node) {
      const pop = Math.min(1, t / 0.16);
      node.scale.set(0.2 + pop * 1.5);
      node.rotation = Math.sin(t * 26) * 0.14 * (1 - t);
      node.alpha = t > 0.74 ? 1 - (t - 0.74) / 0.26 : 1;
    }
    if (banner.current) {
      banner.current.alpha =
        t < 0.1 ? t / 0.1 : t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;
      banner.current.y = origin.y - HEAD - 210 - t * 34;
      banner.current.scale.set(0.9 + Math.min(1, t * 6) * 0.1);
    }
    scene.shake = Math.max(0, 0.75 - t * 1.5);
  });

  return (
    <pixiContainer>
      <pixiContainer ref={skull} x={origin.x} y={origin.y - HEAD - 70}>
        <pixiGraphics draw={drawSkull} />
      </pixiContainer>
      <pixiContainer ref={banner} x={origin.x} y={origin.y - HEAD - 210}>
        <pixiText
          text="LEGENDARY REJECTION"
          style={SHOUT_STYLE}
          anchor={{ x: 0.5, y: 0.5 }}
        />
      </pixiContainer>
      <Points
        origin={{ x: origin.x + 60, y: origin.y }}
        value={POINTS.rejetApresEntretien}
      />
    </pixiContainer>
  );
}

/* ------------------------------------------------------------------ embauche */

function drawBigTrophy(g: Graphics) {
  g.clear();
  g.poly([-30, -40, 30, -40, 20, 8, -20, 8], true).fill(GOLD);
  g.poly([-30, -40, 0, -40, 0, 8, -20, 8], true).fill({
    color: GOLD_LIGHT,
    alpha: 0.5,
  });
  g.ellipse(0, -40, 30, 9).fill(GOLD_LIGHT);
  g.moveTo(-30, -32);
  g.quadraticCurveTo(-52, -14, -26, -4);
  g.moveTo(30, -32);
  g.quadraticCurveTo(52, -14, 26, -4);
  g.stroke({ width: 7, color: GOLD });
  g.rect(-8, 8, 16, 22).fill(GOLD);
  g.roundRect(-24, 30, 48, 12, 4).fill(GOLD_LIGHT);
  g.roundRect(-30, 40, 60, 9, 4).fill(GOLD);
}

/** Embauche : grande célébration. Le personnage quitte la course, garde ses points. */
export function TrophyEffect({ origin, onDone }: EffectProps) {
  const trophy = useRef<Container>(null);
  const confetti = useRef<Graphics>(null);
  const rays = useRef<Graphics>(null);
  const tick = useClock(3600, onDone);
  const step = useConfetti(origin, 110, 909, confetti);

  const center = useMemo(
    () => ({ x: origin.x, y: origin.y - HEAD - 90 }),
    [origin],
  );

  const drawRays = useCallback((g: Graphics) => {
    g.clear();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 560, Math.sin(a) * 560);
    }
    g.stroke({ width: 22, color: GOLD_LIGHT, alpha: 0.16 });
  }, []);

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);
    step(ticker.deltaMS, Math.max(0, 1 - t * 1.05));

    const node = trophy.current;
    if (node) {
      const pop = Math.min(1, t / 0.2);
      node.scale.set(0.2 + pop * 1.2 + Math.sin(t * 12) * 0.04);
      node.alpha = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
    }
    if (rays.current) {
      rays.current.rotation = t * 1.3;
      rays.current.alpha = Math.max(0, 0.9 - t * 1.1);
    }
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={rays} draw={drawRays} x={center.x} y={center.y} />
      <pixiGraphics ref={confetti} draw={noDraw} />
      <pixiContainer ref={trophy} x={center.x} y={center.y}>
        <pixiGraphics draw={drawBigTrophy} />
      </pixiContainer>
      <pixiText
        text="ENGAGÉ·E — les points restent acquis"
        style={{ ...SHOUT_STYLE, fontSize: 26 }}
        anchor={{ x: 0.5, y: 0 }}
        x={center.x}
        y={center.y + 74}
      />
    </pixiContainer>
  );
}

/* ------------------------------------------------------------------ coffre */

/** Palier de dix pas : le coffre s'ouvre et annonce la farce débloquée. */
export function ChestEffect({ origin, onDone }: EffectProps) {
  const sheet = usePaintedAsset("/art/runtime/chest-opening-v2.webp?v=1", true);
  const frames = sheet ? atlasFrames(sheet, 4, 1) : [];
  const chest = useRef<Container>(null);
  const chestSprite = useRef<Sprite>(null);
  const sparkle = useRef<Graphics>(null);
  const tick = useClock(2400, onDone);

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);

    const node = chest.current;
    if (node) {
      const anticipation = t < 0.34 ? Math.sin(t * 110) * (1 - t / 0.34) : 0;
      node.rotation = anticipation * 0.035;
      node.scale.set(t < 0.16 ? 0.92 + t * 0.5 : 1);
      node.alpha = t > 0.88 ? 1 - (t - 0.88) / 0.12 : 1;
    }

    const sprite = chestSprite.current;
    if (sprite && frames.length === 4) {
      const frame = t < 0.2 ? 0 : t < 0.38 ? 1 : t < 0.58 ? 2 : 3;
      sprite.texture = frames[frame];
      sprite.width = 176;
      sprite.height = 264;
    }

    const g = sparkle.current;
    if (g) {
      g.clear();
      const reveal = Math.max(0, (t - 0.34) / 0.66);
      const radius = 12 + reveal * 104;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 2.4;
        g.star(
          origin.x + Math.cos(a) * radius,
          origin.y - 88 + Math.sin(a) * radius * 0.6,
          4,
          5.2 * Math.max(0, 1 - reveal),
        ).fill({ color: GOLD_LIGHT, alpha: Math.max(0, 1 - reveal) });
      }
    }
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={sparkle} draw={noDraw} />
      <pixiContainer ref={chest} x={origin.x} y={origin.y + 6}>
        {frames.length === 4 ? (
          <pixiSprite
            ref={chestSprite}
            texture={frames[0]}
            anchor={{ x: 0.5, y: 0.8 }}
            width={176}
            height={264}
          />
        ) : null}
      </pixiContainer>
      <pixiText
        text="NOUVELLE FARCE DÉBLOQUÉE"
        style={{ ...SHOUT_STYLE, fontSize: 24, letterSpacing: 2 }}
        anchor={{ x: 0.5, y: 0.5 }}
        x={safeLabelX(origin.x)}
        y={origin.y - 196}
      />
    </pixiContainer>
  );
}

/* ------------------------------------------------------------------ pouvoirs */

/** La tête de la cible brûle quelques secondes, sans modifier sa progression. */
export function FireCurseEffect({ origin, onDone }: EffectProps) {
  const flames = useRef<Graphics>(null);
  const label = useRef<Text>(null);
  const tick = useClock(2800, onDone);

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);
    const g = flames.current;
    if (g) {
      g.clear();
      const fade = t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;
      for (let i = 0; i < 9; i++) {
        const x = origin.x - 30 + i * 7.5;
        const wave = Math.sin(t * 32 + i * 1.8);
        const height = 28 + (i % 4) * 9 + wave * 7;
        const y = origin.y - HEAD + 5;
        g.poly([x - 7, y, x, y - height, x + 7, y, x, y - height * 0.42], true).fill({
          color: i % 3 === 0 ? 0xffdf52 : i % 2 === 0 ? 0xff8a2c : 0xd93b25,
          alpha: fade * 0.9,
        });
      }
      g.circle(origin.x, origin.y - HEAD + 4, 42).fill({ color: 0xff7a24, alpha: 0.08 * fade });
    }
    if (label.current) {
      label.current.alpha = t > 0.72 ? 1 - (t - 0.72) / 0.28 : Math.min(1, t * 7);
      label.current.y = origin.y - HEAD - 92 - t * 16;
    }
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={flames} draw={noDraw} />
      <pixiText
        ref={label}
        text="FIÈVRE DU RECRUTEUR"
        style={{ ...SHOUT_STYLE, fontSize: 25, letterSpacing: 2 }}
        anchor={{ x: 0.5, y: 0.5 }}
        x={safeLabelX(origin.x)}
        y={origin.y - HEAD - 92}
      />
    </pixiContainer>
  );
}

/** Un dragon survole la cible et lui laisse un feedback organique. */
export function DragonDropEffect({ origin, onDone }: EffectProps) {
  const art = useRef<Graphics>(null);
  const tick = useClock(3400, onDone);

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);
    const g = art.current;
    if (!g) return;
    g.clear();

    const x = origin.x - 360 + t * 720;
    const y = origin.y - 330 + Math.sin(t * 16) * 16;
    const wing = Math.sin(t * 42) * 28;
    g.ellipse(x, y, 48, 19).fill(0x3f6f49);
    g.circle(x + 44, y - 10, 17).fill(0x548653);
    g.moveTo(x - 32, y);
    g.quadraticCurveTo(x - 108, y - 30, x - 132, y + 8);
    g.stroke({ width: 13, color: 0x31563d, cap: "round" });
    g.poly([x - 4, y - 5, x - 28, y - 74 - wing, x + 48, y - 17], true).fill(0x628b5d);
    g.poly([x + 50, y - 15, x + 75, y - 8, x + 51, y - 3], true).fill(0x3f6f49);
    g.circle(x + 50, y - 13, 2.3).fill(0xffdf65);

    if (t > 0.34) {
      const dropT = Math.min(1, (t - 0.34) / 0.34);
      const dropY = origin.y - 300 + dropT * 235;
      g.circle(origin.x, dropY, 10 + dropT * 5).fill(0x6f5129);
      g.circle(origin.x - 7, dropY - 5, 5).fill(0x8b6935);
      if (dropT === 1) {
        g.ellipse(origin.x, origin.y - HEAD + 4, 30, 9).fill({ color: 0x6f5129, alpha: 1 - t * 0.45 });
      }
    }
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={art} draw={noDraw} />
      <pixiText
        text="FEEDBACK DU DRAGON"
        style={{ ...SHOUT_STYLE, fontSize: 25, letterSpacing: 2 }}
        anchor={{ x: 0.5, y: 0.5 }}
        x={safeLabelX(origin.x)}
        y={origin.y - HEAD - 160}
      />
    </pixiContainer>
  );
}

/** Une tornade de formulaires tourne autour de la victime. */
export function PaperStormEffect({ origin, onDone }: EffectProps) {
  const papers = useRef<Graphics>(null);
  const tick = useClock(3000, onDone);

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);
    const g = papers.current;
    if (!g) return;
    g.clear();
    const fade = t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;

    for (let i = 0; i < 18; i++) {
      const a = t * (9 + (i % 3)) + i * 1.7;
      const radius = 42 + (i % 6) * 17;
      const x = origin.x + Math.cos(a) * radius;
      const y = origin.y - HEAD * 0.55 + Math.sin(a) * 72 - ((t * 90 + i * 22) % 120);
      const w = 18;
      const h = 13;
      const cos = Math.cos(a * 1.8);
      const sin = Math.sin(a * 1.8);
      g.poly(
        [
          x - w * cos,
          y - h * sin,
          x + h * sin,
          y - w * cos,
          x + w * cos,
          y + h * sin,
          x - h * sin,
          y + w * cos,
        ],
        true,
      ).fill({ color: i % 3 === 0 ? 0xf4e7ca : 0xd9c89f, alpha: fade });
    }
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={papers} draw={noDraw} />
      <pixiText
        text="OURAGAN ADMINISTRATIF"
        style={{ ...SHOUT_STYLE, fontSize: 25, letterSpacing: 2 }}
        anchor={{ x: 0.5, y: 0.5 }}
        x={safeLabelX(origin.x)}
        y={origin.y - HEAD - 148}
      />
    </pixiContainer>
  );
}

function drawCorporateFrog(g: Graphics) {
  g.clear();
  g.ellipse(0, 8, 42, 30).fill(0x72a84d);
  g.circle(-25, -16, 18).fill(0x82b95a);
  g.circle(25, -16, 18).fill(0x82b95a);
  g.circle(-25, -19, 7).fill(0xffffff);
  g.circle(25, -19, 7).fill(0xffffff);
  g.circle(-23, -19, 3).fill(0x1c2817);
  g.circle(23, -19, 3).fill(0x1c2817);
  g.moveTo(-19, 13);
  g.quadraticCurveTo(0, 25, 19, 13);
  g.stroke({ width: 4, color: 0x304823, cap: "round" });
  // Petite cravate corporate, parce que le monstre a des valeurs.
  g.poly([-6, 29, 6, 29, 3, 42, 0, 48, -3, 42], true).fill(0x9e2e38);
}

export function FrogCurseEffect({ origin, onDone }: EffectProps) {
  const frog = useRef<Container>(null);
  const tick = useClock(2700, onDone);

  useTick((ticker) => {
    const t = tick(ticker.deltaMS);
    const node = frog.current;
    if (!node) return;
    const pop = Math.min(1, t / 0.18);
    node.scale.set(0.15 + pop * 1.1);
    node.rotation = Math.sin(t * 18) * 0.08;
    node.alpha = t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;
  });

  return (
    <pixiContainer>
      <pixiContainer ref={frog} x={origin.x} y={origin.y - HEAD - 50}>
        <pixiGraphics draw={drawCorporateFrog} />
      </pixiContainer>
      <pixiText
        text="BISE LINKEDIN"
        style={{ ...SHOUT_STYLE, fontSize: 27, letterSpacing: 2 }}
        anchor={{ x: 0.5, y: 0.5 }}
        x={safeLabelX(origin.x)}
        y={origin.y - HEAD - 140}
      />
    </pixiContainer>
  );
}

export const EFFECT_COMPONENTS: Record<
  EffectKind,
  (props: EffectProps) => React.ReactElement
> = {
  pigeon: PigeonEffect,
  lightning: LightningEffect,
  cocktail: CocktailEffect,
  legendary: LegendaryEffect,
  trophy: TrophyEffect,
  chest: ChestEffect,
  fireCurse: FireCurseEffect,
  dragonDrop: DragonDropEffect,
  paperStorm: PaperStormEffect,
  frogCurse: FrogCurseEffect,
};
