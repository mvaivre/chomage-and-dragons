"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import type { Container, Graphics, Sprite } from "pixi.js";
import type { PlayerView } from "@/hooks/useGame";
import { characterArt, characterById, staticCharacterFacing } from "@/lib/game/characters";
import { seededRandom } from "@/lib/rng";
import { slopeAt, surfaceAt, worldXFor } from "@/lib/game/world";
import { scene } from "./scene";
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
const STRIDE_DURATION = 0.52;

interface TravelLeg {
  from: number;
  to: number;
  steps: number;
  index: number;
  elapsed: number;
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
  previewMotion?: HeroMotion;
}

export function Hero({ player, isMe, isFocused, lane, onTravelDone, previewMotion }: HeroProps) {
  const character = useMemo(() => characterById(player.characterId), [player.characterId]);

  const root = useRef<Container>(null);
  const rig = useRef<Container>(null);
  const animation = CHARACTER_ANIMATIONS[character.id];
  const texture = useDirectTexture(animation?.url ?? characterArt(character.id));
  const poses = texture && animation ? atlasFrames(texture, animation.columns, animation.rows) : null;
  const art = useRef<Sprite>(null);
  const elapsed = useRef(0);
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

  useTick({ priority: 100, callback: (ticker) => {
    const dt = Math.min(ticker.deltaMS, 60) / 1000;
    elapsed.current += dt;

    if (movementDelay.current > 0) {
      movementDelay.current = Math.max(0, movementDelay.current - dt);
    }

    if (!travel.current && movementDelay.current === 0) {
      const next = travelQueue.current.shift();
      if (next && Math.abs(next.target - at.current) <= 0.5) {
        // A clamped step at zero still completes the action sequence.
        onTravelDone?.(player.id);
      } else if (next) {
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
        onTravelDone?.(player.id);
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

    const hop = moving ? Math.sin(strideProgress * Math.PI) * (character.id === "skater" ? 2 : 7) : 0;
    const baseBob = moving ? Math.abs(Math.sin(phase.current)) * 2 : 0;
    const speciesLift =
      character.hat === "fee" ? 10 + Math.sin(phase.current * 0.72) * 4 : 0;

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
      selfMarker.current.y = -HERO_HEIGHT - 16;
    }

    const motion: HeroMotion = previewMotion ?? (actionTimer.current > 0
      ? actionKind.current === "candidature" ? "send" : actionKind.current === "embauche" ? "celebrate" : "hurt"
      : moving ? "walk" : "idle");
    const progress = previewMotion ? (elapsed.current % 2) / 2 : 1 - actionTimer.current / actionDuration.current;
    const frame = characterFrame(character.id, motion, elapsed.current, progress);
    if (art.current && poses) art.current.texture = poses[frame];

    const body = rig.current;
    if (body) {
      body.y = -hop - baseBob - speciesLift;
      // Électrocuté : le personnage part en arrière et tremble.
      body.rotation =
        stun.current > 0
          ? Math.sin(stun.current * 42) * 0.26 * stun.current
          : slopeAt(at.current) * 0.5 +
            (moving ? Math.sin(phase.current) * 0.055 : 0) +
            (actionKind.current === "candidature" ? Math.sin(actionTimer.current / actionDuration.current * Math.PI) * -0.08 : 0);
      const landing = Math.sin(impact.current * Math.PI) * 0.13;
      body.scale.y = 1 - landing + (moving ? 0 : Math.sin(phase.current) * 0.006);
      // Animated sheets face right; static fallbacks declare their native direction.
      const facing = animation ? poseFacing(character.id, frame) : staticCharacterFacing(character.id);
      body.scale.x = facing * (moving ? lastDirection.current : 1) * (1 + landing * 0.58);
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
