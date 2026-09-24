"use client";

import { useEffect, useRef } from "react";
import type { Sprite, Text } from "pixi.js";
import { sfx } from "@/lib/client/sound";
import { useSceneTick as useTick } from "./useSceneTick";
import { useDirectTexture } from "./textures";
import { JourneyChest } from "./JourneyChest";
import { fx } from "./fx";
import { CHOREOGRAPHIES, type ReactionKind } from "./reactions";
import { markMotion, scene, worldDelta } from "./scene";
import { displayFont, SHOUT_STYLE } from "./style";

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
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A reaction in three beats: the art enters, the impact fires its effects and
 * sound, then the art leaves. It follows the hero it celebrates, so walking away
 * never leaves it behind; the camera leans in meanwhile (see Game).
 */
function Reaction({ kind, origin, playerId, loud = false, onDone }: EffectProps & { kind: ReactionKind }) {
  const choreography = CHOREOGRAPHIES[kind];
  const texture = useDirectTexture(choreography.art);
  const art = useRef<Sprite>(null);
  const label = useRef<Text>(null);
  const elapsed = useRef(0);
  const impacted = useRef(false);
  const finished = useRef(false);
  const follow = useRef({ x: origin.x, y: origin.y });

  useTick((ticker) => {
    markMotion();
    const dt = worldDelta(ticker.elapsedMS);
    // The timeline never waits for the art: impact, sound and light stay in step with
    // the hero and the HUD; the illustration simply joins when it has loaded.
    elapsed.current += dt * 1000;
    const t = elapsed.current;
    const c = choreography;
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
    const labelSpace = "label" in c && c.label ? 62 : 0;
    const bandHeight = follow.current.y - bandTop;
    const size = Math.max(90, Math.min(c.size, bandHeight - labelSpace - 24));
    const above = head - bandTop >= size + c.lift + labelSpace;
    const x0 = above ? follow.current.x : follow.current.x + 80 + size / 2;
    const rest = above ? head - c.lift - size / 2 : Math.max(bandTop + labelSpace + size / 2, head + 20);

    if (!impacted.current && t >= c.impact) {
      impacted.current = true;
      c.onImpact({ x: follow.current.x, feet: follow.current.y, head, viewLeft: camera.x, viewWidth: camera.viewW, viewTop: bandTop, loud });
    }

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
    else { scale = 2.8 - 1.8 * enter * enter; y = rest - (1 - enter) * 160; alpha = Math.min(1, enter * 2.5); }

    const since = (t - c.impact) / 1000;
    if (since >= 0 && !calm) {
      // A springy squash after the impact, then a gentle bob.
      scale *= 1 + Math.exp(-since * 6) * Math.sin(since * 26) * 0.14;
      y += Math.sin(since * 3.2) * 6;
    }

    const exitLength = c.exit === "fly" ? c.duration - c.impact - 700 : 650;
    const leave = clamp((t - (c.duration - exitLength)) / exitLength);
    if (calm) alpha *= 1 - leave;
    else if (c.exit === "fly") {
      const f = leave * leave;
      x += f * 1100;
      y -= f * 620;
      rotation = -0.3 * leave;
      scale *= 1 + Math.sin(t / 45) * 0.12 * Math.min(1, leave * 4);
      alpha *= 1 - clamp((leave - 0.85) / 0.15);
    } else if (c.exit === "fall") { y += leave * leave * 320; rotation = leave * 0.9; alpha *= 1 - leave; }
    else if (c.exit === "fade") { alpha *= 1 - leave; scale *= 1 + leave * 0.12; }
    else { y -= leave * 140; alpha *= 1 - leave; }

    const node = art.current;
    if (node && texture) {
      node.position.set(x, y);
      const base = size / texture.height;
      // The courier flies backwards: beak opposite to its route.
      node.scale.set(base * scale * (kind === "pigeon" ? -1 : 1), base * scale);
      node.rotation = rotation;
      node.alpha = alpha;
    }
    const text = label.current;
    if (text) {
      const shown = clamp((t - c.impact) / 220);
      text.position.set(x0, rest - size / 2 - 34 - (calm ? 0 : (1 - shown) * 24));
      text.scale.set(calm ? 1 : 0.6 + 0.4 * easeOutBack(shown));
      text.alpha = shown * (1 - clamp((t - (c.duration - 500)) / 500));
    }
    if (t >= c.duration && !finished.current) { finished.current = true; onDone(); }
  });

  return <pixiContainer>
    {texture ? <pixiSprite ref={art} texture={texture} anchor={0.5} x={origin.x} y={origin.y - 300} alpha={0} /> : null}
    {"label" in choreography && choreography.label ? <pixiText ref={label} text={choreography.label} anchor={0.5} alpha={0}
      style={{ ...SHOUT_STYLE, fontFamily: displayFont(), fontSize: 50, fill: choreography.labelColor ?? 0xf5e8bd }} /> : null}
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

const reaction = (kind: ReactionKind) => function ReactionEffect(props: EffectProps) {
  return <Reaction {...props} kind={kind} />;
};

export const EFFECT_COMPONENTS: Record<EffectKind, (props: EffectProps) => React.ReactElement> = {
  pigeon: reaction("pigeon"),
  lightning: reaction("lightning"),
  cocktail: reaction("cocktail"),
  legendary: reaction("legendary"),
  trophy: reaction("trophy"),
  chest: ChestEffect,
  fireCurse: reaction("fireCurse"),
  dragonDrop: reaction("dragonDrop"),
  paperStorm: reaction("paperStorm"),
  frogCurse: reaction("frogCurse"),
};

/** How long each reaction lasts, for the moment's timeline in Game. */
export function reactionTiming(kind: EffectKind): { impact: number; duration: number } {
  if (kind === "chest") return { impact: 520, duration: 1300 };
  const { impact, duration } = CHOREOGRAPHIES[kind];
  return { impact, duration };
}
