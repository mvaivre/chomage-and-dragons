"use client";

import { useCallback, useRef } from "react";
import { Application, useTick } from "@pixi/react";
import type { Container, Graphics } from "pixi.js";
import type { Character } from "@/lib/game/characters";
import {
  drawArms,
  drawHead,
  drawHeld,
  drawLeg,
  drawTorso,
  HERO_HEIGHT,
  LEG_TOP,
  TORSO_TOP,
} from "./Hero";
import { useCharacterSprite } from "./sprites";
import "./extendPixi";

/**
 * Le portrait de l'écran de sélection : exactement le personnage du jeu, en grand
 * et au repos.
 *
 * Un seul canvas est monté à la fois — la classe affichée est celle que l'on feuillette.
 * Ouvrir huit contextes WebGL pour une galerie serait un mauvais calcul.
 */

const SIZE = { width: 240, height: 300 };

function Figure({ character }: { character: Character }) {
  const rig = useRef<Container>(null);
  const time = useRef(0);
  const sprite = useCharacterSprite(character.id);

  const paintLeg = useCallback((g: Graphics) => drawLeg(g, character), [character]);
  const paintTorso = useCallback((g: Graphics) => drawTorso(g, character), [character]);
  const paintArms = useCallback((g: Graphics) => drawArms(g, character), [character]);
  const paintHead = useCallback((g: Graphics) => drawHead(g, character), [character]);
  const paintHeld = useCallback((g: Graphics) => drawHeld(g, character), [character]);

  useTick((ticker) => {
    time.current += ticker.deltaMS / 1000;
    const node = rig.current;
    if (node) node.y = Math.sin(time.current * 1.6) * 3.5;
  });

  const scale = (SIZE.height * 0.78) / HERO_HEIGHT;

  return (
    <pixiContainer x={SIZE.width / 2} y={SIZE.height * 0.92} scale={scale}>
      <pixiContainer ref={rig}>
        {sprite ? (
          <pixiSprite
            texture={sprite}
            anchor={{ x: 0.5, y: 1 }}
            height={HERO_HEIGHT}
            width={(HERO_HEIGHT * sprite.width) / sprite.height}
          />
        ) : (
          <pixiContainer>
            <pixiContainer x={-6} y={LEG_TOP}>
              <pixiGraphics draw={paintLeg} />
            </pixiContainer>
            <pixiContainer x={6} y={LEG_TOP} rotation={0.12}>
              <pixiGraphics draw={paintLeg} />
            </pixiContainer>
            <pixiContainer x={-13} y={TORSO_TOP + 8}>
              <pixiGraphics draw={paintArms} />
            </pixiContainer>
            <pixiGraphics draw={paintTorso} />
            <pixiGraphics draw={paintHead} />
            <pixiContainer x={14} y={TORSO_TOP + 8}>
              <pixiGraphics draw={paintArms} />
              <pixiContainer y={30}>
                <pixiGraphics draw={paintHeld} />
              </pixiContainer>
            </pixiContainer>
          </pixiContainer>
        )}
      </pixiContainer>
    </pixiContainer>
  );
}

export function CharacterPortrait({ character }: { character: Character }) {
  return (
    <div
      className="pointer-events-none"
      style={{ width: SIZE.width, height: SIZE.height }}
    >
      <Application
        width={SIZE.width}
        height={SIZE.height}
        backgroundAlpha={0}
        antialias
        autoDensity
        resolution={
          typeof window === "undefined"
            ? 1
            : Math.min(2, window.devicePixelRatio || 1)
        }
      >
        <Figure character={character} />
      </Application>
    </div>
  );
}
