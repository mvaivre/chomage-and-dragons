"use client";

import { useMemo, useRef } from "react";
import type { Container, Graphics, Sprite } from "pixi.js";
import { lavaPulse, VOLCANO, volcanicLightAt } from "@/lib/game/volcano";
import { WALKABLE_GROUND_Y, WORLD_LENGTH } from "@/lib/game/world";
import { atmosphereTextures } from "./atmosphere-textures";
import { isDrawn } from "./environment-targets";
import type { LandmarkProps } from "./LandmarkLife";
import { parallaxX } from "./projection";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";

// Registered to the native 2172 × 724 canyon, before its parallax/mirror transform.
const FALLS = [
  { x: 721, y: 311, cx: 744, endX: 767, endY: 464, width: 14 },
  { x: 1446, y: 337, cx: 1420, endX: 1426, endY: 475, width: 18 },
];
const NO_DRAWING = () => {};
const fallX = (fall: typeof FALLS[number], t: number) =>
  (1 - t) ** 2 * fall.x + 2 * (1 - t) * t * fall.cx + t * t * fall.endX;
const drawBasin = (g:Graphics) => {
  g.clear().moveTo(-1200,530);
  for(let x=-1200;x<=3200;x+=40) g.lineTo(x,520+Math.sin(x*.013)*11+Math.sin(x*.041)*5);
  g.lineTo(3200,2200).lineTo(-1200,2200).closePath().fill(0x493342);
};

/** Opaque low basalt connects the transparent canyon's ends to the walkable road. */
export function VolcanoBasin() {
  const root=useRef<Graphics>(null);
  useSceneTick(()=>{
    const node=root.current;if(!node)return;
    const {camera}=scene;
    node.alpha=volcanicLightAt(camera.x+camera.viewW/2);
    node.visible=node.alpha>.001;
    node.x=-parallaxX(0,camera.x,camera.viewW,.36);
  });
  return <pixiGraphics ref={root} label="volcano:basin" alpha={0} draw={drawBasin}/>;
}
function paintLava(g: Graphics, seconds: number) {
  g.clear();
  for (const fall of FALLS) {
    for (let i = 0; i < 13; i++) {
      const p = (seconds * .27 + i / 13) % 1, q = Math.min(1, p + .085);
      const dx = Math.sin(i * 2.7) * fall.width * .46;
      g.moveTo(fallX(fall,p)+dx,fall.y+(fall.endY-fall.y)*p).lineTo(fallX(fall,q)+dx,fall.y+(fall.endY-fall.y)*q)
        .stroke({width:i%3?2:3.5,color:0xffefaa,alpha:.18+Math.sin(p*Math.PI)*.35});
    }
    for (let i=0;i<7;i++) {
      const p=(seconds*.38+i/7)%1, dx=(i%2?1:-1)*(18+i*6)*p;
      g.circle(fall.endX+dx,fall.endY-Math.sin(p*Math.PI)*(18+i*3),1.2+(i%3)*.6)
        .fill({color:0xffd06a,alpha:(1-p)*.7});
    }
    for (let i=0;i<3;i++) {
      const p=(seconds*.16+i/3)%1;
      g.ellipse(fall.endX,fall.endY+12+p*10,14+p*65,2+p*4)
        .stroke({width:1.4,color:0xffc26a,alpha:(1-p)*.35});
    }
  }
}

function paintEruption(g: Graphics, seconds: number) {
  g.clear();
  // Cinders arc out of the illustrated crater (native plate 1942 × 809).
  for(let i=0;i<32;i++) {
    const p=(seconds*(.13+i%4*.015)+i*.618034)%1;
    const dx=Math.sin(i*7.13)*(65+i%7*24)*p;
    const x=1067+dx, y=322-Math.sin(p*Math.PI)*(100+i%8*14)+p*48;
    g.moveTo(x-dx*.045,y-3).lineTo(x,y).stroke({color:i%3?0xffbc54:0xffedb4,width:1.5+i%3*.7,alpha:Math.sin(p*Math.PI)*.8});
  }
}

/** Only the molten material redraws. The ink, cliffs and smoke remain sharp. */
export function VolcanoLife({ kind, ...props }: LandmarkProps & { kind:"eruption"|"lava" }) {
  const graphics = useRef<Graphics>(null), root = useRef<Container>(null);
  const last = useRef({ frame: -1, reduced: false });
  const masks = useMemo(() => atmosphereTextures(), []);
  useSceneTick(() => {
    const g = graphics.current, node = root.current;
    if (!g || !node || !isDrawn(node)) return;
    const x = parallaxX(props.worldX, scene.camera.x, scene.camera.viewW, props.factor);
    if (x < -1800 || x > scene.camera.viewW + 1800) return;
    const reduced = scene.reducedMotion || scene.lowPower;
    const time = reduced ? 0 : scene.atmosphereTime;
    // Rebuild molten geometry at 30 fps without slowing camera motion or lighting.
    const frame = Math.floor(time * 30);
    if (last.current.frame !== frame || last.current.reduced !== reduced) {
      (kind === "lava" ? paintLava : paintEruption)(g, time);
      last.current.frame = frame;
      last.current.reduced = reduced;
    }
    const alpha = (kind === "lava" ? .58 : .76) * lavaPulse(time, reduced);
    for (const child of node.children) if (child !== g) child.alpha = alpha;
  });
  return <pixiContainer ref={root} isRenderGroup label={`volcano:${kind}`} eventMode="none">
    {kind==="lava"?FALLS.map((fall,i)=><pixiSprite key={i} texture={masks.glow} anchor={.5}
      x={fall.endX} y={fall.endY-45} width={340} height={370} tint={0xff8a26} blendMode="add" alpha={0}/>):
      <pixiSprite texture={masks.glow} anchor={.5} x={1067} y={322} width={660} height={540} tint={0xff7028} blendMode="add" alpha={0}/>}
    <pixiGraphics ref={graphics} draw={NO_DRAWING}/>
  </pixiContainer>;
}

/** Cached light masks at two depths: a burning horizon, then reflected light on the road. */
export function VolcanoLighting({ depth }: { depth: "sky" | "ground" }) {
  const root = useRef<Container>(null), masks = useMemo(() => atmosphereTextures(), []);
  const lights = useMemo(() => Array.from({ length: depth === "sky" ? 3 : 16 }, (_, index) => {
    if (depth === "sky") return {
      x: VOLCANO.center + (index - 1) * 900, y: 400 + index % 2 * 75,
      width: index === 1 ? 1500 : 900, height: index === 1 ? 850 : 600,
      tint: index === 1 ? 0xff7025 : 0xd83229, rotation: 0,
      strength: index === 1 ? .78 : .4, ray: false,
    };
    const slot = Math.floor(index / 2), ray = index % 2 === 1;
    const x = VOLCANO.from + 180 + slot * 250;
    return {
      x, y: WALKABLE_GROUND_Y + (ray ? -75 : 64),
      width: ray ? 100 : 570, height: ray ? 390 : 180,
      rotation: ray ? (slot % 2 ? .17 : -.19) : -.06,
      tint: ray ? 0xffa547 : slot % 2 ? 0xff8c30 : 0xff5823,
      strength: volcanicLightAt(x) * (ray ? .19 : .62), ray,
    };
  }), [depth]);
  useSceneTick(() => {
    const node = root.current;
    if (!node) return;
    const { camera } = scene, center = camera.x + camera.viewW / 2;
    const strength = volcanicLightAt(center);
    node.visible = strength > .001 && !scene.viewedRoom;
    if (!node.visible) return;
    const reduced = scene.reducedMotion || scene.lowPower;
    const pulse = lavaPulse(reduced ? 0 : scene.atmosphereTime, reduced);
    const lap = Math.floor(Math.max(0, center) / WORLD_LENGTH) * WORLD_LENGTH;
    const factor = depth === "sky" ? .16 : 1;
    node.y = -camera.y * factor;
    for (let index = 0; index < lights.length; index++) {
      const sprite = node.children[index] as Sprite, light = lights[index];
      sprite.x = parallaxX(lap + light.x, camera.x, camera.viewW, factor);
      sprite.alpha = strength * pulse * light.strength;
    }
  });
  return <pixiContainer ref={root} label={`volcano:light:${depth}`} eventMode="none">
    {lights.map((light, i) => <pixiSprite key={i}
      texture={light.ray ? masks.ray : masks.glow} anchor={.5} blendMode="add" alpha={0}
      y={light.y} width={light.width} height={light.height} rotation={light.rotation} tint={light.tint} />)}
  </pixiContainer>;
}
