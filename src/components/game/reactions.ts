import { ACTION_ART, POWER_ART } from "@/lib/game/art";
import { sfx } from "@/lib/client/sound";
import { fx } from "./fx";
import { hitStop, scene, slowMotion } from "./scene";

/**
 * Choreographies of the reactions: how the art enters, what happens at the
 * instant of impact, how it leaves. Positions are world units; `head` is the
 * top of the hero the reaction follows.
 */

export type Rarity = "common" | "rare" | "legendary";

export interface ImpactContext {
  x: number;
  feet: number;
  head: number;
  /** The visible part of the world, for rains and wide effects. */
  viewLeft: number;
  viewWidth: number;
  viewTop: number;
  /** Your own action sounds; the actions of others stay quiet. */
  loud: boolean;
}

export interface Choreography {
  art: string;
  /** Art height at rest, world units. */
  size: number;
  duration: number;
  /** Instant of impact, ms from the start. */
  impact: number;
  enter: "pop" | "drop" | "rise" | "slam";
  exit: "fly" | "fall" | "fade" | "rise";
  /** Height of the art above the hero's head, world units. */
  lift: number;
  label?: string;
  labelColor?: number;
  rarity: Rarity;
  onImpact(ctx: ImpactContext): void;
}

const quiet = (ctx: ImpactContext, play: () => void) => { if (ctx.loud) play(); };

export const CHOREOGRAPHIES = {
  pigeon: {
    art: ACTION_ART.candidature, size: 190, duration: 2600, impact: 260, enter: "pop", exit: "fly", lift: 70, rarity: "common",
    onImpact(ctx) {
      quiet(ctx, sfx.coo);
      fx.burst({ preset: "feathers", x: ctx.x, y: ctx.head - 60, count: 12 });
      fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 60, count: 6 });
    },
  },
  lightning: {
    art: ACTION_ART.refus, size: 170, duration: 2500, impact: 380, enter: "drop", exit: "fall", lift: 40, rarity: "common",
    onImpact(ctx) {
      quiet(ctx, sfx.thunder);
      fx.bolt({ x: ctx.x, y: ctx.head + 20, top: ctx.viewTop - 40 });
      fx.burst({ preset: "glow", x: ctx.x, y: ctx.head + 20, count: 1, colors: [0xd8ecff] });
      fx.burst({ preset: "sparks", x: ctx.x, y: ctx.head + 10, count: 26 });
      fx.burst({ preset: "letters", x: ctx.x, y: ctx.head, count: 5, power: 0.8 });
      scene.shake = Math.max(scene.shake, 0.55);
      hitStop(90);
    },
  },
  cocktail: {
    art: ACTION_ART.entretien, size: 190, duration: 2700, impact: 300, enter: "rise", exit: "fade", lift: 60, rarity: "common",
    onImpact(ctx) {
      quiet(ctx, sfx.pop);
      fx.burst({ preset: "confetti", x: ctx.x, y: ctx.head - 40, count: 80 });
      fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 80, count: 10 });
    },
  },
  legendary: {
    art: ACTION_ART.rejetApresEntretien, size: 250, duration: 3900, impact: 560, enter: "slam", exit: "rise", lift: 70, rarity: "legendary",
    label: "REJET LÉGENDAIRE", labelColor: 0xf5d163,
    onImpact(ctx) {
      quiet(ctx, sfx.boom);
      slowMotion(0.35, 1100);
      hitStop(140);
      scene.shake = Math.max(scene.shake, 1);
      fx.burst({ preset: "shockwave", x: ctx.x, y: ctx.feet - 20, count: 1 });
      fx.burst({ preset: "glow", x: ctx.x, y: ctx.head - 40, count: 1 });
      fx.burst({ preset: "dust", x: ctx.x, y: ctx.feet, count: 26, spreadX: 30 });
      fx.burst({ preset: "sparks", x: ctx.x, y: ctx.head - 20, count: 36, power: 1.3 });
      fx.burst({ preset: "goldRain", x: ctx.viewLeft + ctx.viewWidth / 2, y: ctx.viewTop - 40, count: 110, spreadX: ctx.viewWidth / 2, spreadY: 60, delay: 0.25 });
    },
  },
  trophy: {
    art: ACTION_ART.embauche, size: 250, duration: 3700, impact: 420, enter: "rise", exit: "rise", lift: 80, rarity: "legendary",
    label: "ENGAGÉ·E !", labelColor: 0xf5d163,
    onImpact(ctx) {
      quiet(ctx, sfx.fanfare);
      fx.burst({ preset: "confetti", x: ctx.x, y: ctx.head - 60, count: 110, power: 1.2 });
      [[-260, -300, 0, 0xffd76c], [220, -340, 0.4, 0x9fd4ff], [-40, -420, 0.8, 0xff9a8a]].forEach(([dx, dy, delay, color]) => {
        fx.burst({ preset: "firework", x: ctx.x + dx, y: ctx.head + dy, count: 46, colors: [color, 0xffffff], delay });
        if (ctx.loud) window.setTimeout(sfx.firework, delay * 1000);
      });
    },
  },
  fireCurse: {
    art: POWER_ART.feuSacré, size: 170, duration: 2400, impact: 280, enter: "rise", exit: "rise", lift: 30, rarity: "common", label: "FEU SACRÉ", labelColor: 0xffb080,
    onImpact(ctx) {
      quiet(ctx, sfx.whoosh);
      fx.burst({ preset: "sparks", x: ctx.x, y: ctx.head, count: 30, colors: [0xffb62f, 0xff6a3d, 0xfff1bd] });
      fx.burst({ preset: "smoke", x: ctx.x, y: ctx.head - 20, count: 10 });
    },
  },
  dragonDrop: {
    art: POWER_ART.fienteDragon, size: 170, duration: 2300, impact: 420, enter: "drop", exit: "fall", lift: 20, rarity: "common", label: "CADEAU DU DRAGON", labelColor: 0xd9f0a0,
    onImpact(ctx) {
      quiet(ctx, sfx.stamp);
      fx.burst({ preset: "dust", x: ctx.x, y: ctx.head, count: 16, colors: [0xb8c77a, 0x8c9c55, 0xe8efc4] });
      scene.shake = Math.max(scene.shake, 0.35);
    },
  },
  paperStorm: {
    art: POWER_ART.paperasse, size: 170, duration: 2500, impact: 300, enter: "drop", exit: "fall", lift: 30, rarity: "common", label: "PAPERASSE !", labelColor: 0xf5e8bd,
    onImpact(ctx) {
      quiet(ctx, sfx.whoosh);
      fx.burst({ preset: "letterRain", x: ctx.x, y: ctx.viewTop - 30, count: 40, spreadX: 260, spreadY: 40 });
    },
  },
  frogCurse: {
    art: POWER_ART.crapaud, size: 160, duration: 2300, impact: 300, enter: "pop", exit: "fade", lift: 20, rarity: "common", label: "BISE LINKEDIN", labelColor: 0xb8e08a,
    onImpact(ctx) {
      quiet(ctx, sfx.pass);
      fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 40, count: 16, colors: [0xb8e08a, 0xfff1bd] });
    },
  },
} satisfies Record<string, Choreography>;

export type ReactionKind = keyof typeof CHOREOGRAPHIES;
