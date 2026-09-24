"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import type { Container, Graphics, Sprite } from "pixi.js";
import type { PlayerView } from "@/hooks/useGame";
import { characterArt, characterById, staticCharacterFacing } from "@/lib/game/characters";
import { seededRandom } from "@/lib/rng";
import { biomeAt, slopeAt, surfaceAt, WORLD_LENGTH, worldXFor } from "@/lib/game/world";
import { sfx } from "@/lib/client/sound";
import { markMotion, scene, worldDelta } from "./scene";
import { fx, fxTexture } from "./fx";
import { atlasFrames, useDirectTexture } from "./textures";
import { CHARACTER_ANIMATIONS, characterFrame, poseFacing, type HeroMotion } from "./animation";
import { GOLD_LIGHT, NAME_STYLE, TAG_STYLE } from "./style";

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
 * Les silhouettes approuvées sont des découpes de papier opaques. Le ticker anime
 * les poses du sprite et leur mouvement, avec une échelle et un sol communs.
 */

/** Hauteur du personnage, unités monde. Le repère local a les pieds en (0, 0). */
export const HERO_HEIGHT = 164;
/**
 * Seconds a hero reacts on the spot before walking: the pose, the stun and the
 * impact of the reaction all land before the journey starts.
 */
export const REACTION_HOLD = { candidature: 0.75, refus: 0.95, entretien: 0.85, rejetApresEntretien: 1.35, embauche: 1.1 } as const;
/**
 * How a hero covers a leg: a bouncy trot for a few steps, a sprint for a long
 * run, and for a setback a knock backwards before stumbling back, still facing
 * the road ahead.
 */
type Gait = "trot" | "dash" | "knockback";

interface TravelLeg {
  from: number;
  to: number;
  steps: number;
  index: number;
  elapsed: number;
  gait: Gait;
  /** Seconds since the last speed line. */
  streak: number;
}

/** Seconds per step: a sprint winds up, a knockback flies, then both settle into their pace. */
function strideFor(leg: TravelLeg): number {
  if (leg.gait === "dash") return leg.index === 0 ? 0.3 : 0.19;
  if (leg.gait === "knockback") return leg.index === 0 ? 0.52 : 0.27;
  return 0.3;
}

/** Share of a step covered at progress p: the sprint starts slow, the knock starts fast. */
function strideEase(leg: TravelLeg, p: number): number {
  if (leg.index > 0) return p;
  if (leg.gait === "dash") return p * p;
  if (leg.gait === "knockback") return 1 - (1 - p) * (1 - p);
  return p;
}

const WATER = new Set(["marais", "lac", "cascade"]);

/** What a footfall kicks up, by land: dust, leaves, splashes, snow or sand. */
function footfall(x: number, y: number, count: number, direction: 1 | -1) {
  const land = biomeAt(((x % WORLD_LENGTH) + WORLD_LENGTH) % WORLD_LENGTH).id;
  const angle = -Math.PI / 2 - direction * 0.5;
  if (WATER.has(land)) {
    fx.burst({ preset: "splash", x, y, count: count + 2, spreadX: 10, angle });
    fx.burst({ preset: "puff", x, y, count: 1, colors: [0xcfe4ea, 0xa9c4c8] });
    return;
  }
  const colors = land === "montagne" ? [0xffffff, 0xe6eef6, 0xcbd6e0]
    : land === "desert" ? [0xe8cf96, 0xd8b476, 0xf3e0b4]
      : land === "taverne" ? [0x8a7560, 0x6d5c4a, 0xa89178]
        : land === "foret" ? [0xa08a64, 0x86734f, 0xbfae84]
          : [0xcdb68d, 0xb59b72, 0xe0cfa8];
  fx.burst({ preset: "puff", x, y, count, spreadX: 8, colors, angle });
  if (land === "foret" && Math.random() < 0.5) fx.burst({ preset: "kickLeaves", x, y: y - 6, count: 2, angle });
}

const INK = 0x211b18;

/* ------------------------------------------------------------------ plaque */

function drawPlate(g: Graphics, width: number, isMe: boolean) {
  g.clear();
  const h = 24;
  g.poly(
    [-width / 2, 2, width / 2 - 2, 0, width / 2, h - 3, -width / 2 + 3, h],
    true,
  )
    .fill({ color: isMe ? 0xf0d28a : 0xdfc58f, alpha: 0.96 })
    .stroke({ width: isMe ? 2.8 : 2, color: INK, join: "round" });
}

/** Flèche dorée : c'est toi. */
function drawSelfGlow(g: Graphics) {
  g.clear();
  g.ellipse(0, 2, 58, 13).fill({ color: 0xffd76c, alpha: 0.28 });
  g.ellipse(0, 2, 40, 9).fill({ color: 0xfff1bd, alpha: 0.35 });
}

function drawMarker(g: Graphics) {
  g.clear();
  g.poly([-9, -10, 9, -10, 0, 4], true).fill(GOLD_LIGHT);
  g.poly([-9, -10, 9, -10, 0, 4], true).stroke({ width: 1.5, color: 0x6b4a10 });
}

function HiredCrown() {
  const texture = useDirectTexture("/art/world-v3/ui/ui-crown.webp");
  return texture ? <pixiSprite texture={texture} anchor={0.5} y={-HERO_HEIGHT - 22} width={65} height={65} /> : null;
}

function drawShadow(g: Graphics) {
  g.clear();
  g.ellipse(0, 1, 31, 9).fill({ color: 0x000000, alpha: 0.48 });
}

/* ------------------------------------------------------------------ composant */

export interface HeroProps {
  player: PlayerView;
  isMe: boolean;
  /** Le suivi lit la position animée, jamais la destination brute. */
  isFocused: boolean;
  /** Décalage en profondeur, pour que deux personnages au même endroit se distinguent. */
  lane: { dx: number; dy: number; scale: number };
  onTravelDone?: (playerId: string) => void;
  onReady?: () => void;
  previewMotion?: HeroMotion;
}

export function Hero({ player, isMe, isFocused, lane, onTravelDone, onReady, previewMotion }: HeroProps) {
  const character = useMemo(() => characterById(player.characterId), [player.characterId]);

  const root = useRef<Container>(null);
  const rig = useRef<Container>(null);
  const animation = CHARACTER_ANIMATIONS[character.id];
  const texture = useDirectTexture(animation?.url ?? characterArt(character.id));
  useEffect(() => {
    if (texture) onReady?.();
  }, [texture, onReady]);
  const poses = texture && animation ? atlasFrames(texture, animation.columns, animation.rows) : null;
  const art = useRef<Sprite>(null);
  const elapsed = useRef(0);
  const labelRoot = useRef<Container>(null);
  const selfMarker = useRef<Container>(null);
  const selfGlow = useRef<Graphics>(null);
  const lantern = useRef<Sprite>(null);

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
  const actionKind = useRef<
    "candidature" | "refus" | "rejet" | "embauche" | null
  >(null);
  const actionTimer = useRef(0);
  const actionDuration = useRef(1);
  /** 1 on the frame a leg ends, fading: the landing squash. */
  const landing = useRef(0);

  const seen = useRef({
    target,
    journeySteps: player.journeySteps,
    counts: { ...player.counts },
    hiredAt: player.hiredAt,
  });

  useEffect(() => {
    const stepDelta = player.journeySteps - seen.current.journeySteps;
    const justHired =
      player.counts.embauche > seen.current.counts.embauche ||
      (Boolean(player.hiredAt) && player.hiredAt !== seen.current.hiredAt);
    const countsChanged = Object.entries(player.counts).some(([key, count]) => count !== seen.current.counts[key as keyof typeof seen.current.counts]);
    if (stepDelta !== 0 || target !== seen.current.target || countsChanged) {
      travelQueue.current.push({ target, steps: stepDelta !== 0 ? Math.abs(stepDelta) : 6 });
    }
    const before = seen.current.counts;

    if (player.counts.candidature > before.candidature) {
      actionKind.current = "candidature";
      actionTimer.current = 1;
      actionDuration.current = 1;
      movementDelay.current = REACTION_HOLD.candidature;
    }
    if (player.counts.entretien > before.entretien) {
      actionKind.current = "candidature";
      actionTimer.current = 1.15;
      actionDuration.current = 1.15;
      movementDelay.current = REACTION_HOLD.entretien;
    }
    if (player.counts.refus > before.refus) {
      actionKind.current = "refus";
      actionTimer.current = 1.25;
      actionDuration.current = 1.25;
      movementDelay.current = REACTION_HOLD.refus;
      stun.current = 1;
    }
    if (player.counts.rejetApresEntretien > before.rejetApresEntretien) {
      actionKind.current = "rejet";
      actionTimer.current = 1.75;
      actionDuration.current = 1.75;
      movementDelay.current = REACTION_HOLD.rejetApresEntretien;
      stun.current = 1.25;
    }
    if (justHired) {
      actionKind.current = "embauche";
      actionTimer.current = 2;
      actionDuration.current = 2;
      movementDelay.current = REACTION_HOLD.embauche;
    }

    seen.current = {
      target,
      journeySteps: player.journeySteps,
      counts: { ...player.counts },
      hiredAt: player.hiredAt,
    };
  }, [player.counts, player.hiredAt, player.journeySteps, target]);

  useTick({ priority: 100, callback: (ticker) => {
    // These are timed poses and travel interpolation, not a physics simulation.
    // Capping deltaMS stretches a two-second journey into minutes at low FPS.
    // Pixi resets elapsedMS on restart, so modal/hidden-tab pauses do not count.
    const dt = worldDelta(ticker.elapsedMS);
    elapsed.current += dt;

    if (movementDelay.current > 0) {
      movementDelay.current = scene.reducedMotion ? 0 : Math.max(0, movementDelay.current - dt);
    }

    if (!travel.current && movementDelay.current === 0) {
      const next = travelQueue.current.shift();
      if (next && Math.abs(next.target - at.current) <= 0.5) {
        // A clamped step at zero still completes the action sequence.
        onTravelDone?.(player.id);
      } else if (next) {
        const direction = next.target >= at.current ? 1 : -1;
        const gait: Gait = direction < 0 ? "knockback" : next.steps >= 5 ? "dash" : "trot";
        travel.current = {
          from: at.current,
          to: next.target,
          steps: Math.max(1, next.steps),
          index: 0,
          elapsed: 0,
          gait,
          streak: 0,
        };
        lastDirection.current = direction;
        if (!scene.reducedMotion && root.current?.visible) {
          const feet = surfaceAt(at.current) + 4 + lane.dy;
          if (gait === "knockback") {
            fx.burst({ preset: "stars", x: at.current, y: feet - HERO_HEIGHT, count: 7, power: 0.8 });
            if (isMe) sfx.boing();
          } else if (gait === "dash") {
            footfall(at.current, feet, 6, direction);
            if (isMe) sfx.whoosh();
          }
        }
      }
    }

    let moving = Boolean(travel.current);
    let strideProgress = 0;
    const activeTravel = travel.current;
    const gait = activeTravel?.gait ?? null;
    const legIndex = activeTravel?.index ?? 0;
    const feetY = surfaceAt(at.current) + 4 + lane.dy;
    const juicy = !scene.reducedMotion && Boolean(root.current?.visible);
    if (activeTravel) {
      activeTravel.elapsed += scene.reducedMotion ? dt * activeTravel.steps * 3 : dt;
      while (
        activeTravel.elapsed >= strideFor(activeTravel) &&
        activeTravel.index < activeTravel.steps
      ) {
        activeTravel.elapsed -= strideFor(activeTravel);
        activeTravel.index += 1;
        at.current =
          activeTravel.from +
          ((activeTravel.to - activeTravel.from) * activeTravel.index) /
            activeTravel.steps;
        if (juicy) footfall(at.current, feetY, activeTravel.gait === "dash" ? 4 : isMe ? 3 : 2, lastDirection.current);
      }

      if (activeTravel.index >= activeTravel.steps) {
        at.current = activeTravel.to;
        travel.current = null;
        moving = false;
        landing.current = 1;
        if (juicy) {
          const heavy = activeTravel.gait !== "trot";
          fx.burst({ preset: "puff", x: at.current, y: feetY, count: heavy ? 10 : 5, spreadX: 22 });
          if (heavy) {
            fx.burst({ preset: "shockwave", x: at.current, y: feetY - 6, count: 1, power: 0.28 });
            if (isFocused) scene.shake = Math.max(scene.shake, 0.18);
            if (isMe) sfx.land();
          }
        }
        onTravelDone?.(player.id);
      } else {
        strideProgress = activeTravel.elapsed / strideFor(activeTravel);
        // A steady speed between steps, except where the gait itself accelerates or brakes.
        const eased = strideEase(activeTravel, strideProgress);
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
      if (!scene.dragging) scene.focusSpeed = moving || Math.abs(scene.focus - at.current) > 20 ? 10 : 1.35;
    }

    phase.current += dt * (moving ? 7.5 : 2.2);

    if (stun.current > 0) stun.current = Math.max(0, stun.current - dt / 1.25);
    if (actionTimer.current > 0) actionTimer.current = Math.max(0, actionTimer.current - dt);
    if (moving || actionTimer.current > 0 || stun.current > 0) markMotion();
    if (isFocused && moving) scene.walkingUntil = performance.now() + 300;
    if (!previewMotion) scene.heroes.set(player.id, { x: at.current, y: surfaceAt(at.current) + 4 + lane.dy });

    // Speed lines stream behind a sprinter.
    if (activeTravel && gait === "dash" && legIndex > 0 && juicy) {
      activeTravel.streak += dt;
      if (activeTravel.streak > 0.05) {
        activeTravel.streak = 0;
        fx.burst({ preset: "streak", x: at.current - lastDirection.current * 40, y: feetY - 30 - Math.random() * HERO_HEIGHT * 0.8, count: 1, angle: lastDirection.current > 0 ? Math.PI : 0 });
      }
    }
    if (landing.current > 0) landing.current = Math.max(0, landing.current - dt / 0.22);

    const arc = Math.sin(strideProgress * Math.PI);
    const skater = character.id === "skater";
    const hop = !moving || scene.reducedMotion ? 0
      : gait === "knockback" && legIndex === 0 ? arc * 52
        : gait === "knockback" ? arc * 5
          : skater ? 0
            : gait === "dash" ? arc * 6 : Math.abs(arc) * 10;
    // Squash when a foot lands, stretch in the air, a firmer squash after a long run.
    const footfallSquash = moving && !skater && strideProgress < 0.14 ? (1 - strideProgress / 0.14) * (gait === "dash" ? 0.05 : 0.07) : 0;
    const squash = scene.reducedMotion ? 0 : footfallSquash + landing.current * 0.12 - (moving && !skater ? arc * 0.035 : 0);
    const speciesLift =
      character.hat === "fee" ? 10 + (scene.reducedMotion ? 0 : Math.sin(phase.current * 0.72) * 4) : 0;

    const node = root.current;
    if (node) {
      node.x = at.current;
      node.y = surfaceAt(at.current) + 4 + lane.dy;
      node.visible = at.current > scene.camera.x - 200 && at.current < scene.camera.x + scene.camera.viewW + 200;
      if (!node.visible) return;
    }

    if (labelRoot.current) {
      labelRoot.current.scale.set(1);
      labelRoot.current.y = 14;
    }
    if (selfMarker.current) {
      selfMarker.current.scale.set(1);
      selfMarker.current.y = -HERO_HEIGHT - 16 - (scene.reducedMotion ? 0 : Math.abs(Math.sin(phase.current * 1.3)) * 6);
    }
    if (lantern.current) {
      const glow = scene.night * 0.55 + scene.warm * 0.12;
      lantern.current.visible = glow > 0.02;
      if (lantern.current.visible) {
        lantern.current.alpha = glow * (isMe ? 0.5 : 0.32) * (scene.reducedMotion ? 1 : 0.94 + Math.sin(phase.current * 2.7) * 0.06);
        lantern.current.scale.set(440 / 48, 300 / 48);
      }
    }
    if (selfGlow.current) selfGlow.current.alpha = scene.reducedMotion ? 0.6 : 0.45 + Math.sin(phase.current * 1.6) * 0.15;

    const knocked = moving && gait === "knockback" && legIndex === 0;
    const motion: HeroMotion = previewMotion ?? (scene.reducedMotion ? "idle" : knocked ? "hurt" : moving ? "walk" : actionTimer.current > 0
      ? actionKind.current === "candidature" ? "send" : actionKind.current === "embauche" ? "celebrate" : "hurt"
      : "idle");
    const progress = previewMotion ? (elapsed.current % 2) / 2 : knocked ? strideProgress : 1 - actionTimer.current / actionDuration.current;
    const frame = characterFrame(character.id, motion, scene.reducedMotion ? 0 : elapsed.current, progress);
    if (art.current && poses) art.current.texture = poses[frame];

    const body = rig.current;
    if (body) {
      body.y = -hop - speciesLift;
      // Électrocuté : le personnage part en arrière et tremble.
      // A knocked-back hero tilts away from the blow; a sprinter leans into the run.
      const lean = !moving ? 0
        : gait === "knockback" ? (legIndex === 0 ? -0.42 * arc : Math.sin(phase.current * 1.7) * 0.06)
          : gait === "dash" && legIndex > 0 ? 0.11 : 0;
      body.rotation = scene.reducedMotion ? 0 :
        character.id === "skater" ? lean * 0.6 :
        stun.current > 0 && !moving
          ? Math.sin(stun.current * 24) * 0.08 * stun.current
          : slopeAt(at.current) * 0.5 + lean +
            (moving && gait === "trot" ? Math.sin(phase.current) * 0.03 : 0) +
            (actionKind.current === "candidature" ? Math.sin(actionTimer.current / actionDuration.current * Math.PI) * -0.08 : 0);
      body.scale.y = 1 - squash;
      // Animated sheets face right; static fallbacks declare their native direction.
      // Pushed back, a hero keeps facing the road ahead.
      const facing = animation ? poseFacing(character.id, frame) : staticCharacterFacing(character.id);
      body.scale.x = facing * (moving && gait !== "knockback" ? lastDirection.current : 1) * (1 + squash * 0.6);
    }
  }});

  const label = `${player.name} · Nv ${player.level}`;
  const plateWidth = Math.max(104, label.length * 9.6 + 26);
  const paintPlate = useCallback(
    (g: Graphics) => drawPlate(g, plateWidth, isMe),
    [plateWidth, isMe],
  );

  return (
    <pixiContainer ref={root} x={target} scale={lane.scale}>
      <pixiSprite ref={lantern} texture={fxTexture("dot")} anchor={0.5} y={-60} blendMode="add" tint={0xffc98a} alpha={0} visible={false} />
      {isMe ? <pixiGraphics ref={selfGlow} draw={drawSelfGlow} /> : null}
      <pixiGraphics draw={drawShadow} />

      <pixiContainer ref={rig}>
        {texture ? <pixiSprite
          ref={art}
          texture={poses?.[0] ?? texture}
          anchor={{ x: 0.5, y: animation ? animation.baseline / animation.height : 1 }}
          scale={animation ? HERO_HEIGHT / animation.referenceHeight : HERO_HEIGHT / texture.height}
        /> : null}

        {player.hiredAt ? <HiredCrown /> : null}
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

/** Distant companions do not keep an animation atlas resident on the GPU. */
export function VisibleHero(props: HeroProps) {
  const nearCamera = () => {
    const x = worldXFor(props.player.position) + props.lane.dx;
    return props.isFocused || props.isMe || (x > scene.camera.x - 600 && x < scene.camera.x + scene.camera.viewW + 600);
  };
  const [visible, setVisible] = useState(nearCamera);
  useTick(() => {
    const next = nearCamera();
    if (next !== visible) setVisible(next);
  });
  return visible ? <Hero {...props} /> : null;
}
