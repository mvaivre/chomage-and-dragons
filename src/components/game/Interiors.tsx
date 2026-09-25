"use client";

import { memo, useMemo, useRef, useState } from "react";
import type { Container, Graphics, Sprite } from "pixi.js";
import { interiorsInRange, type InteriorId } from "@/lib/game/decor";
import { WALKABLE_GROUND_Y } from "@/lib/game/world";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { DecorLabel } from "./DecorSetpiece";
import { DecorNpc } from "./DecorNpc";
import orpWall from "../../../public/art/world-v3/decor/interior-orp-wall.json";
import factoryWall from "../../../public/art/world-v3/decor/interior-factory-wall.json";
import orpProps from "../../../public/art/world-v3/decor/interior-orp-props.json";
import factoryProps from "../../../public/art/world-v3/decor/interior-factory-props.json";
import orpFacade from "../../../public/art/world-v3/decor/interior-orp-facade.json";
import factoryFacade from "../../../public/art/world-v3/decor/interior-factory-facade.json";

const TILE = 831.6, WALL_HEIGHT = 415.8;
const url = (id:InteriorId, part:string) => `/art/world-v3/decor/interior-${id}-${part}.webp`;

function Prop({id, frame, x, height, y=10, motion}:{id:InteriorId;frame:number;x:number;height:number;y?:number;motion?:"press"|"gear"}) {
  const meta=id==="orp"?orpProps:factoryProps, texture=useDirectTexture(url(id,"props"));
  const frames=texture?atlasFrames(texture,4,2):null, ref=useRef<Sprite>(null), clock=useRef(x%9);
  const pivot=motion==="gear"?factoryProps.frames[6].pivot:motion==="press"?factoryProps.frames[2].pivot:null;
  useSceneTick(ticker=>{
    if(!ref.current || scene.reducedMotion)return;
    clock.current+=ticker.elapsedMS/1000;
    if(motion==="gear")ref.current.rotation=clock.current*0.4;
    if(motion==="press") {const t=clock.current%4;ref.current.y=y+(t<0.3?t/0.3*45:t<0.7?45:t<1.4?(1.4-t)/0.7*45:0);}
  });
  const text=frame===1&&id==="orp"?"Patience":frame===3&&id==="orp"?"Hors service":null;
  const rect=meta.frames[frame].text;
  const scale=height/meta.heights[frame];
  return <pixiContainer x={x}>
    {frames?<pixiSprite ref={ref} label={`prop:${id}:${frame}`} texture={frames[frame]} y={y} anchor={{x:pivot?pivot[0]/512:0.5,y:pivot?pivot[1]/512:496/512}} scale={scale}/>:null}
    {text&&rect?<DecorLabel text={text} rect={[(rect[0]-256)*scale,(rect[1]-496)*scale+y,rect[2]*scale,rect[3]*scale]}/>:null}
  </pixiContainer>;
}

/** Parchments ride the belt; no texture upload or React update during its cycle. */
function Conveyor({x}:{x:number}) {
  const nodes=useRef<Array<Graphics|null>>([]), clock=useRef(0);
  useSceneTick(ticker=>{
    if(!scene.reducedMotion)clock.current+=ticker.elapsedMS/1000;
    nodes.current.forEach((node,i)=>{if(node)node.x=x-90+((i*70+clock.current*24)%210);});
  });
  return <>{[0,1,2].map(i=><pixiGraphics key={i} ref={node=>{nodes.current[i]=node;}} x={x-90+i*70} y={-65} draw={g=>{g.clear().poly([-10,-3,9,-6,14,0,-5,4]).fill(0xe9dfbd).stroke({color:0x332b22,width:1.5});}}/>)}</>;
}

function Wall({id,length}:{id:InteriorId;length:number}) {
  const texture=useDirectTexture(url(id,"wall")), ceiling=useDirectTexture(url(id,"ceiling"));
  const root=useRef<Container>(null), glass=useRef<Graphics>(null);
  const meta=id==="orp"?orpWall:factoryWall;
  const paintWindows=(g:Graphics)=>{g.clear();for(const offset of [0,TILE])for(const [x,y,w,h]of meta.windows)g.rect(offset+x*TILE/2048,y*WALL_HEIGHT/1024,w*TILE/2048,h*WALL_HEIGHT/1024).fill(0x15254d);};
  useSceneTick(()=>{
    const safe=(scene.topInset+8-scene.camera.screenOffsetY)/scene.camera.scale+scene.camera.y;
    const height=Math.min(WALL_HEIGHT,Math.max(235,WALKABLE_GROUND_Y-safe));
    if(root.current){root.current.y=WALKABLE_GROUND_Y-height;root.current.scale.y=height/WALL_HEIGHT;}
    if(glass.current)glass.current.alpha=scene.night*0.8;
  });
  return <pixiContainer ref={root} y={WALKABLE_GROUND_Y-WALL_HEIGHT}>
    <pixiGraphics draw={g=>{g.clear().rect(0,0,length,WALL_HEIGHT).fill(id==="orp"?0x979c77:0x816145);}}/>
    {[0,TILE].map(offset=><pixiContainer key={offset} x={offset}>
      {texture?<pixiSprite texture={texture} width={TILE} height={WALL_HEIGHT}/>:null}
      {id==="orp"?<DecorLabel text="N° 000 · Votre numéro : 4 812" rect={orpWall.text.map((v,i)=>v*(i%2===0?TILE/2048:WALL_HEIGHT/1024))}/>:null}
      {ceiling?<pixiSprite texture={ceiling} width={TILE} height={64}/>:null}
    </pixiContainer>)}
    <pixiGraphics ref={glass} draw={paintWindows} alpha={0}/>
    <pixiGraphics draw={g=>{g.clear();for(const x of [0,length-14])g.rect(x,0,14,WALL_HEIGHT).fill(0x776248).stroke({color:0x302a23,width:2});}}/>
  </pixiContainer>;
}

function Facade({id,x,mirror}:{id:InteriorId;x:number;mirror:boolean}) {
  const texture=useDirectTexture(url(id,"facade")), meta=id==="orp"?orpFacade:factoryFacade;
  // The slice overlaps the wall by 75 units; only this narrow margin hides the join.
  const scale=0.29, width=meta.width*scale, height=meta.height*scale;
  const rect=meta.text;
  return <pixiContainer x={x} y={WALKABLE_GROUND_Y+10}>
    {texture?<pixiSprite texture={texture} width={width} height={height} anchor={{x:1,y:meta.baseline/meta.height}} scale={{x:(mirror?-1:1)*scale,y:scale}}/>:null}
    <DecorLabel text={id==="orp"?"Centre ORP":"Usine à CV"} rect={[(mirror?meta.width-rect[0]-rect[2]:rect[0]-meta.width)*scale,(rect[1]-meta.baseline)*scale,rect[2]*scale,rect[3]*scale]}/>
  </pixiContainer>;
}

function Room({id,from,to}:{id:InteriorId;from:number;to:number}) {
  const floor=useDirectTexture(url(id,"floor"));
  const length=to-from;
  return <pixiContainer x={from} label={`interior:${id}:${from}`}>
    <Wall id={id} length={length}/>
    <pixiGraphics draw={g=>{g.clear().rect(0,WALKABLE_GROUND_Y,length,1500).fill(id==="orp"?0x9c997f:0x564d41);}}/>
    {floor?<pixiSprite texture={floor} y={WALKABLE_GROUND_Y} width={length} height={361}/>:null}
    <pixiContainer y={WALKABLE_GROUND_Y}>
      {id==="orp"?<>
        <Prop id={id} frame={0} x={210} height={90}/><DecorNpc sheet="orp" row={1} x={240} y={10} worldX={from+240} height={130}/>
        <Prop id={id} frame={1} x={455} height={185}/><Prop id={id} frame={2} x={720} height={105}/>
        <Prop id={id} frame={7} x={1085} height={135}/><DecorNpc sheet="orp" x={1085} y={10} worldX={from+1085} height={145}/>
        <Prop id={id} frame={6} x={1220} height={100}/><Prop id={id} frame={3} x={1460} height={170}/>
        <Prop id={id} frame={5} x={850} height={120}/>
      </>:<>
        <Prop id={id} frame={0} x={245} height={90}/><Conveyor x={245}/><DecorNpc sheet="factory" row={1} x={385} y={10} worldX={from+385} height={145}/>
        <Prop id={id} frame={1} x={650} height={250}/><Prop id={id} frame={2} x={650} y={-195} height={110} motion="press"/>
        <Prop id={id} frame={4} x={950} height={210}/><Prop id={id} frame={6} x={950} y={-118} height={68} motion="gear"/>
        <DecorNpc sheet="factory" x={1170} y={10} worldX={from+1170} height={160}/><Prop id={id} frame={3} x={1460} height={200}/>
        <Prop id={id} frame={5} x={1345} height={80}/>
      </>}
    </pixiContainer>
    <Facade id={id} x={75} mirror={false}/><Facade id={id} x={length-75} mirror/>
  </pixiContainer>;
}

function InteriorsLayer() {
  const measure=()=>`${Math.max(0,Math.floor((scene.camera.x-600)/800))}:${Math.ceil((scene.camera.x+scene.camera.viewW+600)/800)}`;
  const [range,setRange]=useState(measure);
  useSceneTick(()=>{const next=measure();if(next!==range)setRange(next);});
  const rooms=useMemo(()=>{const[a,b]=range.split(":").map(n=>Number(n)*800);return interiorsInRange(a,b).filter(r=>r.id==="orp");},[range]);
  return <pixiContainer>{rooms.map(room=><Room key={room.from} {...room}/>)}</pixiContainer>;
}
export const Interiors=memo(InteriorsLayer);
