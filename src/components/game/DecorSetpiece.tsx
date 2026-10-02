"use client";

import { useRef } from "react";
import type { Container, Sprite } from "pixi.js";
import { WALKABLE_GROUND_Y } from "@/lib/game/world";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { useDirectTexture } from "./textures";
import { useSignTexture } from "./decor-textures";
import { NightOfficeLabel } from "./NightOfficeLabel";
import plaine from "../../../public/art/world-v3/decor/setpiece-plaine-scarecrow.json";
import foret from "../../../public/art/world-v3/decor/setpiece-foret-shredder.json";
import marais from "../../../public/art/world-v3/decor/setpiece-marais-bottles.json";
import lac from "../../../public/art/world-v3/decor/setpiece-pont-toll.json";
import cascade from "../../../public/art/world-v3/decor/setpiece-cascade-letters.json";
import montagne from "../../../public/art/world-v3/decor/setpiece-montagne-ladder.json";
import desert from "../../../public/art/world-v3/decor/setpiece-desert-mirage.json";
import taverne from "../../../public/art/world-v3/decor/setpiece-taverne-afterwork.json";
import crank from "../../../public/art/world-v3/decor/setpiece-foret-shredder-crank.json";

const art = {
  plaine: {id:"plaine-scarecrow", meta:plaine, height:260}, foret:{id:"foret-shredder",meta:foret,height:300},
  marais:{id:"marais-bottles",meta:marais,height:160}, lac:{id:"pont-toll",meta:lac,height:300},
  cascade:{id:"cascade-letters",meta:cascade,height:360}, montagne:{id:"montagne-ladder",meta:montagne,height:380},
  desert:{id:"desert-mirage",meta:desert,height:280}, taverne:{id:"taverne-afterwork",meta:taverne,height:290},
};
export type DecorLand = keyof typeof art;

export function DecorLabel({text, rect, tint = 0xffffff, angle = 0}: {text:string;rect:number[];tint?:number;angle?:number}) {
  const [x,y,w,h] = rect;
  const texture = useSignTexture(text,"setpiece",true,Math.ceil(w),Math.ceil(h));
  return texture ? <pixiSprite texture={texture} x={x} y={y} rotation={angle} scale={0.5} tint={tint} /> : null;
}

function Crank() {
  const texture = useDirectTexture("/art/world-v3/decor/setpiece-foret-shredder-crank.webp");
  const ref = useRef<Sprite>(null);
  useSceneTick(ticker => {if(ref.current && !scene.reducedMotion) ref.current.rotation += ticker.elapsedMS * 0.00045;});
  return texture ? <pixiSprite ref={ref} texture={texture} x={foret.crank[0]-foret.width/2} y={foret.crank[1]-foret.baseline} anchor={{x:crank.pivot[0]/512,y:crank.pivot[1]/512}} scale={0.46} /> : null;
}

/** All bases travel with the road; the original distant landscapes stay untouched. */
export function DecorSetpiece({land, worldX, x = -160, caption}: {land:DecorLand;worldX:number;x?:number;caption?:string}) {
  const spec = art[land], meta = spec.meta;
  const texture = useDirectTexture(`/art/world-v3/decor/setpiece-${spec.id}.webp`);
  const ref = useRef<Container>(null);
  useSceneTick(() => {
    if(!ref.current) return;
    const safeTop = (scene.topInset + 12 - scene.camera.screenOffsetY) / scene.camera.scale + scene.camera.y;
    const h = Math.min(spec.height, Math.max(180,WALKABLE_GROUND_Y-safeTop));
    ref.current.scale.set(h/meta.heights[0]);
    ref.current.alpha = land === "desert" && !scene.reducedMotion ? Math.max(0,Math.min(1,(Math.abs(scene.focus-(worldX+x))-45)/150)) : 1;
  });
  const text = caption ?? (land === "lac" ? "Péage : un CV" : land === "desert" ? "CDI" : land === "taverne" ? "Afterwork obligatoire" : null);
  const rect = "text" in meta ? meta.text : null;
  return <pixiContainer ref={ref} x={x} label={`setpiece:${land}`} scale={spec.height/meta.heights[0]}>
    {texture ? <pixiSprite texture={texture} anchor={{x:0.5,y:meta.baseline/meta.height}} /> : null}
    {land === "foret" ? <Crank /> : null}
    {text && rect ? land === "taverne"
      ? <NightOfficeLabel text={text} rect={[rect[0]-meta.width/2,rect[1]-meta.baseline,rect[2],rect[3]]} />
      : <DecorLabel text={text} rect={[rect[0]-meta.width/2,rect[1]-meta.baseline,rect[2],rect[3]]} /> : null}
  </pixiContainer>;
}
