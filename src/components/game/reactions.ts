import { ACTION_ART, POWER_ART } from "@/lib/game/art";
import { sfx } from "@/lib/client/sound";
import { fx, type PresetName } from "./fx";
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
  /** Extra copies of the art flying along, for swarms. */
  copies?: Array<{ dx: number; dy: number; scale: number; delay: number }>;
  /** Particles left behind while the art travels. */
  trail?: { preset: PresetName; every: number; count?: number };
  /** A line of speech beside the art, after the impact. */
  bubble?: string;
  /** Something drawn in the world besides the art. */
  prop?: "carpet" | "crater" | "gnomes" | "ropes";
  /** Called every frame after the impact, ms since impact; `state` survives between calls. */
  during?(ctx: ImpactContext, since: number, state: Record<string, number>): void;
  /** Art height at rest, world units. */
  size: number;
  duration: number;
  /** Instant of impact, ms from the start. */
  impact: number;
  enter: "pop" | "drop" | "rise" | "slam" | "meteor";
  exit: "fly" | "fall" | "fade" | "rise" | "boomerang";
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
  pigeonDive: {
    art: ACTION_ART.candidature, size: 190, duration: 2500, impact: 340, enter: "drop", exit: "fly", lift: 60, rarity: "common",
    trail: { preset: "feathers", every: 70 },
    onImpact(ctx) {
      quiet(ctx, sfx.whoosh);
      quiet(ctx, sfx.coo);
      fx.burst({ preset: "feathers", x: ctx.x, y: ctx.head - 40, count: 16, spreadX: 30 });
      fx.burst({ preset: "puff", x: ctx.x, y: ctx.feet, count: 10, spreadX: 30 });
      scene.shake = Math.max(scene.shake, 0.25);
    },
  },
  sealedLetter: {
    art: ACTION_ART.candidature, size: 200, duration: 2600, impact: 380, enter: "slam", exit: "fly", lift: 50, rarity: "common",
    onImpact(ctx) {
      quiet(ctx, sfx.stamp);
      quiet(ctx, () => window.setTimeout(sfx.coo, 220));
      fx.burst({ preset: "shockwave", x: ctx.x, y: ctx.head - 30, count: 1, power: 0.45, colors: [0xce4d48] });
      fx.burst({ preset: "letters", x: ctx.x, y: ctx.head - 20, count: 7, power: 0.9 });
      fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 50, count: 8 });
      hitStop(70);
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
  pigeonSquadron: {
    art: ACTION_ART.candidature, size: 150, duration: 3000, impact: 300, enter: "pop", exit: "fly", lift: 70, rarity: "rare", label: "L’ESCADRILLE", labelColor: 0xf5e8bd,
    copies: [{ dx: -110, dy: -50, scale: 0.8, delay: 120 }, { dx: -110, dy: 60, scale: 0.8, delay: 180 }, { dx: -210, dy: -100, scale: 0.65, delay: 240 }, { dx: -210, dy: 110, scale: 0.65, delay: 300 }],
    onImpact(ctx) {
      quiet(ctx, sfx.coo);
      quiet(ctx, () => window.setTimeout(sfx.coo, 260));
      fx.burst({ preset: "feathers", x: ctx.x, y: ctx.head - 40, count: 26, spreadX: 120 });
    },
  },
  pigeonRocket: {
    art: ACTION_ART.candidature, size: 180, duration: 2300, impact: 260, enter: "pop", exit: "fly", lift: 60, rarity: "rare", label: "PIGEON FUSÉE", labelColor: 0xffb080,
    trail: { preset: "smoke", every: 40, count: 2 },
    onImpact(ctx) {
      quiet(ctx, sfx.whoosh);
      quiet(ctx, sfx.firework);
      fx.burst({ preset: "sparks", x: ctx.x, y: ctx.head - 30, count: 24, colors: [0xffb62f, 0xff6a3d, 0xfff1bd] });
      scene.shake = Math.max(scene.shake, 0.35);
    },
  },
  pigeonReceipt: {
    art: ACTION_ART.candidature, size: 180, duration: 3900, impact: 260, enter: "pop", exit: "boomerang", lift: 50, rarity: "legendary", label: "ACCUSÉ DE RÉCEPTION", labelColor: 0xf5d163,
    trail: { preset: "stars", every: 90 },
    onImpact(ctx) {
      quiet(ctx, sfx.coo);
      fx.burst({ preset: "feathers", x: ctx.x, y: ctx.head - 40, count: 14 });
    },
    during(ctx, since, state) {
      if (since > 1700 && !state.back) {
        state.back = 1;
        quiet(ctx, sfx.chime);
        fx.burst({ preset: "glow", x: ctx.x, y: ctx.head - 30, count: 1 });
        fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 30, count: 20 });
        slowMotion(0.5, 700);
      }
    },
  },
  coldShower: {
    art: ACTION_ART.refus, size: 160, duration: 2900, impact: 360, enter: "drop", exit: "fall", lift: 70, rarity: "common",
    onImpact(ctx) {
      quiet(ctx, sfx.rain);
      fx.burst({ preset: "cloud", x: ctx.x, y: ctx.head - 150, count: 16, spreadX: 80, spreadY: 18 });
      fx.burst({ preset: "splash", x: ctx.x, y: ctx.head, count: 10 });
    },
    during(ctx, since, state) {
      // The cloud keeps raining where the refusal struck, while the hero walks out from under it.
      if (since > 1500) return;
      const wave = Math.floor(since / 90);
      if (wave > (state.wave ?? -1)) {
        state.wave = wave;
        fx.burst({ preset: "rain", x: ctx.x, y: ctx.head - 130, count: 8, spreadX: 75, spreadY: 10 });
        if (wave % 3 === 0) fx.burst({ preset: "splash", x: ctx.x, y: ctx.feet, count: 3, spreadX: 50 });
      }
    },
  },
  slammedDoor: {
    art: ACTION_ART.refus, size: 210, duration: 2800, impact: 420, enter: "slam", exit: "fall", lift: 30, rarity: "common",
    bubble: "« Votre profil ne correspond pas à nos attentes. »",
    onImpact(ctx) {
      quiet(ctx, sfx.stamp);
      quiet(ctx, sfx.hit);
      fx.burst({ preset: "dust", x: ctx.x, y: ctx.feet, count: 18, spreadX: 30 });
      fx.burst({ preset: "letters", x: ctx.x, y: ctx.head, count: 4, power: 0.7 });
      scene.shake = Math.max(scene.shake, 0.6);
      hitStop(100);
    },
  },
  storm: {
    art: ACTION_ART.refus, size: 170, duration: 3200, impact: 380, enter: "drop", exit: "fall", lift: 40, rarity: "rare", label: "L’ORAGE", labelColor: 0xcfe3ff,
    onImpact(ctx) {
      quiet(ctx, sfx.thunder);
      fx.bolt({ x: ctx.x, y: ctx.head + 20, top: ctx.viewTop - 40 });
      fx.burst({ preset: "sparks", x: ctx.x, y: ctx.head + 10, count: 26 });
      fx.burst({ preset: "letterRain", x: ctx.x, y: ctx.viewTop - 30, count: 30, spreadX: 420, spreadY: 40, delay: 0.3 });
      scene.shake = Math.max(scene.shake, 0.6);
      hitStop(90);
    },
    during(ctx, since, state) {
      for (const [at, dx] of [[520, -200], [1050, 230]] as const) {
        const key = `bolt${at}`;
        if (since > at && !state[key]) {
          state[key] = 1;
          fx.bolt({ x: ctx.x + dx, y: ctx.feet, top: ctx.viewTop - 40 });
          fx.burst({ preset: "dust", x: ctx.x + dx, y: ctx.feet, count: 10 });
          scene.shake = Math.max(scene.shake, 0.4);
          quiet(ctx, sfx.thunder);
        }
      }
    },
  },
  bigNo: {
    art: ACTION_ART.refus, size: 230, duration: 2900, impact: 460, enter: "slam", exit: "fall", lift: 30, rarity: "rare", label: "NON.", labelColor: 0xff8a7a,
    onImpact(ctx) {
      quiet(ctx, sfx.stamp);
      quiet(ctx, sfx.boom);
      fx.burst({ preset: "shockwave", x: ctx.x, y: ctx.feet - 10, count: 1 });
      fx.burst({ preset: "dust", x: ctx.x, y: ctx.feet, count: 22, spreadX: 30 });
      scene.shake = Math.max(scene.shake, 0.75);
      hitStop(120);
    },
  },
  refusalAvalanche: {
    art: ACTION_ART.refus, size: 200, duration: 4000, impact: 420, enter: "drop", exit: "fall", lift: 40, rarity: "legendary", label: "AVALANCHE DE REFUS", labelColor: 0xf5d163,
    onImpact(ctx) {
      quiet(ctx, sfx.thunder);
      slowMotion(0.45, 1300);
      fx.bolt({ x: ctx.x, y: ctx.head + 20, top: ctx.viewTop - 40 });
      scene.shake = Math.max(scene.shake, 0.7);
      for (let wave = 0; wave < 3; wave++) {
        fx.burst({ preset: "letterRain", x: ctx.viewLeft + ctx.viewWidth / 2, y: ctx.viewTop - 40, count: 32, spreadX: ctx.viewWidth / 2, spreadY: 40, delay: wave * 0.45 });
      }
      fx.burst({ preset: "letters", x: ctx.x, y: ctx.head, count: 14, power: 1.2 });
    },
  },
  coffee: {
    art: ACTION_ART.entretien, size: 180, duration: 2800, impact: 320, enter: "rise", exit: "fade", lift: 60, rarity: "common",
    bubble: "« Parlez-moi de vous. »",
    onImpact(ctx) {
      quiet(ctx, sfx.pop);
      fx.burst({ preset: "smoke", x: ctx.x + 20, y: ctx.head - 40, count: 8, colors: [0xf2ede4, 0xd8d2c6] });
      fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 60, count: 8 });
    },
    during(ctx, since, state) {
      if (since > 700 && !state.steam) {
        state.steam = 1;
        fx.burst({ preset: "smoke", x: ctx.x + 20, y: ctx.head - 40, count: 6, colors: [0xf2ede4, 0xd8d2c6] });
      }
    },
  },
  spotlight: {
    art: ACTION_ART.entretien, size: 190, duration: 2900, impact: 360, enter: "rise", exit: "rise", lift: 70, rarity: "common",
    onImpact(ctx) {
      quiet(ctx, sfx.chime);
      fx.burst({ preset: "glow", x: ctx.x, y: ctx.head + 30, count: 1, power: 1.3, colors: [0xfff4d8] });
      fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 30, count: 18, spreadX: 40 });
      fx.burst({ preset: "confetti", x: ctx.x, y: ctx.head - 50, count: 30, power: 0.8 });
    },
    during(ctx, since, state) {
      if (since > 650 && !state.again) {
        state.again = 1;
        fx.burst({ preset: "glow", x: ctx.x, y: ctx.head + 30, count: 1, colors: [0xfff4d8] });
      }
    },
  },
  cocktailFireworks: {
    art: ACTION_ART.entretien, size: 190, duration: 3100, impact: 300, enter: "rise", exit: "fade", lift: 60, rarity: "rare", label: "SANTÉ !", labelColor: 0xffe7a8,
    onImpact(ctx) {
      quiet(ctx, sfx.pop);
      fx.burst({ preset: "confetti", x: ctx.x, y: ctx.head - 40, count: 60 });
      [[-220, -170, 0.2, 0xff9a8a], [200, -200, 0.55, 0xb8e08a], [-20, -250, 0.9, 0xffd76c]].forEach(([dx, dy, delay, color]) => {
        fx.burst({ preset: "firework", x: ctx.x + dx, y: ctx.head + dy, count: 40, colors: [color, 0xffffff], delay });
        if (ctx.loud) window.setTimeout(sfx.firework, delay * 1000);
      });
    },
  },
  redCarpet: {
    art: ACTION_ART.entretien, size: 180, duration: 3100, impact: 320, enter: "rise", exit: "fade", lift: 60, rarity: "rare", label: "TAPIS ROUGE", labelColor: 0xff9a8a,
    prop: "carpet",
    onImpact(ctx) {
      quiet(ctx, sfx.pop);
      quiet(ctx, sfx.chime);
      fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 20, count: 16 });
    },
  },
  gnomeBand: {
    art: ACTION_ART.entretien, size: 170, duration: 4200, impact: 360, enter: "rise", exit: "fade", lift: 60, rarity: "legendary", label: "LA FANFARE DES GNOMES", labelColor: 0xf5d163,
    prop: "gnomes",
    onImpact(ctx) {
      quiet(ctx, sfx.fanfare);
      slowMotion(0.55, 900);
      fx.burst({ preset: "confetti", x: ctx.x, y: ctx.head - 60, count: 100 });
    },
    during(ctx, since, state) {
      if (since > 900 && !state.again) { state.again = 1; quiet(ctx, sfx.fanfare); fx.burst({ preset: "confetti", x: ctx.x, y: ctx.head - 60, count: 60 }); }
    },
  },
  formLetter: {
    art: ACTION_ART.rejetApresEntretien, size: 220, duration: 3300, impact: 460, enter: "drop", exit: "rise", lift: 60, rarity: "common",
    bubble: "« Malgré la qualité de votre candidature… »",
    onImpact(ctx) {
      quiet(ctx, sfx.stamp);
      quiet(ctx, () => window.setTimeout(sfx.sad, 200));
      fx.burst({ preset: "letters", x: ctx.x, y: ctx.head - 10, count: 12, power: 1.1 });
      fx.burst({ preset: "letterRain", x: ctx.x, y: ctx.viewTop - 30, count: 16, spreadX: 240, spreadY: 30, delay: 0.3 });
      scene.shake = Math.max(scene.shake, 0.5);
      hitStop(110);
    },
  },
  anvil: {
    art: ACTION_ART.rejetApresEntretien, size: 220, duration: 3300, impact: 520, enter: "meteor", exit: "rise", lift: 50, rarity: "common",
    prop: "crater",
    onImpact(ctx) {
      quiet(ctx, sfx.boom);
      hitStop(130);
      scene.shake = Math.max(scene.shake, 0.85);
      fx.burst({ preset: "shockwave", x: ctx.x, y: ctx.feet - 10, count: 1, power: 0.8 });
      fx.burst({ preset: "dust", x: ctx.x, y: ctx.feet, count: 24, spreadX: 40 });
      fx.burst({ preset: "stars", x: ctx.x, y: ctx.head - 40, count: 10 });
    },
  },
  meteor: {
    art: ACTION_ART.rejetApresEntretien, size: 230, duration: 3900, impact: 700, enter: "meteor", exit: "rise", lift: 60, rarity: "legendary", label: "IMPACT LÉGENDAIRE", labelColor: 0xffb080,
    prop: "crater",
    trail: { preset: "sparks", every: 30, count: 2 },
    onImpact(ctx) {
      quiet(ctx, sfx.boom);
      slowMotion(0.35, 900);
      hitStop(160);
      scene.shake = Math.max(scene.shake, 1);
      fx.burst({ preset: "shockwave", x: ctx.x, y: ctx.feet - 10, count: 1 });
      fx.burst({ preset: "glow", x: ctx.x, y: ctx.feet - 40, count: 1, colors: [0xffb62f] });
      fx.burst({ preset: "dust", x: ctx.x, y: ctx.feet, count: 34, spreadX: 50 });
      fx.burst({ preset: "sparks", x: ctx.x, y: ctx.feet - 30, count: 40, power: 1.3, colors: [0xffb62f, 0xff6a3d, 0xfff1bd] });
      fx.burst({ preset: "smoke", x: ctx.x, y: ctx.feet - 20, count: 14 });
    },
  },
  frogReader: {
    art: POWER_ART.crapaud, size: 170, duration: 4300, impact: 420, enter: "pop", exit: "fade", lift: 30, rarity: "legendary", label: "LE CRAPAUD A PARLÉ", labelColor: 0xb8e08a,
    bubble: "« Nous avons retenu un autre profil. Bonne continuation ! »",
    onImpact(ctx) {
      quiet(ctx, sfx.croak);
      fx.burst({ preset: "letters", x: ctx.x, y: ctx.head, count: 8 });
      fx.burst({ preset: "goldRain", x: ctx.viewLeft + ctx.viewWidth / 2, y: ctx.viewTop - 40, count: 70, spreadX: ctx.viewWidth / 2, spreadY: 40, delay: 0.5 });
    },
  },
  mythicRejection: {
    art: ACTION_ART.rejetApresEntretien, size: 260, duration: 4800, impact: 600, enter: "slam", exit: "rise", lift: 70, rarity: "legendary", label: "QUARANTE-SEPT LETTRES", labelColor: 0xf5d163,
    onImpact(ctx) {
      quiet(ctx, sfx.boom);
      slowMotion(0.3, 1700);
      hitStop(160);
      scene.shake = Math.max(scene.shake, 1);
      fx.burst({ preset: "shockwave", x: ctx.x, y: ctx.feet - 20, count: 1 });
      fx.burst({ preset: "glow", x: ctx.x, y: ctx.head - 40, count: 1 });
      fx.burst({ preset: "letterRain", x: ctx.viewLeft + ctx.viewWidth / 2, y: ctx.viewTop - 40, count: 47, spreadX: ctx.viewWidth / 2, spreadY: 60, delay: 0.2 });
      fx.burst({ preset: "goldRain", x: ctx.viewLeft + ctx.viewWidth / 2, y: ctx.viewTop - 40, count: 120, spreadX: ctx.viewWidth / 2, spreadY: 60, delay: 0.5 });
    },
  },
  grandFireworks: {
    art: ACTION_ART.embauche, size: 250, duration: 4200, impact: 420, enter: "rise", exit: "rise", lift: 80, rarity: "legendary", label: "ENGAGÉ·E !", labelColor: 0xf5d163,
    onImpact(ctx) {
      quiet(ctx, sfx.fanfare);
      const colors = [0xffd76c, 0x9fd4ff, 0xff9a8a, 0xb8e08a, 0xd8a8ff];
      for (let i = 0; i < 8; i++) {
        const delay = i * 0.28;
        fx.burst({ preset: "firework", x: ctx.x + (i % 2 ? 1 : -1) * (80 + (i * 53) % 260), y: ctx.head - 160 - (i * 37) % 160, count: 44, colors: [colors[i % colors.length], 0xffffff], delay });
        if (ctx.loud) window.setTimeout(sfx.firework, delay * 1000);
      }
      fx.burst({ preset: "confetti", x: ctx.x, y: ctx.head - 60, count: 120, power: 1.2 });
    },
  },
  pigeonAscension: {
    art: ACTION_ART.embauche, size: 230, duration: 4400, impact: 420, enter: "rise", exit: "rise", lift: 80, rarity: "legendary", label: "ENVOLÉ·E VERS LA TAVERNE", labelColor: 0xf5d163,
    prop: "ropes",
    onImpact(ctx) {
      quiet(ctx, sfx.fanfare);
      quiet(ctx, () => window.setTimeout(sfx.coo, 300));
      fx.burst({ preset: "feathers", x: ctx.x, y: ctx.head - 80, count: 30, spreadX: 120 });
      fx.burst({ preset: "confetti", x: ctx.x, y: ctx.head - 60, count: 80 });
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
