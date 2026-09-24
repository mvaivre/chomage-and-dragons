"use client";

import { useEffect, useRef } from "react";
import type { Container, Graphics, Sprite, Text } from "pixi.js";
import { sfx } from "@/lib/client/sound";
import { ACTION_ART } from "@/lib/game/art";
import { useSceneTick as useTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { JourneyChest } from "./JourneyChest";
import { fx } from "./fx";
import { CHOREOGRAPHIES, type ImpactContext, type ReactionKind } from "./reactions";
import { markMotion, scene, worldDelta } from "./scene";
import { BODY, displayFont, INK, SHOUT_STYLE } from "./style";

export type EffectKind = ReactionKind | "chest";
export interface Effect {
  id: string;
  kind: EffectKind;
  /** Where it starts; a reaction then follows its player's hero. */
  origin: { x: number; y: number };
  playerId?: string;
  /** Only your own actions make noise. */
  loud?: boolean;
}
export interface EffectProps {
  origin: { x: number; y: number };
  playerId?: string;
  loud?: boolean;
  onDone: () => void;
}

/** Height of a hero, from the feet to the top of the head, world units. */
const HERO_TOP = 164;
/** Length of one journey step on the road, world units. */
const STEP_LENGTH = 189;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const BUBBLE_STYLE = { fontFamily: BODY, fontSize: 21, fontWeight: "700" as const, fill: INK, wordWrap: true, wordWrapWidth: 250, align: "center" as const };

/**
 * A reaction in three beats: the art enters, the impact fires its effects and
 * sound, then the art leaves. It follows the hero it celebrates, so walking away
 * never leaves it behind; the camera leans in meanwhile (see Game). Variants add
 * swarms, trails, speech, props in the world, and effects over time.
 */
function Reaction({ kind, origin, playerId, loud = false, onDone }: EffectProps & { kind: ReactionKind }) {
  const c = CHOREOGRAPHIES[kind] as (typeof CHOREOGRAPHIES)[ReactionKind] & {
    copies?: Array<{ dx: number; dy: number; scale: number; delay: number }>;
    trail?: { preset: Parameters<typeof fx.burst>[0]["preset"]; every: number; count?: number };
    bubble?: string;
    prop?: "carpet" | "crater" | "gnomes" | "ropes";
    during?: (ctx: ImpactContext, since: number, state: Record<string, number>) => void;
    label?: string;
    labelColor?: number;
  };
  const texture = useDirectTexture(c.art);
  const gnomes = useDirectTexture(c.prop === "gnomes" ? "/art/world-v3/animations/gnomes.webp" : c.art);
  const pigeon = useDirectTexture(c.prop === "ropes" ? ACTION_ART.candidature : c.art);
  const art = useRef<Sprite>(null);
  const copies = useRef<Array<Sprite | null>>([]);
  const label = useRef<Text>(null);
  const bubble = useRef<Container>(null);
  const prop = useRef<Graphics>(null);
  const helpers = useRef<Array<Sprite | null>>([]);
  const elapsed = useRef(0);
  const impacted = useRef(false);
  const finished = useRef(false);
  const lastTrail = useRef(0);
  const state = useRef<Record<string, number>>({});
  const follow = useRef({ x: origin.x, y: origin.y });
  const anchor = useRef<{ x: number; feet: number } | null>(null);

  useTick((ticker) => {
    markMotion();
    const dt = worldDelta(ticker.elapsedMS);
    // The timeline never waits for the art: impact, sound and light stay in step with
    // the hero and the HUD; the illustration simply joins when it has loaded.
    elapsed.current += dt * 1000;
    const t = elapsed.current;
    const calm = scene.reducedMotion;

    const live = playerId ? scene.heroes.get(playerId) : undefined;
    const target = live ?? origin;
    const catchUp = Math.min(1, dt * 12);
    follow.current.x += (target.x - follow.current.x) * catchUp;
    follow.current.y += (target.y - follow.current.y) * catchUp;
    const head = follow.current.y - HERO_TOP;

    // The world is only visible in a band between the top HUD and the action dock.
    // Above the head when it fits, else beside the hero at head height; always inside.
    const { camera } = scene;
    const bandTop = camera.y + (scene.topInset + 10 - camera.screenOffsetY) / camera.scale;
    const labelSpace = c.label ? 62 : 0;
    const bandHeight = follow.current.y - bandTop;
    const size = Math.max(90, Math.min(c.size, bandHeight - labelSpace - 24));
    const above = head - bandTop >= size + c.lift + labelSpace;
    const x0 = above ? follow.current.x : follow.current.x + 80 + size / 2;
    const rest = above ? head - c.lift - size / 2 : Math.max(bandTop + labelSpace + size / 2, head + 20);
    const context = (): ImpactContext => ({ x: follow.current.x, feet: follow.current.y, head, viewLeft: camera.x, viewWidth: camera.viewW, viewTop: bandTop, loud });

    if (!impacted.current && t >= c.impact) {
      impacted.current = true;
      // Props stay where the impact happened, even when the hero walks on.
      anchor.current = { x: follow.current.x, feet: follow.current.y };
      c.onImpact(context());
    }
    const since = t - c.impact;
    if (since >= 0 && c.during) c.during(context(), since, state.current);

    let x = x0;
    let y = rest;
    let scale = 1;
    let alpha = 1;
    let rotation = 0;
    const enter = clamp(t / c.impact);
    if (calm) alpha = Math.min(1, t / 200);
    else if (c.enter === "pop") { scale = Math.max(0, easeOutBack(enter)); alpha = Math.min(1, enter * 3); }
    else if (c.enter === "drop") { y = rest - (1 - enter * enter) * 320; alpha = Math.min(1, enter * 4); }
    else if (c.enter === "rise") { y = rest + (1 - easeOutCubic(enter)) * 140; scale = 0.55 + 0.45 * easeOutBack(enter); alpha = enter; }
    else if (c.enter === "meteor") {
      // A fireball from the upper left, accelerating onto the hero.
      const fall = enter * enter;
      x = x0 - (1 - fall) * 640;
      y = rest - (1 - fall) * 380;
      scale = 0.45 + 0.55 * fall;
      rotation = (1 - fall) * -2.5;
      alpha = Math.min(1, enter * 5);
    } else { scale = 2.8 - 1.8 * enter * enter; y = rest - (1 - enter) * 160; alpha = Math.min(1, enter * 2.5); }

    if (since >= 0 && !calm) {
      // A springy squash after the impact, then a gentle bob.
      scale *= 1 + Math.exp(-since / 1000 * 6) * Math.sin(since / 1000 * 26) * 0.14;
      y += Math.sin(since / 1000 * 3.2) * 6;
    }

    const exitLength = c.exit === "fly" ? c.duration - c.impact - 700 : 650;
    const leave = clamp((t - (c.duration - exitLength)) / exitLength);
    let moving = c.enter === "meteor" && t < c.impact;
    if (calm) alpha *= 1 - clamp((t - (c.duration - 400)) / 400);
    else if (c.exit === "fly") {
      const f = leave * leave;
      x += f * 1100;
      y -= f * 620;
      rotation = -0.3 * leave;
      scale *= 1 + Math.sin(t / 45) * 0.12 * Math.min(1, leave * 4);
      alpha *= 1 - clamp((leave - 0.85) / 0.15);
      moving = moving || leave > 0;
    } else if (c.exit === "boomerang") {
      // Away with the letter, then back with the receipt, perched above the hero.
      const out = clamp((since - 450) / 800);
      const back = clamp((since - 1250) / 700);
      const perch = { x: follow.current.x, y: head - 40 };
      if (since > 450 && back === 0) { x += out * out * 900; y -= out * out * 520; rotation = -0.3 * out; moving = true; }
      if (back > 0) {
        const e = easeOutCubic(back);
        x = perch.x + (1 - e) * 900;
        y = perch.y - (1 - e) * 520 + Math.sin(since / 180) * 4;
        scale *= 1 - 0.45 * e;
        moving = back < 1;
      }
      alpha *= 1 - leave;
    } else if (c.exit === "fall") { y += leave * leave * 320; rotation = leave * 0.9; alpha *= 1 - leave; }
    else if (c.exit === "fade") { alpha *= 1 - leave; scale *= 1 + leave * 0.12; }
    else { y -= leave * 140; alpha *= 1 - leave; }

    const node = art.current;
    if (node && texture) {
      node.position.set(x, y);
      const base = size / texture.height;
      // The courier flies backwards: beak opposite to its route.
      const mirror = c.art === ACTION_ART.candidature ? -1 : 1;
      node.scale.set(base * scale * mirror, base * scale);
      node.rotation = rotation;
      node.alpha = alpha;
      c.copies?.forEach((copy, index) => {
        const sprite = copies.current[index];
        if (!sprite) return;
        const lag = clamp((t - copy.delay) / Math.max(1, c.impact));
        sprite.position.set(x + copy.dx * (calm ? 1 : lag), y + copy.dy * (calm ? 1 : lag) + Math.sin(t / 120 + index) * 5);
        sprite.scale.set(base * scale * copy.scale * mirror, base * scale * copy.scale);
        sprite.rotation = rotation;
        sprite.alpha = alpha * Math.min(1, lag * 2);
      });
    }
    if (c.trail && moving && !calm && t - lastTrail.current > c.trail.every) {
      lastTrail.current = t;
      fx.burst({ preset: c.trail.preset, x, y: y + size * 0.2, count: c.trail.count ?? 1, power: 0.6 });
    }

    // Titles and bubbles stay inside the screen, and a title too wide for a phone shrinks.
    const viewLeft = camera.x + 12;
    const viewRight = camera.x + camera.viewW - 12;
    const inside = (cx: number, half: number) => Math.max(viewLeft + half, Math.min(viewRight - half, cx));
    // On a narrow screen a speech bubble takes the title's place: it says it better.
    const narrow = viewRight - viewLeft < 600;
    const titleY = rest - size / 2 - 34;
    const text = label.current;
    if (text) {
      const shown = clamp((t - c.impact) / 220);
      const natural = text.getLocalBounds().width;
      const fit = Math.min(1, (viewRight - viewLeft) / Math.max(1, natural));
      const grow = calm ? 1 : 0.6 + 0.4 * easeOutBack(shown);
      text.scale.set(fit * grow);
      text.position.set(inside(x0, (natural * fit) / 2), rest - size / 2 - 34 - (calm ? 0 : (1 - shown) * 24));
      text.alpha = (c.bubble && narrow ? 0 : 1) * shown * (1 - clamp((t - (c.duration - 500)) / 500));
    }
    const speech = bubble.current;
    if (speech) {
      const shown = clamp((since - 250) / 250);
      const room = viewRight - viewLeft;
      const bubbleScale = Math.min(1, room / 300);
      speech.position.set(narrow ? inside(x0, 142 * bubbleScale) : inside(x0 - size / 2 - 150, 142 * bubbleScale), narrow ? titleY - 20 : rest - 30);
      speech.alpha = shown * (1 - clamp((t - (c.duration - 500)) / 500));
      speech.scale.set(bubbleScale * (calm ? 1 : 0.7 + 0.3 * easeOutBack(shown)));
    }

    // Props drawn in the world, anchored where the impact happened.
    const g = prop.current;
    const spot = anchor.current;
    if (g && spot) {
      g.clear();
      const fade = 1 - clamp((t - (c.duration - 600)) / 600);
      if (c.prop === "carpet") {
        // Unrolls behind the hero, over the three steps an interview costs.
        const length = STEP_LENGTH * 3 * easeOutCubic(clamp(since / 900));
        g.rect(spot.x - length, spot.feet - 2, length, 34).fill({ color: 0x5a1216, alpha: 0.5 * fade });
        g.rect(spot.x - length, spot.feet - 12, length, 30).fill({ color: 0xb22a2f, alpha: fade });
        g.rect(spot.x - length, spot.feet - 12, length, 6).fill({ color: 0xd9484c, alpha: fade });
        g.rect(spot.x - length, spot.feet - 12, length, 3).fill({ color: 0xf5d163, alpha: fade });
        g.rect(spot.x - length, spot.feet + 15, length, 3).fill({ color: 0xf5d163, alpha: fade });
        // The roll still unrolling at the far end.
        g.ellipse(spot.x - length, spot.feet + 3, 14, 20).fill({ color: 0x8a1c21, alpha: fade }).stroke({ width: 2, color: 0x4a0d10, alpha: fade });
      } else if (c.prop === "crater") {
        g.ellipse(spot.x, spot.feet + 6, 120, 22).fill({ color: 0x1d140c, alpha: 0.55 * fade });
        g.ellipse(spot.x, spot.feet + 4, 86, 14).fill({ color: 0x3a2716, alpha: 0.7 * fade });
        const ember = 0.5 + Math.sin(t / 90) * 0.2;
        g.ellipse(spot.x, spot.feet + 4, 40, 7).fill({ color: 0xff8a3d, alpha: ember * fade * clamp(1 - since / 2500) });
      } else if (c.prop === "ropes") {
        helpers.current.forEach((sprite, index) => {
          if (!sprite) return;
          const side = index % 2 ? 1 : -1;
          const px = follow.current.x + side * (55 + (index >> 1) * 80);
          const py = head - 55 - (index >> 1) * 35 + Math.sin(t / 110 + index) * 8 - clamp(since / 3000) * 30;
          g.moveTo(px, py + 20).lineTo(follow.current.x + side * 12, head + 30).stroke({ width: 2, color: 0xe8dcc0, alpha: fade });
          sprite.position.set(px, py);
          const base = 105 / (pigeon?.height ?? 512);
          sprite.scale.set(base * -side * (1 + Math.sin(t / 60 + index) * 0.08), base);
          sprite.alpha = fade * clamp(since / 300);
        });
      }
    }
    if (c.prop === "gnomes" && gnomes) {
      const frames = atlasFrames(gnomes, 4, 2);
      helpers.current.forEach((sprite, index) => {
        if (!sprite) return;
        const side = index % 2 ? 1 : -1;
        const rank = (index >> 1) + 1;
        const march = easeOutCubic(clamp(since / 1100));
        const spotX = (anchor.current?.x ?? follow.current.x) + side * (70 + rank * 60);
        sprite.position.set(spotX + side * (1 - march) * 420, follow.current.y + 6 - Math.abs(Math.sin(t / 140 + index)) * 8);
        sprite.texture = frames[[2, 3, 6, 7, 2][index % 5] + (Math.floor(t / 260) % 2 ? 0 : 0)];
        sprite.scale.set(0.28 * -side, 0.28);
        sprite.alpha = clamp(since / 250) * (1 - clamp((t - (c.duration - 600)) / 600));
      });
    }

    if (t >= c.duration && !finished.current) { finished.current = true; onDone(); }
  });

  return <pixiContainer>
    {c.prop === "carpet" || c.prop === "crater" || c.prop === "ropes" ? <pixiGraphics ref={prop} draw={() => {}} /> : null}
    {c.prop === "gnomes" && gnomes ? Array.from({ length: 4 }, (_, index) => <pixiSprite key={index} ref={(node) => { helpers.current[index] = node; }} texture={atlasFrames(gnomes, 4, 2)[2]} anchor={{ x: 0.5, y: 312 / 320 }} alpha={0} />) : null}
    {c.prop === "ropes" && pigeon ? Array.from({ length: 4 }, (_, index) => <pixiSprite key={index} ref={(node) => { helpers.current[index] = node; }} texture={pigeon} anchor={0.5} alpha={0} />) : null}
    {texture ? c.copies?.map((_, index) => <pixiSprite key={index} ref={(node) => { copies.current[index] = node; }} texture={texture} anchor={0.5} alpha={0} />) : null}
    {texture ? <pixiSprite ref={art} texture={texture} anchor={0.5} x={origin.x} y={origin.y - 300} alpha={0} /> : null}
    {c.bubble ? <pixiContainer ref={bubble} alpha={0}>
      <pixiGraphics draw={(g) => { g.clear().roundRect(-140, -58, 280, 104, 16).fill(0xfbf3dc).stroke({ width: 3, color: INK }).poly([112, 40, 150, 58, 96, 44], true).fill(0xfbf3dc); }} />
      <pixiText text={c.bubble} anchor={0.5} y={-6} style={BUBBLE_STYLE} />
    </pixiContainer> : null}
    {c.label ? <pixiText ref={label} text={c.label} anchor={0.5} alpha={0}
      style={{ ...SHOUT_STYLE, fontFamily: displayFont(), fontSize: 50, fill: c.labelColor ?? 0xf5e8bd }} /> : null}
  </pixiContainer>;
}

/** The chest on the road opens with light, sparks and its little melody. */
function ChestEffect({ origin, loud = true, onDone }: EffectProps) {
  useEffect(() => {
    if (loud) sfx.chest();
    const timer = window.setTimeout(() => {
      fx.burst({ preset: "glow", x: origin.x, y: origin.y - 50, count: 1 });
      fx.burst({ preset: "sparks", x: origin.x, y: origin.y - 50, count: 30 });
      fx.burst({ preset: "stars", x: origin.x, y: origin.y - 70, count: 14 });
    }, 520);
    return () => window.clearTimeout(timer);
  }, [origin.x, origin.y, loud]);
  return <JourneyChest x={origin.x} y={origin.y} opening big onDone={onDone} />;
}

/** Any effect of the scene: a reaction by its choreography, or the chest. */
export function EffectView({ kind, ...props }: EffectProps & { kind: EffectKind }) {
  if (kind === "chest") return <ChestEffect {...props} />;
  return <Reaction {...props} kind={kind} />;
}

/** How long each reaction lasts, for the moment's timeline in Game. */
export function reactionTiming(kind: EffectKind): { impact: number; duration: number } {
  if (kind === "chest") return { impact: 520, duration: 1300 };
  const { impact, duration } = CHOREOGRAPHIES[kind];
  return { impact, duration };
}
