"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics, Sprite } from "pixi.js";
import type { PlayerView } from "@/hooks/useGame";
import { characterById, type Character } from "@/lib/game/characters";
import { seededRandom } from "@/lib/rng";
import { slopeAt, surfaceAt, worldXFor } from "@/lib/game/world";
import { useCharacterSprite } from "./sprites";
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
 * Le corps est dessiné en pièces séparées et immobiles — jambes, buste, tête, arme —
 * que le ticker se contente de faire pivoter. Redessiner la silhouette à chaque image
 * coûterait cher pour un résultat identique.
 *
 * Si `public/sprites/<classe>.png` existe, le sprite pixel-art remplace le dessin
 * vectoriel sans que rien d'autre ne change.
 */

/** Hauteur du personnage, unités monde. Le repère local a les pieds en (0, 0). */
export const HERO_HEIGHT = 104;

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
  /** Décalage en profondeur, pour que deux personnages au même endroit se distinguent. */
  lane: { dx: number; dy: number; scale: number };
}

export function Hero({ player, isMe, lane }: HeroProps) {
  const character = useMemo(() => characterById(player.characterId), [player.characterId]);
  const sprite = useCharacterSprite(player.characterId);

  const root = useRef<Container>(null);
  const rig = useRef<Container>(null);
  const legL = useRef<Graphics>(null);
  const legR = useRef<Graphics>(null);
  const armFree = useRef<Container>(null);
  const armProp = useRef<Container>(null);
  const spriteRef = useRef<Sprite>(null);

  const target = worldXFor(player.position) + lane.dx;
  const at = useRef(target);
  // Déphasage tiré de l'identifiant : les personnages ne respirent pas à l'unisson,
  // et le tirage reste le même d'un rendu à l'autre.
  const phase = useRef(seededRandom(hash(player.id))() * Math.PI * 2);
  const jump = useRef(0);
  const stun = useRef(0);

  // Les compteurs ne déclenchent qu'en montant : une annulation ne doit pas faire
  // sauter le personnage à l'envers.
  const seen = useRef({
    applications: player.applications,
    refus: player.counts.refus,
  });

  useEffect(() => {
    if (player.applications > seen.current.applications) jump.current = 1;
    if (player.counts.refus > seen.current.refus) stun.current = 1;
    seen.current = {
      applications: player.applications,
      refus: player.counts.refus,
    };
  }, [player.applications, player.counts.refus]);

  useTick((ticker) => {
    const dt = Math.min(ticker.deltaMS, 60) / 1000;

    // Approche du point visé : la marche est le résultat du déplacement, pas
    // l'inverse. Un personnage immobile ne mime donc jamais la marche.
    const delta = target - at.current;
    const speed = Math.min(Math.abs(delta), 40 + Math.abs(delta) * 2.4);
    const moving = Math.abs(delta) > 0.6;
    if (moving) at.current += Math.sign(delta) * speed * dt;

    phase.current += dt * (moving ? 9 : 2.2);

    if (jump.current > 0) jump.current = Math.max(0, jump.current - dt / 0.62);
    if (stun.current > 0) stun.current = Math.max(0, stun.current - dt / 1.25);

    const hop = Math.sin((1 - jump.current) * Math.PI) * 46;
    const bob = moving ? Math.abs(Math.sin(phase.current)) * 3.4 : Math.sin(phase.current) * 2.2;

    const node = root.current;
    if (node) {
      node.x = at.current;
      node.y = surfaceAt(at.current) + 4 + lane.dy;
    }

    const body = rig.current;
    if (body) {
      body.y = -hop - bob;
      // Électrocuté : le personnage part en arrière et tremble.
      body.rotation =
        stun.current > 0
          ? Math.sin(stun.current * 42) * 0.26 * stun.current
          : slopeAt(at.current) * 0.5;
      body.scale.y = 1 - Math.sin((1 - jump.current) * Math.PI) * 0.06;
    }

    const swing = moving ? Math.sin(phase.current) * 0.6 : Math.sin(phase.current) * 0.06;
    if (legL.current) legL.current.rotation = swing;
    if (legR.current) legR.current.rotation = -swing;
    if (armFree.current) armFree.current.rotation = -swing * 0.7;
    if (armProp.current) {
      // Le bras d'arme se lève quand le personnage prend la foudre.
      armProp.current.rotation = swing * 0.35 - (stun.current > 0 ? 0.9 : 0);
    }
    if (spriteRef.current) {
      spriteRef.current.skew.x = swing * 0.12;
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
        {sprite ? (
          <pixiSprite
            ref={spriteRef}
            texture={sprite}
            anchor={{ x: 0.5, y: 1 }}
            height={HERO_HEIGHT}
            width={(HERO_HEIGHT * sprite.width) / sprite.height}
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
        <pixiContainer y={-HERO_HEIGHT - 46}>
          <pixiGraphics draw={drawMarker} />
        </pixiContainer>
      ) : null}

      <pixiContainer y={14}>
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
