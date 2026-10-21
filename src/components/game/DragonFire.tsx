"use client";

import { useMemo, useRef } from "react";
import type { Container, Graphics, Sprite } from "pixi.js";
import { atmosphereTextures } from "./atmosphere-textures";
import { isDrawn } from "./environment-targets";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";

export interface DragonFireState { power: number; time: number; scale: number; }
const NO_DRAWING = () => {};
function paintSparks(g: Graphics, seconds: number, power: number, length: number, reduced: boolean) {
  g.clear();
  if (!reduced) for (let i=0;i<12;i++) {
    const p=(seconds*.8+i*.618034)%1;
    const x=length*(.3+p*.9), y=Math.sin(i*7.1)*(18+p*42)-p*p*22;
    g.moveTo(x-8,y).lineTo(x,y).stroke({color:i%2?0xffd875:0xff8b36,width:1.5,alpha:(1-p)*power});
  }
}

/** Registered to the open-mouth pose; everything remains behind the hero plane. */
export function DragonFire({ state }: { state: React.RefObject<DragonFireState> }) {
  const root=useRef<Container>(null), flames=useRef<Graphics>(null), glow=useRef<Sprite>(null);
  const body=useRef<Sprite>(null),previous=useRef<Sprite>(null);
  const texture=useDirectTexture("/art/world-v3/animations/dragon-fire-v1.webp");
  const frames=texture?atlasFrames(texture,4,1):null;
  const masks=useMemo(()=>atmosphereTextures(),[]);
  const last=useRef({power:-1,time:-1});
  useSceneTick(()=>{
    const node=root.current,g=flames.current;if(!node||!g)return;
    const {power,time,scale}=state.current;
    node.visible=power>.001&&!!frames;
    if(!node.visible||!isDrawn(node))return;
    // Source mouth centre (122,207), minus the sprite anchor (256,476).
    node.position.set(-134*scale,-269*scale);
    node.scale.set(-scale,scale);
    const still=scene.reducedMotion||scene.lowPower, clock=still?0:time;
    // Shorten the jet on portrait screens so its full silhouette stays readable.
    const room=Math.max(70,node.getGlobalPosition().x/scene.camera.scale-12);
    const length=Math.min((375+Math.sin(clock*7)*16)*power,room/scale/1.04);
    if(last.current.power!==power||last.current.time!==clock){paintSparks(g,clock,power,length,still);last.current={power,time:clock};}
    const phase=clock*8,index=Math.floor(phase)%4,blend=phase%1;
    if(frames&&body.current&&previous.current){
      previous.current.texture=frames[index];previous.current.alpha=1-blend;
      body.current.texture=frames[(index+1)%4];body.current.alpha=blend;
      previous.current.scale.set(length/504);body.current.scale.copyFrom(previous.current.scale);
    }
    if(glow.current)glow.current.alpha=power*.64;
  });
  return <pixiContainer ref={root} label="dragon-fire" visible={false} rotation={.29} isRenderGroup eventMode="none">
    <pixiSprite ref={glow} texture={masks.glow} anchor={.5} x={55} width={300} height={260} tint={0xff942b} blendMode="add" alpha={0}/>
    {frames?<>
      <pixiSprite ref={previous} label="dragon-fire-previous" texture={frames[0]} anchor={{x:8/512,y:.5}}/>
      <pixiSprite ref={body} label="dragon-fire-body" texture={frames[0]} anchor={{x:8/512,y:.5}}/>
    </>:null}
    <pixiGraphics ref={flames} label="dragon-flames" draw={NO_DRAWING}/>
  </pixiContainer>;
}
