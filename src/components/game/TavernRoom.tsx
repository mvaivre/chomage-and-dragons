"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Rectangle, Texture, type Container, type Graphics, type Sprite } from "pixi.js";
import { WALKABLE_GROUND_Y } from "@/lib/game/world";
import { TAVERN_GUESTS, tavernMoonwalk } from "@/lib/game/tavern";
import { scene, viewedX } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { reactionProgress, updateEnvironmentTarget, updateSpriteTarget, useEnvironmentTarget } from "./environment-targets";
import { useViewportResident } from "./resident-visibility";
import { atmosphereTextures } from "./atmosphere-textures";
import { DecorLabel } from "./DecorSetpiece";
import castA from "../../../public/art/world-v3/decor/interior-tavern-cast-a.json";
import castB from "../../../public/art/world-v3/decor/interior-tavern-cast-b.json";
import doorway from "../../../public/art/world-v3/decor/interior-door.json";
import exterior from "../../../public/art/world-v3/decor/exterior-tavern.json";
import pigeon from "../../../public/art/world-v3/animations/tavern-pigeon.json";

const GROUND=WALKABLE_GROUND_Y;
const candlePositions=[[.075,.19],[.113,.265],[.195,.266],[.247,.18],[.292,.36],[.37,.36],[.42,.26],[.515,.27],[.55,.63],[.67,.29],[.768,.28],[.816,.36],[.885,.38],[.93,.18],[.965,.64]];
const wallOffsets=[-2,-1,0,1,2,3,4];
const fillWall=(g:Graphics)=>{g.clear().rect(-5000,-3000,13000,GROUND+3000).fill(0x261b18);};
const fillFloor=(g:Graphics)=>{g.clear().rect(-5000,GROUND,13000,3000).fill(0x493326);};
const seamPost=(g:Graphics)=>{g.clear().poly([-10,0,7,0,12,887,-8,887]).fill(0x33251e).stroke({color:0x16130f,width:3});g.moveTo(-3,0).lineTo(1,887).stroke({color:0x69503a,width:2});};
const paintCandle=(g:Graphics)=>{g.clear().poly([-4,0,4,0,5,19,-4,18]).fill(0xd7bc7b).stroke({color:0x211b19,width:1.5});g.ellipse(0,20,8,3).fill(0x3a2820);g.poly([0,-11,-3,-3,0,1,3,-3]).fill(0xffbc4e);g.ellipse(0,-3,1.2,3).fill(0xfff1bb);};
function availableHeight(){const c=scene.camera;return Math.max(210,GROUND-((scene.topInset+10-c.screenOffsetY)/c.scale+c.y));}

/** One optical texture shared by every light. No blur filters or per-frame redraw. */
function Candle({x,y,index,paint=false}:{x:number;y:number;index:number;paint?:boolean}) {
  const glow=useMemo(()=>atmosphereTextures().glow,[]),ref=useRef<Sprite>(null),flame=useRef<Graphics>(null);
  useSceneTick(()=>{
    const t=scene.reducedMotion?0:scene.atmosphereTime;
    if(ref.current){ref.current.alpha=.38+Math.sin(t*4.3+index)*Math.sin(t*7.1+index*1.7)*.055;}
    if(flame.current)flame.current.scale.y=1+Math.sin(t*6+index)*.025;
  });
  return <pixiContainer x={x} y={y} label="tavern-candle">
    <pixiSprite ref={ref} texture={glow} anchor={.5} width={paint?100:200} height={paint?100:220} tint={0xffa83c} blendMode="add" alpha={.38}/>
    {paint?<pixiGraphics ref={flame} draw={paintCandle}/>:null}
  </pixiContainer>;
}
function TavernWall(){
  const texture=useDirectTexture("/art/world-v3/decor/interior-tavern-wall.webp"),root=useRef<Container>(null);
  useSceneTick(()=>{if(root.current){const h=Math.min(430,availableHeight()+12);root.current.y=GROUND-h;root.current.scale.set(h/887);}});
  return <pixiContainer ref={root} y={GROUND-400} scale={400/887} label="tavern-wall">
    {wallOffsets.map(tile=><pixiContainer key={tile} x={tile*1774}>
      {texture?<pixiSprite texture={texture}/>:null}
      <pixiGraphics draw={seamPost}/>
      {candlePositions.map(([x,y],i)=><Candle key={i} x={x*1774} y={y*887} index={i+tile*17}/>)}
    </pixiContainer>)}
  </pixiContainer>;
}
const paintTitle=(g:Graphics)=>{g.clear().poly([-200,-4,199,-2,197,54,-202,53]).fill(0xd7bd7e).stroke({color:0x231b17,width:4});g.rect(-191,4,380,41).stroke({color:0x816335,width:1});};
const chain=(g:Graphics)=>{g.clear();for(let y=-35;y<2;y+=8)g.ellipse(0,y,3,5).stroke({color:0x1c1818,width:2});};
const shadow=(g:Graphics)=>{g.clear().ellipse(0,0,50,7).fill({color:0x140d0b,alpha:.28});};
type GuestSpec=(typeof TAVERN_GUESTS)[number];
function Guest({spec,from}:{spec:GuestSpec;from:number}){
  const meta=spec.sheet==="a"?castA:castB;
  const base=useDirectTexture(`/art/world-v3/decor/interior-tavern-cast-${spec.sheet}.webp`);
  const frames=base?atlasFrames(base,2,2):null;
  const root=useRef<Container>(null),body=useRef<Sprite>(null),contact=useRef<Graphics>(null),table=useRef<Sprite>(null);
  // Separate the dancers from their table: boots bounce while its feet stay planted.
  const split=372;
  const dancerParts=useMemo(()=>{
    if(!base||spec.id!=="dancers")return null;
    return [new Texture({source:base.source,frame:new Rectangle(512,512,512,split)}),new Texture({source:base.source,frame:new Rectangle(512,512+split,512,512-split)})];
  },[base,spec.id]);
  const id=`tavern:${from}:${spec.id}`,target=useEnvironmentTarget(id,"traveller",from+spec.x);
  useViewportResident(id,spec.id==="dragon"?"dragon":`tavern:${spec.id}`,body,target,contact,table);
  useLayoutEffect(()=>{updateEnvironmentTarget(id,{label:spec.label,lines:spec.lines});},[id,spec]);
  useSceneTick(()=>{
    const node=body.current,container=root.current;
    if(!node||!container){updateSpriteTarget(id,null,0);return;}
    const hanging=spec.id==="chandelier",height=Math.min(spec.height,availableHeight()*(hanging?.54:.72));
    const scale=height/meta.heights[spec.frame];
    const t=scene.reducedMotion?0:scene.atmosphereTime,phase=spec.x*.013;
    const reaction=scene.reducedMotion?0:Math.sin(reactionProgress(target.current)*Math.PI)*.025;
    container.y=hanging?GROUND-availableHeight()+20:GROUND+10;
    node.scale.set(scale,scale*(1+Math.sin(t*2.4+phase)*.006));
    if(spec.id==="dancers"){
      node.y=(split-476)*scale-Math.max(0,Math.sin(t*5.2))*3;
      if(table.current)table.current.scale.set(scale);
    }
    if(spec.id==="dragon"){
      const hiccup=Math.max(0,Math.sin((t%7)*Math.PI*3))*(t%7<.65?1:0);
      node.scale.y+=hiccup*scale*.035;
    }
    node.rotation=hanging?Math.sin(t*.95)*.085:spec.id==="handstand"?Math.sin(t*1.4)*.025:Math.sin(t*1.7+phase)*.012+reaction;
    node.skew.x=hanging?0:Math.sin(t*2.4+phase)*.009;
    // Click geometry follows the entire hanging body instead of assuming ground feet.
    updateSpriteTarget(id,container,height,height*meta.widths[spec.frame]/meta.heights[spec.frame],1,hanging?height:0);
  });
  const hanging=spec.id==="chandelier";
  return <pixiContainer ref={root} x={spec.x} y={GROUND+10} label={`tavern-guest:${spec.id}`}>
    {!hanging?<pixiGraphics ref={contact} draw={shadow} scale={{x:spec.height/150,y:1}}/>:null}
    {hanging?<pixiGraphics draw={chain}/>:null}
    {dancerParts?<pixiSprite ref={table} label="tavern-table" texture={dancerParts[1]} anchor={{x:.5,y:(476-split)/(512-split)}} scale={spec.height/meta.heights[spec.frame]}/>:null}
    {frames?<pixiSprite ref={body} label={`tavern-art:${spec.id}`} texture={dancerParts?.[0]??frames[spec.frame]} anchor={{x:.5,y:dancerParts?1:(hanging?476-meta.heights[spec.frame]:476)/512}} scale={spec.height/meta.heights[spec.frame]}/>:null}
  </pixiContainer>;
}
function MoonwalkingPigeon({from}:{from:number}){
  const base=useDirectTexture("/art/world-v3/animations/tavern-pigeon.webp"),frames=base?atlasFrames(base,2,2):null;
  const root=useRef<Container>(null),body=useRef<Sprite>(null),contact=useRef<Graphics>(null);
  const id=`tavern:${from}:pigeon`,target=useEnvironmentTarget(id,"traveller",from+1370);
  useViewportResident(id,"tavern:pigeon",body,target,contact);
  useLayoutEffect(()=>{updateEnvironmentTarget(id,{label:"Regarder le pigeon faire un moonwalk",lines:["Il n’a plus les idées en place, mais il a les pas.","Le pigeon refuse de souffler dans la flûte du barde."]});},[id]);
  useSceneTick(()=>{
    if(!body.current||!root.current||!frames){updateSpriteTarget(id,null,0);return;}
    const pose=tavernMoonwalk(scene.atmosphereTime,scene.reducedMotion);
    root.current.x=1370+pose.offset;
    body.current.texture=frames[pose.frame];body.current.scale.set(pose.facing*58/Math.max(...pigeon.heights),58/Math.max(...pigeon.heights));
    updateSpriteTarget(id,root.current,58,76);
  });
  return <pixiContainer ref={root} x={1370} y={GROUND+22} label="tavern-guest:pigeon">
    <pixiGraphics ref={contact} draw={shadow} scale={{x:.6,y:.65}}/>
    {frames?<pixiSprite ref={body} label="tavern-art:pigeon" texture={frames[0]} anchor={{x:.5,y:pigeon.baseline/pigeon.height}} scale={58/Math.max(...pigeon.heights)}/>:null}
  </pixiContainer>;
}

export function TavernRoom({from,to}:{from:number;to:number}){
  const root=useRef<Container>(null),title=useRef<Container>(null),floor=useDirectTexture("/art/world-v3/decor/interior-factory-floor.webp");
  useSceneTick(()=>{if(root.current)root.current.visible=scene.viewedRoom?.from===from;if(title.current)title.current.y=GROUND-availableHeight()+8;});
  return <pixiContainer ref={root} x={from} visible={false} label={`interior:tavern:${from}`}>
    <pixiGraphics draw={fillWall}/><TavernWall/><pixiGraphics draw={fillFloor}/>
    {floor?[-2,-1,0,1,2,3,4].map(i=><pixiSprite key={i} texture={floor} x={i*830} y={GROUND} width={830} height={361} tint={0xc89566}/>):null}
    <pixiContainer ref={title} x={960} y={GROUND-290} label="tavern-title"><pixiGraphics draw={paintTitle}/><DecorLabel text="LA TAVERNE" rect={[-190,0,380,50]}/></pixiContainer>
    {[180,460,740,975,1130,1300,1550,1720,1890].map((x,i)=><Candle key={x} x={x} y={GROUND-18} index={i+120} paint/>)}
    {TAVERN_GUESTS.map(spec=><Guest key={spec.id} spec={spec} from={from}/>)}
    <MoonwalkingPigeon from={from}/>
    <TavernDoor x={0} label="Dehors ←"/><TavernDoor x={to-from} label="Sortie →"/>
  </pixiContainer>;
}

function TavernDoor({x,label}:{x:number;label:string}){
  // Low door silhouette leaves the revelers visible in the narrow camera.
  const texture=useDirectTexture("/art/world-v3/decor/interior-door.webp"),scale=205/doorway.heights[0];
  return <pixiContainer x={x} y={GROUND+4} label="interior-door">
    {texture?<pixiSprite texture={texture} anchor={{x:.5,y:doorway.baseline/doorway.height}} scale={scale} tint={0xb88c58}/>:null}
    <DecorLabel text={label} rect={[-40,-184,80,24]}/>
  </pixiContainer>;
}

/** Both facades share the same door trigger; architecture stays behind the hero. */
export function TavernExterior({x,mirror}:{x:number;mirror:boolean}){
  const texture=useDirectTexture("/art/world-v3/decor/exterior-tavern.webp"),root=useRef<Container>(null);
  const doorX=1240,baseline=exterior.baseline,scale=.40;
  useSceneTick(()=>{if(root.current)root.current.visible=mirror?viewedX()>=x-1:viewedX()<=x+1;});
  return <pixiContainer ref={root} x={x} y={GROUND+4} label={`building:tavern:${mirror?"exit":"entry"}`}>
    {texture?<pixiSprite texture={texture} x={(mirror?1:-1)*doorX*scale} y={-baseline*scale} scale={{x:(mirror?-1:1)*scale,y:scale}}/>:null}
    <DecorLabel text="LA TAVERNE" rect={[(mirror?doorX-1155-180:1155-doorX)*scale,(463-baseline)*scale,180*scale,73*scale]}/>
  </pixiContainer>;
}
