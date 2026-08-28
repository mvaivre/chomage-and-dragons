"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics, Sprite } from "pixi.js";
import type { PlayerView } from "@/hooks/useGame";
import { characterById, type Character } from "@/lib/game/characters";
import { seededRandom } from "@/lib/rng";
import { slopeAt, surfaceAt, worldXFor } from "@/lib/game/world";
import {
  characterJumpNativeFacing,
  characterNativeFacing,
  useCharacterActionFrames,
  useCharacterJumpFrames,
  useCharacterSprite,
} from "./sprites";
import { scene } from "./scene";
import { GOLD, GOLD_LIGHT, NAME_STYLE, TAG_STYLE } from "./style";

/** Somme de contrôle d'une chaîne, pour amorcer un tirage reproductible. */
function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/**
 * Un personnage sur le chemin.
 *
 * Les héros peints utilisent huit poses plein-corps. Le ticker ne déforme jamais
 * leurs membres : il change simplement de cellule pour l'attente, la marche et les
 * réactions. Les anciens personnages en code restent un fallback temporaire.
 */

/** Hauteur du personnage, unités monde. Le repère local a les pieds en (0, 0). */
export const HERO_HEIGHT = 112;
const STRIDE_DURATION = 0.52;

interface TravelLeg {
  from: number;
  to: number;
  steps: number;
  index: number;
  elapsed: number;
}

export const LEG_TOP = -26;
export const TORSO_TOP = -64;
const HEAD_Y = -78;
const HEAD_R = 14;

/* ------------------------------------------------------------------ silhouette */

export function drawLeg(g: Graphics, c: Character) {
  g.clear();
  g.roundRect(-4, 0, 8, 22, 3).fill(c.palette.robeDark);
  g.roundRect(-5.5, 18, 12, 8, 3).fill(0x2b1d12);
}

export function drawTorso(g: Graphics, c: Character) {
  g.clear();

  if (c.hat === "fee") {
    g.ellipse(-18, TORSO_TOP + 9, 13, 26).fill({ color: 0xb9f4e7, alpha: 0.58 });
    g.ellipse(18, TORSO_TOP + 9, 13, 26).fill({ color: 0xb9f4e7, alpha: 0.58 });
    g.ellipse(-20, TORSO_TOP + 28, 10, 20).fill({ color: 0x8fd7e8, alpha: 0.48 });
    g.ellipse(20, TORSO_TOP + 28, 10, 20).fill({ color: 0x8fd7e8, alpha: 0.48 });
  } else if (c.hat === "vampire") {
    g.poly([-27, TORSO_TOP - 2, 27, TORSO_TOP - 2, 22, LEG_TOP + 8, 0, LEG_TOP - 2, -22, LEG_TOP + 8], true).fill(
      c.palette.robeDark,
    );
  } else if (c.hat === "demon") {
    g.moveTo(-12, LEG_TOP - 2);
    g.quadraticCurveTo(-35, LEG_TOP + 10, -31, TORSO_TOP + 20);
    g.stroke({ width: 4, color: c.palette.skin, cap: "round" });
    g.poly([-35, TORSO_TOP + 17, -27, TORSO_TOP + 14, -30, TORSO_TOP + 24], true).fill(
      c.palette.trim,
    );
  }

  // Tunique légèrement évasée : lit mieux qu'un rectangle, même à petite taille.
  g.poly(
    [-15, TORSO_TOP, 15, TORSO_TOP, 19, LEG_TOP + 2, -19, LEG_TOP + 2],
    true,
  ).fill(c.palette.robe);

  g.poly([-15, TORSO_TOP, -6, TORSO_TOP, -10, LEG_TOP + 2, -19, LEG_TOP + 2], true).fill({
    color: c.palette.robeDark,
    alpha: 0.55,
  });

  g.rect(-19, LEG_TOP - 8, 38, 7).fill(c.palette.trim);
  g.circle(0, LEG_TOP - 4.5, 4).fill(GOLD_LIGHT);

  // Col et épaules.
  g.roundRect(-17, TORSO_TOP - 3, 34, 9, 4).fill(c.palette.trim);
}

export function drawArms(g: Graphics, c: Character) {
  g.clear();
  g.roundRect(-3.5, 0, 7, 30, 3.5).fill(c.palette.robe);
  g.circle(0, 30, 4.2).fill(c.palette.skin);
}

export function drawHead(g: Graphics, c: Character) {
  g.clear();

  g.circle(0, HEAD_Y, HEAD_R).fill(c.palette.skin);
  g.circle(-5, HEAD_Y - 1, 1.9).fill(0x2a1c12);
  g.circle(5, HEAD_Y - 1, 1.9).fill(0x2a1c12);
  g.ellipse(0, HEAD_Y + 7, 3.6, 2).fill({ color: 0x8a4a3a, alpha: 0.5 });

  const { robe, robeDark, trim } = c.palette;
  const top = HEAD_Y - HEAD_R;

  switch (c.hat) {
    case "pointu":
      g.ellipse(0, top + 3, 25, 6).fill(robeDark);
      g.poly([-15, top + 2, 15, top + 2, 5, top - 40], true).fill(robe);
      g.poly([5, top - 40, 9, top - 34, 13, top - 6], true).fill(robeDark);
      g.rect(-15, top - 2, 30, 6).fill(trim);
      g.circle(6, top - 38, 3.4).fill(GOLD_LIGHT);
      break;

    case "casque":
      g.circle(0, HEAD_Y - 3, HEAD_R + 2.5).fill(0x9aa5b4);
      g.rect(-HEAD_R - 2.5, HEAD_Y - 5, (HEAD_R + 2.5) * 2, 7).fill(0x6e7887);
      g.rect(-2, HEAD_Y - 8, 4, 18).fill(0x6e7887);
      g.poly([-4, top - 4, 4, top - 4, 2, top - 24, -2, top - 22], true).fill(trim);
      break;

    case "capuche":
      g.poly(
        [-HEAD_R - 4, HEAD_Y + 10, -HEAD_R - 2, top - 6, 0, top - 12, HEAD_R + 2, top - 6, HEAD_R + 4, HEAD_Y + 10],
        true,
      ).fill(robe);
      // Visage dans l'ombre : deux yeux qui luisent, rien d'autre.
      g.ellipse(0, HEAD_Y + 1, HEAD_R - 2, HEAD_R - 3).fill({
        color: 0x120c18,
        alpha: 0.82,
      });
      g.circle(-4.5, HEAD_Y, 1.8).fill(trim);
      g.circle(4.5, HEAD_Y, 1.8).fill(trim);
      break;

    case "couronne":
      g.ellipse(0, top + 4, HEAD_R + 1, 5).fill(0x6b4a2a);
      g.rect(-12, top - 4, 24, 8).fill(GOLD);
      for (const x of [-9, 0, 9]) {
        g.poly([x - 4, top - 4, x + 4, top - 4, x, top - 14], true).fill(GOLD);
        g.circle(x, top - 15, 2.2).fill(GOLD_LIGHT);
      }
      break;

    case "plume":
      g.ellipse(0, top + 2, HEAD_R + 3, 7).fill(robeDark);
      g.roundRect(-11, top - 10, 22, 13, 5).fill(robe);
      g.moveTo(9, top - 6);
      g.quadraticCurveTo(24, top - 26, 12, top - 34);
      g.stroke({ width: 4.5, color: trim, cap: "round" });
      break;

    case "bandeau":
      g.poly([-HEAD_R - 3, HEAD_Y + 12, -HEAD_R, top + 1, HEAD_R, top + 1, HEAD_R + 3, HEAD_Y + 12], true).fill(
        robeDark,
      );
      g.rect(-HEAD_R - 1, HEAD_Y - 9, (HEAD_R + 1) * 2, 6).fill(trim);
      // Feuille glissée dans le bandeau.
      g.ellipse(HEAD_R + 2, HEAD_Y - 12, 8, 3.4).fill(trim);
      break;

    case "licorne":
      g.poly([-13, top + 2, -22, top - 10, -7, top - 5], true).fill(c.palette.skin);
      g.poly([13, top + 2, 22, top - 10, 7, top - 5], true).fill(c.palette.skin);
      g.poly([-5, top - 5, 4, top - 5, 1, top - 40], true).fill(0xffe49b);
      g.moveTo(-12, top - 1);
      g.quadraticCurveTo(-2, top - 17, 15, top - 4);
      g.stroke({ width: 6, color: robe, cap: "round" });
      g.circle(-5, HEAD_Y - 1, 2.2).fill(0x41233c);
      g.circle(5, HEAD_Y - 1, 2.2).fill(0x41233c);
      break;

    case "squelette":
      g.circle(0, HEAD_Y, HEAD_R + 1).fill(c.palette.skin);
      g.roundRect(-10, HEAD_Y + 7, 20, 12, 4).fill(c.palette.skin);
      g.ellipse(-5.5, HEAD_Y - 3, 4.5, 5.5).fill(0x17151a);
      g.ellipse(5.5, HEAD_Y - 3, 4.5, 5.5).fill(0x17151a);
      g.poly([-3, HEAD_Y + 5, 3, HEAD_Y + 5, 0, HEAD_Y + 10], true).fill(0x17151a);
      for (const x of [-6, -2, 2, 6]) g.rect(x, HEAD_Y + 12, 2, 6).fill(0x6e6659);
      break;

    case "fee":
      g.poly([-15, top + 2, -22, top - 9, -8, top - 5], true).fill(c.palette.skin);
      g.poly([15, top + 2, 22, top - 9, 8, top - 5], true).fill(c.palette.skin);
      g.moveTo(-13, top + 1);
      g.lineTo(0, top - 10);
      g.lineTo(13, top + 1);
      g.stroke({ width: 3, color: trim, join: "round" });
      g.star(0, top - 11, 5, 4.5).fill(GOLD_LIGHT);
      break;

    case "demon":
      g.poly([-11, top + 1, -24, top - 27, -5, top - 11], true).fill(robeDark);
      g.poly([11, top + 1, 24, top - 27, 5, top - 11], true).fill(robeDark);
      g.circle(-5, HEAD_Y - 1, 2.2).fill(0xffd56b);
      g.circle(5, HEAD_Y - 1, 2.2).fill(0xffd56b);
      break;

    case "vampire":
      g.poly([-HEAD_R - 1, HEAD_Y - 6, -10, top - 9, 0, top - 3, 9, top - 11, HEAD_R + 1, HEAD_Y - 6], true).fill(
        0x16111b,
      );
      g.poly([-6, HEAD_Y + 7, -2, HEAD_Y + 11, -4, HEAD_Y + 14], true).fill(0xffffff);
      g.poly([6, HEAD_Y + 7, 2, HEAD_Y + 11, 4, HEAD_Y + 14], true).fill(0xffffff);
      break;

    case "peluche":
      g.circle(-11, top + 1, 8).fill(c.palette.skin);
      g.circle(11, top + 1, 8).fill(c.palette.skin);
      g.circle(0, HEAD_Y, HEAD_R + 2).fill(c.palette.skin);
      g.circle(-5, HEAD_Y - 2, 2).fill(0x21160e);
      g.circle(5, HEAD_Y - 2, 2).fill(0x21160e);
      g.ellipse(0, HEAD_Y + 6, 7, 5).fill(0xdba16d);
      g.circle(0, HEAD_Y + 4, 2.5).fill(0x21160e);
      break;

    case "casquette":
      g.ellipse(0, top + 2, HEAD_R + 3, 6).fill(robeDark);
      g.roundRect(-14, top - 10, 27, 13, 6).fill(robe);
      g.poly([8, top - 1, 27, top + 2, 9, top + 6], true).fill(trim);
      break;
  }
}

/** L'arme ou l'attribut tenu en main. Nommé « held » pour ne pas croiser le décor. */
export function drawHeld(g: Graphics, c: Character) {
  g.clear();
  const { trim, robeDark } = c.palette;

  switch (c.prop) {
    case "luth":
      g.ellipse(0, 8, 9, 12).fill(0xb5793c);
      g.ellipse(0, 8, 5.5, 8).fill(0x8a5628);
      g.rect(-1.6, -22, 3.2, 26).fill(0x6b4423);
      g.rect(-4, -26, 8, 6).fill(0x8a5628);
      for (const dx of [-1.2, 0, 1.2]) {
        g.moveTo(dx, -20);
        g.lineTo(dx, 6);
        g.stroke({ width: 0.7, color: GOLD_LIGHT, alpha: 0.8 });
      }
      break;

    case "baton":
      g.roundRect(-2, -44, 4, 74, 2).fill(0x7a5230);
      g.circle(0, -48, 8).fill({ color: trim, alpha: 0.3 });
      g.circle(0, -48, 5).fill(trim);
      g.circle(-1.5, -49.5, 1.8).fill(0xffffff);
      break;

    case "epee":
      g.poly([-3, 6, 3, 6, 2.5, -34, 0, -40, -2.5, -34], true).fill(0xd6dde6);
      g.poly([-3, 6, 0, 6, 0, -36, -2.5, -34], true).fill(0x9aa5b4);
      g.rect(-9, 4, 18, 5).fill(GOLD);
      g.roundRect(-2.6, 9, 5.2, 14, 2).fill(0x5a3d24);
      g.circle(0, 25, 3.2).fill(GOLD);
      break;

    case "dague":
      g.poly([-2.4, 4, 2.4, 4, 1.8, -18, 0, -22, -1.8, -18], true).fill(0xc9d2dc);
      g.rect(-6, 3, 12, 4).fill(0x4a4a4a);
      g.roundRect(-2, 6, 4, 10, 2).fill(0x2f2f2f);
      break;

    case "grimoire":
      g.roundRect(-11, -6, 22, 27, 2).fill(robeDark);
      g.roundRect(-8.5, -3.5, 17, 22, 1.5).fill(0xe8dcc0);
      g.rect(-11, -6, 4, 27).fill(GOLD);
      for (let i = 0; i < 4; i++) {
        g.moveTo(-6, 2 + i * 4.5);
        g.lineTo(7, 2 + i * 4.5);
        g.stroke({ width: 1, color: 0x9a8a6a, alpha: 0.7 });
      }
      break;

    case "lance":
      g.roundRect(-2, -46, 4, 90, 2).fill(0x7a5230);
      g.poly([-5, -46, 5, -46, 0, -64], true).fill(0xd6dde6);
      g.rect(-5.5, -44, 11, 4).fill(GOLD);
      // Fanion : le seul qui flotte au vent.
      g.poly([2, -42, 20, -36, 2, -28], true).fill(trim);
      break;

    case "arcenciel":
      for (let i = 0; i < 4; i++) {
        g.arc(0, 8, 10 + i * 3.2, Math.PI, Math.PI * 2).stroke({
          width: 3,
          color: [0xf06b7a, 0xf2c85b, 0x6fd49a, 0x78b9ef][i],
        });
      }
      g.circle(-16, 9, 5).fill(0xffffff);
      g.circle(16, 9, 5).fill(0xffffff);
      break;

    case "faux":
      g.roundRect(-2, -42, 4, 75, 2).fill(0x6f4a2a);
      g.moveTo(0, -40);
      g.quadraticCurveTo(32, -43, 34, -18);
      g.quadraticCurveTo(18, -32, 0, -31);
      g.fill(0xd6dde6);
      break;

    case "baguette":
      g.roundRect(-1.8, -31, 3.6, 54, 2).fill(0x8b5d32);
      g.star(0, -36, 5, 8).fill(trim);
      g.circle(0, -36, 13).fill({ color: trim, alpha: 0.2 });
      break;

    case "fourche":
      g.roundRect(-2, -45, 4, 82, 2).fill(robeDark);
      for (const x of [-9, 0, 9]) {
        g.moveTo(x, -45);
        g.lineTo(x, -61);
        g.stroke({ width: 3.5, color: trim, cap: "round" });
      }
      g.moveTo(-9, -45);
      g.lineTo(9, -45);
      g.stroke({ width: 3.5, color: trim });
      break;

    case "ombrelle":
      g.moveTo(0, -29);
      g.lineTo(0, 26);
      g.quadraticCurveTo(0, 34, 7, 28);
      g.stroke({ width: 3, color: GOLD });
      g.arc(0, -29, 23, Math.PI, Math.PI * 2).lineTo(23, -29).fill(robeDark);
      g.moveTo(-23, -29);
      g.lineTo(23, -29);
      g.stroke({ width: 2, color: trim });
      break;

    case "miel":
      g.roundRect(-11, -5, 22, 24, 5).fill(0xd99531);
      g.rect(-12, -3, 24, 6).fill(trim);
      g.roundRect(-9, -11, 18, 7, 3).fill(0x76502d);
      g.circle(0, 8, 4).fill(GOLD_LIGHT);
      break;

    case "skate":
      g.roundRect(-8, -32, 14, 58, 7).fill(trim);
      g.roundRect(-5, -29, 8, 52, 4).fill(robeDark);
      g.circle(-7, -23, 3).fill(0x171717);
      g.circle(5, 20, 3).fill(0x171717);
      break;
  }
}

/* ------------------------------------------------------------------ plaque */

function drawPlate(g: Graphics, width: number, isMe: boolean) {
  g.clear();
  const h = 24;
  g.roundRect(-width / 2, 0, width, h, 5).fill({ color: 0x1d1409, alpha: 0.82 });
  g.roundRect(-width / 2, 0, width, h, 5).stroke({
    width: isMe ? 2.5 : 1.4,
    color: isMe ? GOLD_LIGHT : GOLD,
    alpha: isMe ? 1 : 0.55,
  });
}

/** Flèche dorée : c'est toi. */
function drawMarker(g: Graphics) {
  g.clear();
  g.poly([-9, -10, 9, -10, 0, 4], true).fill(GOLD_LIGHT);
  g.poly([-9, -10, 9, -10, 0, 4], true).stroke({ width: 1.5, color: 0x6b4a10 });
}

/** Coupe brandie par les personnages engagés : ils ont quitté la course. */
function drawTrophy(g: Graphics) {
  g.clear();
  g.poly([-9, -12, 9, -12, 6, 2, -6, 2], true).fill(GOLD);
  g.ellipse(0, -12, 9, 3).fill(GOLD_LIGHT);
  g.moveTo(-9, -9);
  g.quadraticCurveTo(-16, -4, -8, -1);
  g.moveTo(9, -9);
  g.quadraticCurveTo(16, -4, 8, -1);
  g.stroke({ width: 2.2, color: GOLD });
  g.rect(-2.5, 2, 5, 7).fill(GOLD);
  g.roundRect(-7, 9, 14, 4, 2).fill(GOLD_LIGHT);
}

function drawShadow(g: Graphics) {
  g.clear();
  g.ellipse(0, 0, 24, 7).fill({ color: 0x000000, alpha: 0.3 });
}

/* ------------------------------------------------------------------ composant */

export interface HeroProps {
  player: PlayerView;
  isMe: boolean;
  /** Le suivi lit la position animée, jamais la destination brute. */
  isFocused: boolean;
  /** Décalage en profondeur, pour que deux personnages au même endroit se distinguent. */
  lane: { dx: number; dy: number; scale: number };
}

export function Hero({ player, isMe, isFocused, lane }: HeroProps) {
  const character = useMemo(() => characterById(player.characterId), [player.characterId]);
  const sprite = useCharacterSprite(player.characterId);
  const actionFrames = useCharacterActionFrames(player.characterId);
  const jumpFrames = useCharacterJumpFrames(player.characterId);
  const paintedFrames = actionFrames ?? jumpFrames;
  const fineActionSheet = Boolean(actionFrames && actionFrames.length >= 24);
  const nativeFacing = characterNativeFacing(player.characterId);
  const jumpNativeFacing = characterJumpNativeFacing(player.characterId);

  const root = useRef<Container>(null);
  const rig = useRef<Container>(null);
  const legL = useRef<Graphics>(null);
  const legR = useRef<Graphics>(null);
  const armFree = useRef<Container>(null);
  const armProp = useRef<Container>(null);
  const actionSprite = useRef<Sprite>(null);
  const labelRoot = useRef<Container>(null);
  const selfMarker = useRef<Container>(null);

  const target = worldXFor(player.position) + lane.dx;
  const at = useRef(target);
  const movementDelay = useRef(0);
  const travelQueue = useRef<Array<{ target: number; steps: number }>>([]);
  const travel = useRef<TravelLeg | null>(null);
  const lastDirection = useRef<1 | -1>(1);
  // Déphasage tiré de l'identifiant : les personnages ne respirent pas à l'unisson,
  // et le tirage reste le même d'un rendu à l'autre.
  const phase = useRef(seededRandom(hash(player.id))() * Math.PI * 2);
  const stun = useRef(0);
  const impact = useRef(0);
  const actionKind = useRef<
    "candidature" | "refus" | "rejet" | "embauche" | null
  >(null);
  const actionTimer = useRef(0);
  const actionDuration = useRef(1);

  const seen = useRef({
    journeySteps: player.journeySteps,
    counts: { ...player.counts },
    hiredAt: player.hiredAt,
  });

  useEffect(() => {
    const stepDelta = player.journeySteps - seen.current.journeySteps;
    const justHired =
      player.counts.embauche > seen.current.counts.embauche ||
      (Boolean(player.hiredAt) && player.hiredAt !== seen.current.hiredAt);
    if (stepDelta !== 0) {
      travelQueue.current.push({ target, steps: Math.abs(stepDelta) });
    } else if (justHired && Math.abs(target - at.current) > 1) {
      travelQueue.current.push({ target, steps: 6 });
    }
    const before = seen.current.counts;

    if (player.counts.candidature > before.candidature) {
      actionKind.current = "candidature";
      actionTimer.current = 1;
      actionDuration.current = 1;
      movementDelay.current = 1;
    }
    if (player.counts.entretien > before.entretien) {
      actionKind.current = "candidature";
      actionTimer.current = 1.15;
      actionDuration.current = 1.15;
      movementDelay.current = 1.15;
    }
    if (player.counts.refus > before.refus) {
      actionKind.current = "refus";
      actionTimer.current = 1.25;
      actionDuration.current = 1.25;
      movementDelay.current = 1.25;
      stun.current = 1;
    }
    if (player.counts.rejetApresEntretien > before.rejetApresEntretien) {
      actionKind.current = "rejet";
      actionTimer.current = 1.75;
      actionDuration.current = 1.75;
      movementDelay.current = 1.75;
      stun.current = 1.25;
    }
    if (justHired) {
      actionKind.current = "embauche";
      actionTimer.current = 2;
      actionDuration.current = 2;
      movementDelay.current = 2;
    }

    seen.current = {
      journeySteps: player.journeySteps,
      counts: { ...player.counts },
      hiredAt: player.hiredAt,
    };
  }, [player.counts, player.hiredAt, player.journeySteps, target]);

  useTick((ticker) => {
    const dt = Math.min(ticker.deltaMS, 60) / 1000;

    if (movementDelay.current > 0) {
      movementDelay.current = Math.max(0, movementDelay.current - dt);
    }

    if (!travel.current && movementDelay.current === 0) {
      const next = travelQueue.current.shift();
      if (next && Math.abs(next.target - at.current) > 0.5) {
        const direction = next.target >= at.current ? 1 : -1;
        travel.current = {
          from: at.current,
          to: next.target,
          steps: Math.max(1, next.steps),
          index: 0,
          elapsed: 0,
        };
        lastDirection.current = direction;
      }
    }

    let moving = Boolean(travel.current);
    let strideProgress = 0;
    const activeTravel = travel.current;
    if (activeTravel) {
      activeTravel.elapsed += dt;
      while (
        activeTravel.elapsed >= STRIDE_DURATION &&
        activeTravel.index < activeTravel.steps
      ) {
        activeTravel.elapsed -= STRIDE_DURATION;
        activeTravel.index += 1;
        at.current =
          activeTravel.from +
          ((activeTravel.to - activeTravel.from) * activeTravel.index) /
            activeTravel.steps;
        impact.current = 1;
        scene.shake = Math.max(scene.shake, 0.045);
      }

      if (activeTravel.index >= activeTravel.steps) {
        at.current = activeTravel.to;
        travel.current = null;
        moving = false;
      } else {
        strideProgress = activeTravel.elapsed / STRIDE_DURATION;
        const eased =
          strideProgress * strideProgress * (3 - 2 * strideProgress);
        const start =
          activeTravel.from +
          ((activeTravel.to - activeTravel.from) * activeTravel.index) /
            activeTravel.steps;
        const end =
          activeTravel.from +
          ((activeTravel.to - activeTravel.from) *
            (activeTravel.index + 1)) /
            activeTravel.steps;
        at.current = start + (end - start) * eased;
      }
    }

    if (isFocused) {
      scene.targetFocus = at.current;
      if (!scene.dragging) scene.focusSpeed = moving ? 10 : 1.35;
    }

    phase.current += dt * (moving ? 7.5 : 2.2);

    if (stun.current > 0) stun.current = Math.max(0, stun.current - dt / 1.25);
    if (impact.current > 0) impact.current = Math.max(0, impact.current - dt / 0.3);
    if (actionTimer.current > 0) actionTimer.current = Math.max(0, actionTimer.current - dt);

    const hop = moving ? Math.sin(strideProgress * Math.PI) * 38 : 0;
    const baseBob = fineActionSheet
      ? 0
      : character.hat === "vampire"
        ? Math.sin(phase.current * 0.45) * 2
        : moving
          ? Math.abs(Math.sin(phase.current)) *
            (character.hat === "peluche" ? 5.2 : 3.4)
          : Math.sin(phase.current) * 2.2;
    const speciesLift =
      character.hat === "fee" ? 10 + Math.sin(phase.current * 0.72) * 4 : 0;

    const node = root.current;
    if (node) {
      node.x = at.current;
      node.y = surfaceAt(at.current) + 4 + lane.dy;
    }

    if (labelRoot.current) {
      labelRoot.current.scale.set(1);
      labelRoot.current.y = 14;
    }
    if (selfMarker.current) {
      selfMarker.current.scale.set(1);
      selfMarker.current.y = -HERO_HEIGHT - 16;
    }

    const body = rig.current;
    if (body) {
      body.y = -hop - baseBob - speciesLift;
      // Électrocuté : le personnage part en arrière et tremble.
      body.rotation = fineActionSheet
        ? stun.current > 0
          ? Math.sin(stun.current * 34) * 0.055 * stun.current
          : slopeAt(at.current) * 0.16
        : stun.current > 0
          ? Math.sin(stun.current * 42) * 0.26 * stun.current
          : slopeAt(at.current) * 0.5 +
            (moving && character.hat === "casquette" ? -0.08 : 0);
      const landing =
        Math.sin(impact.current * Math.PI) * (fineActionSheet ? 0.045 : 0.13);
      body.scale.y = 1 - landing;
      body.scale.x = 1 + landing * (fineActionSheet ? 0.28 : 0.58);
    }

    const swing = moving
      ? Math.sin(phase.current) * 0.8
      : Math.sin(phase.current) * 0.06;
    if (legL.current) legL.current.rotation = swing;
    if (legR.current) legR.current.rotation = -swing;
    if (armFree.current) armFree.current.rotation = -swing * 0.7;
    if (armProp.current) {
      // Le bras d'arme se lève quand le personnage prend la foudre.
      armProp.current.rotation = swing * 0.35 - (stun.current > 0 ? 0.9 : 0);
    }
    if (paintedFrames && actionSprite.current) {
      let nextTexture = paintedFrames[0];
      let frameFacing = nativeFacing;
      if (moving && jumpFrames) {
        const frame = Math.min(
          jumpFrames.length - 1,
          Math.floor(strideProgress * jumpFrames.length),
        );
        nextTexture = jumpFrames[frame];
        frameFacing = jumpNativeFacing;
      } else if (actionFrames && fineActionSheet) {
        let frame: number;
        if (player.hiredAt) {
          frame = 5;
        } else if (actionTimer.current > 0 && actionKind.current) {
          const start = actionKind.current === "candidature" ? 12 : 18;
          const progress = 1 - actionTimer.current / actionDuration.current;
          frame = start + Math.min(5, Math.floor(progress * 6));
        } else {
          frame = moving
            ? 6 + (Math.floor(phase.current * 0.82) % 6)
            : Math.floor(phase.current * 0.72) % 6;
        }
        nextTexture = actionFrames[frame];
      } else if (actionFrames) {
        const loopFrame = moving
          ? 2 + (Math.floor(phase.current * 0.42) & 1)
          : Math.floor(phase.current * 0.34) & 1;
        const actionPose =
          actionKind.current === "candidature"
            ? 4
            : actionKind.current === "refus"
              ? 5
              : actionKind.current === "rejet"
                ? 6
                : 7;
        const frame = player.hiredAt
          ? 7
          : actionTimer.current > 0
            ? actionPose
            : loopFrame;
        nextTexture = actionFrames[frame];
      }
      if (actionSprite.current.texture !== nextTexture) {
        actionSprite.current.texture = nextTexture;
      }
      // Le sens natif appartient à l'asset. Le sens du voyage appartient au jeu :
      // un idle conserve donc le dernier regard au lieu de revenir arbitrairement.
      const horizontalScale = Math.abs(actionSprite.current.scale.x);
      actionSprite.current.scale.x =
        horizontalScale *
        (frameFacing === "right" ? 1 : -1) *
        lastDirection.current;
    }
  });

  const label = `${player.name} · Nv ${player.level}`;
  const plateWidth = Math.max(104, label.length * 9.6 + 26);
  const paintPlate = useCallback(
    (g: Graphics) => drawPlate(g, plateWidth, isMe),
    [plateWidth, isMe],
  );
  const paintLeg = useCallback((g: Graphics) => drawLeg(g, character), [character]);
  const paintTorso = useCallback((g: Graphics) => drawTorso(g, character), [character]);
  const paintArms = useCallback((g: Graphics) => drawArms(g, character), [character]);
  const paintHead = useCallback((g: Graphics) => drawHead(g, character), [character]);
  const paintProp = useCallback((g: Graphics) => drawHeld(g, character), [character]);

  return (
    <pixiContainer ref={root} x={target} scale={lane.scale}>
      <pixiGraphics draw={drawShadow} />

      <pixiContainer ref={rig}>
        {paintedFrames ? (
          <pixiSprite
            ref={actionSprite}
            texture={paintedFrames[0]}
            anchor={{ x: 0.5, y: 0.96 }}
            width={fineActionSheet ? 118 : 92}
            height={fineActionSheet ? HERO_HEIGHT + 38 : HERO_HEIGHT + 14}
          />
        ) : sprite ? (
          <pixiSprite
            texture={sprite}
            anchor={{ x: 0.5, y: 1 }}
            width={74}
            height={HERO_HEIGHT}
          />
        ) : (
          <pixiContainer>
            <pixiContainer ref={legL} x={-6} y={LEG_TOP}>
              <pixiGraphics draw={paintLeg} />
            </pixiContainer>
            <pixiContainer ref={legR} x={6} y={LEG_TOP}>
              <pixiGraphics draw={paintLeg} />
            </pixiContainer>

            <pixiContainer ref={armFree} x={-13} y={TORSO_TOP + 8}>
              <pixiGraphics draw={paintArms} />
            </pixiContainer>

            <pixiGraphics draw={paintTorso} />
            <pixiGraphics draw={paintHead} />

            <pixiContainer ref={armProp} x={14} y={TORSO_TOP + 8}>
              <pixiGraphics draw={paintArms} />
              <pixiContainer y={30}>
                <pixiGraphics draw={paintProp} />
              </pixiContainer>
            </pixiContainer>
          </pixiContainer>
        )}

        {player.hiredAt ? (
          <pixiContainer y={-HERO_HEIGHT - 14}>
            <pixiGraphics draw={drawTrophy} />
          </pixiContainer>
        ) : null}
      </pixiContainer>

      {isMe ? (
        <pixiContainer ref={selfMarker} y={-HERO_HEIGHT - 46}>
          <pixiGraphics draw={drawMarker} />
        </pixiContainer>
      ) : null}

      <pixiContainer ref={labelRoot} y={14}>
        <pixiGraphics draw={paintPlate} />
        <pixiText
          text={label}
          style={isMe ? NAME_STYLE : TAG_STYLE}
          anchor={{ x: 0.5, y: 0.5 }}
          y={12}
        />
      </pixiContainer>
    </pixiContainer>
  );
}
