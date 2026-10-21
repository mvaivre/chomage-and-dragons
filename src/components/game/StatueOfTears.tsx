"use client";

import { useRef } from "react";
import type { Container, Graphics } from "pixi.js";
import { BIOMES, WALKABLE_GROUND_Y } from "@/lib/game/world";
import { TEARS_MONUMENT_X, TEARS_BASE_OFFSET, TEAR_STREAMS, TEARS_POOL, tearPoint } from "@/lib/game/tears";
import { useLayerBiomes } from "./FlatWorld";
import { useDirectTexture } from "./textures";
import { useSceneTick } from "./useSceneTick";
import { isDrawn } from "./environment-targets";
import { scene } from "./scene";
import meta from "../../../public/art/world-v3/decor/statue-of-tears.json";

const EMPTY=()=>{};
const contact=(g:Graphics)=>{g.clear().ellipse(0,1,94,6).fill({color:0x192c2d,alpha:.24});};

/** Two continuous, ink-edged veils with travelling streaks, spray and basin ripples. */
function paintWater(g:Graphics,time:number) {
  g.clear();
  const pool=TEARS_POOL;
  g.ellipse(pool.x,pool.y,pool.rx,pool.ry).fill(0x438c97).stroke({color:0x263e45,width:3});
  for(let index=0;index<TEAR_STREAMS.length;index++){
    const left:number[]=[],right:number[]=[],innerLeft:number[]=[],innerRight:number[]=[];
    for(let step=0;step<=24;step++){
      const p=tearPoint(index,step/24,time);
      const rough=Math.sin(step/24*Math.PI)*Math.sin(time*3.4+step*1.9)*6;
      left.push(p.x-p.width/2+rough,p.y);right.unshift(p.x+p.width/2+rough,p.y);
      innerLeft.push(p.x-p.width*.28+rough,p.y);innerRight.unshift(p.x+p.width*.28+rough,p.y);
    }
    g.poly([...left,...right]).fill({color:0x4ca6b4,alpha:.78}).stroke({color:0x294e5a,width:2,alpha:.85});
    g.poly([...innerLeft,...innerRight]).fill({color:0xa3e4de,alpha:.62});
    // Uneven inner ribbons keep the water in the illustration's ink/gouache language.
    for(let streak=0;streak<12;streak++){
      const progress=((time*.6+streak/12+index*.11)%1)**.72;
      const a=tearPoint(index,progress,time),b=tearPoint(index,Math.min(1,progress+.075),time);
      const across=Math.sin(streak*2.1)*.26;
      g.moveTo(a.x+a.width*across,a.y).lineTo(b.x+b.width*across,b.y).stroke({color:streak%3?0xd4f6ed:0xffffff,width:streak%3?5:8,alpha:.4+Math.sin(progress*Math.PI)*.24});
    }
    const end=TEAR_STREAMS[index].end;
    for(let drop=0;drop<9;drop++){
      const p=(time*.8+drop/9)%1,side=drop%2?1:-1;
      g.ellipse(end[0]+side*p*(18+drop*4),end[1]-Math.sin(p*Math.PI)*(18+drop*4),2.5,5).fill({color:0xd3f7ed,alpha:(1-p)*.65});
    }
    for(let mist=0;mist<4;mist++){
      const p=(time*.3+mist/4)%1;
      g.ellipse(end[0]+Math.sin(mist*2.7)*25,end[1]-p*37,17+p*25,6+p*9).fill({color:0xe5f6ef,alpha:Math.sin(p*Math.PI)*.15});
    }
  }
  for(let ripple=0;ripple<5;ripple++){
    const p=(time*.24+ripple/5)%1;
    g.ellipse(pool.x,pool.y,24+p*180,2+p*16).stroke({color:0xc4f2eb,width:2,alpha:(1-p)*.42});
  }
}

function Monument({worldX}:{worldX:number}){
  const texture=useDirectTexture("/art/world-v3/decor/statue-of-tears.webp");
  const root=useRef<Container>(null),art=useRef<Container>(null),water=useRef<Graphics>(null),shadow=useRef<Graphics>(null);
  const elapsed=useRef(0),drawn=useRef(-Infinity),wasStill=useRef(false);
  useSceneTick(ticker=>{
    const node=root.current,camera=scene.camera;
    if(!node)return;
    node.visible=Boolean(texture)&&worldX>camera.x-400&&worldX<camera.x+camera.viewW+400;
    if(!node.visible||!art.current||!water.current||!isDrawn(node))return;
    const safeTop=(scene.topInset+12-camera.screenOffsetY)/camera.scale+camera.y;
    const height=Math.min(445,Math.max(220,WALKABLE_GROUND_Y+TEARS_BASE_OFFSET-safeTop));
    art.current.scale.set(height/meta.heights[0]);
    if(shadow.current)shadow.current.scale.x=height/445;
    const still=scene.reducedMotion||scene.lowPower;
    if(still){
      if(!wasStill.current||drawn.current===-Infinity)paintWater(water.current,0);
      wasStill.current=true;return;
    }
    wasStill.current=false;elapsed.current+=ticker.elapsedMS/1000;
    // A separate render group limits geometry rebuilds to the water, at 30 fps.
    if(elapsed.current-drawn.current>=1/30){paintWater(water.current,elapsed.current);drawn.current=elapsed.current;}
  });
  return <pixiContainer ref={root} visible={false} x={worldX} y={WALKABLE_GROUND_Y+TEARS_BASE_OFFSET} label={`statue-of-tears:${worldX}`}>
    <pixiGraphics ref={shadow} draw={contact}/>
    <pixiContainer ref={art} scale={400/meta.heights[0]} label="tears-art">
      <pixiContainer x={-meta.width/2} y={-meta.baseline}>
        {texture?<pixiSprite texture={texture} label="tears-stone"/>:null}
        <pixiContainer isRenderGroup><pixiGraphics ref={water} draw={EMPTY} label="tears-water"/></pixiContainer>
      </pixiContainer>
    </pixiContainer>
  </pixiContainer>;
}

/** Architecture shares the near road plane; the player's full body stays in front. */
export function StatueOfTears(){
  const biomes=useLayerBiomes(1,800);
  return <pixiContainer label="statues-of-tears">{biomes.filter(({index})=>BIOMES[index].id==="lac").map(({offset})=><Monument key={offset} worldX={offset+TEARS_MONUMENT_X}/>)}</pixiContainer>;
}
