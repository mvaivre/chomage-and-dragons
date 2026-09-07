"use client";

import { useRef } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import type { Container, Graphics, Sprite, Text } from "pixi.js";
import { POINTS } from "@/lib/config";
import { ACTION_ART, POWER_ART } from "@/lib/game/art";
import { scene } from "./scene";
import { useDirectTexture } from "./textures";
import { JourneyChest } from "./JourneyChest";
import { GOLD_LIGHT, TAG_STYLE } from "./style";

export type EffectKind = "pigeon" | "lightning" | "cocktail" | "legendary" | "trophy" | "chest" | "fireCurse" | "dragonDrop" | "paperStorm" | "frogCurse";
export interface Effect {
  id: string;
  kind: EffectKind;
  origin: { x: number; y: number };
}
export interface EffectProps {
  origin: { x: number; y: number };
  onDone: () => void;
}

type IllustratedKind = Exclude<EffectKind, "chest">;
interface Reaction {
  art: string;
  duration: number;
  label?: string;
  points?: number;
  motion: "fly" | "stamp" | "rise" | "fall" | "hop";
  celebrate?: boolean;
}
const REACTIONS: Record<IllustratedKind, Reaction> = {
  pigeon: { art: ACTION_ART.candidature, duration: 2200, points: POINTS.candidature, motion: "fly" },
  lightning: { art: ACTION_ART.refus, duration: 1600, points: POINTS.refus, motion: "stamp" },
  cocktail: { art: ACTION_ART.entretien, duration: 2200, points: POINTS.entretien, motion: "rise", celebrate: true },
  legendary: { art: ACTION_ART.rejetApresEntretien, duration: 2500, points: POINTS.rejetApresEntretien, motion: "stamp", label: "REJET LÉGENDAIRE" },
  trophy: { art: ACTION_ART.embauche, duration: 3000, motion: "rise", label: "ENGAGÉ·E !", celebrate: true },
  fireCurse: { art: POWER_ART.feuSacré, duration: 2300, motion: "rise", label: "FEU SACRÉ" },
  dragonDrop: { art: POWER_ART.fienteDragon, duration: 2200, motion: "fall", label: "CADEAU DU DRAGON" },
  paperStorm: { art: POWER_ART.paperasse, duration: 2300, motion: "fall", label: "PAPERASSE !" },
  frogCurse: { art: POWER_ART.crapaud, duration: 2100, motion: "hop", label: "BISE LINKEDIN" },
};

const COLORS = [0xd94f4f, 0xe8b84b, 0x4fa3d1, 0x63b96a, 0xb96ac9];
const drawConfetti = (g: Graphics) => {
  g.clear();
  for (let i = 0; i < 24; i++) {
    const angle = i * 2.39996;
    const distance = 18 + Math.sqrt(i / 24) * 125;
    g.rect(Math.cos(angle) * distance, Math.sin(angle) * distance * 0.55, 3 + i % 3, 5)
      .fill(COLORS[i % COLORS.length]);
  }
};

/** Artwork stays cached; the ticker changes transforms, never redraws figurative art. */
function IllustratedEffect({ kind, origin, onDone }: EffectProps & { kind: IllustratedKind }) {
  const reaction = REACTIONS[kind];
  const texture = useDirectTexture(reaction.art);
  const art = useRef<Sprite>(null);
  const caption = useRef<Text>(null);
  const points = useRef<Text>(null);
  const confetti = useRef<Container>(null);
  const elapsed = useRef(0);
  const finished = useRef(false);
  useTick(ticker => {
    elapsed.current += Math.min(60, ticker.deltaMS);
    const t = Math.min(1, elapsed.current / reaction.duration);
    const fade = Math.min(1, t / 0.08, (1 - t) / 0.22);
    const pop = Math.min(1, t / 0.18);
    const x = Math.max(scene.camera.x + 100, Math.min(scene.camera.x + scene.camera.viewW - 100, origin.x));
    if (art.current && texture) {
      const node = art.current;
      const fly = reaction.motion === "fly";
      node.x = x + (fly ? t * t * 500 : Math.sin(t * 24) * (1 - t) * (reaction.motion === "stamp" ? 5 : 0));
      node.y = origin.y - 225 - (fly ? t * 135 : reaction.motion === "fall" ? (1 - pop) * 160 : t * 25)
        - (reaction.motion === "hop" ? Math.abs(Math.sin(t * Math.PI * 3)) * 30 : 0);
      node.scale.set((240 / texture.height) * (0.8 + pop * 0.2));
      node.rotation = fly ? -0.15 + Math.sin(t * 28) * 0.08 : Math.sin(t * 12) * 0.035;
      node.alpha = fade;
    }
    if (caption.current) {
      caption.current.x = x;
      caption.current.y = origin.y - 330 - t * 10;
      caption.current.alpha = fade;
    }
    if (points.current) {
      points.current.x = x - 75;
      points.current.y = origin.y - 155 - t * 60;
      points.current.alpha = fade;
    }
    if (confetti.current) {
      confetti.current.position.set(x, origin.y - 220 + t * t * 150);
      confetti.current.scale.set(0.4 + t * 1.2);
      confetti.current.rotation = t * 0.3;
      confetti.current.alpha = fade * (1 - t);
    }
    if (t >= 1 && !finished.current) { finished.current = true; onDone(); }
  });
  return <pixiContainer>
    {reaction.celebrate ? <pixiContainer ref={confetti} alpha={0}><pixiGraphics draw={drawConfetti} /></pixiContainer> : null}
    {texture ? <pixiSprite ref={art} texture={texture} anchor={0.5} x={origin.x} y={origin.y - 225} scale={240 / texture.height} alpha={0} /> : null}
    {reaction.label ? <pixiText ref={caption} text={reaction.label} anchor={0.5} alpha={0} style={{ ...TAG_STYLE, fontSize: 22, fontWeight: "700", fill: GOLD_LIGHT, wordWrap: true, wordWrapWidth: 290, align: "center" }} /> : null}
    {reaction.points !== undefined ? <pixiText ref={points} text={reaction.points > 0 ? `+${reaction.points}` : `${reaction.points}`} alpha={0} anchor={0.5} style={{ ...TAG_STYLE, fontSize: 32, fontWeight: "700", fill: reaction.points > 0 ? GOLD_LIGHT : 0xff9a8a }} /> : null}
  </pixiContainer>;
}

function ChestEffect({ origin, onDone }: EffectProps) {
  return <JourneyChest x={origin.x} y={origin.y} opening onDone={onDone} />;
}

export const EFFECT_COMPONENTS: Record<EffectKind, (props: EffectProps) => React.ReactElement> = {
  pigeon: props => <IllustratedEffect {...props} kind="pigeon" />,
  lightning: props => <IllustratedEffect {...props} kind="lightning" />,
  cocktail: props => <IllustratedEffect {...props} kind="cocktail" />,
  legendary: props => <IllustratedEffect {...props} kind="legendary" />,
  trophy: props => <IllustratedEffect {...props} kind="trophy" />,
  chest: ChestEffect,
  fireCurse: props => <IllustratedEffect {...props} kind="fireCurse" />,
  dragonDrop: props => <IllustratedEffect {...props} kind="dragonDrop" />,
  paperStorm: props => <IllustratedEffect {...props} kind="paperStorm" />,
  frogCurse: props => <IllustratedEffect {...props} kind="frogCurse" />,
};
