"use client";

import { memo, useRef } from "react";
import type { Container, Graphics } from "pixi.js";
import { ACTION_ART } from "@/lib/game/art";
import { interiorAt } from "@/lib/game/decor";
import { decorEventAt } from "@/lib/game/decor-events";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { useDirectTexture } from "./textures";
import { DecorLabel } from "./DecorSetpiece";

const paper=(g:Graphics)=>{g.clear().poly([-13,-17,12,-13,10,18,-15,14]).fill(0xe9dfbc).stroke({color:0x453c30,width:1.8});for(let i=0;i<3;i++)g.moveTo(-7,-6+i*6).lineTo(6,-5+i*6).stroke({color:0x8e8470,width:1});};
/** Soft cloudlets trace the letters themselves, leaving the sky visible inside the O. */
const cloud=(g:Graphics)=>{
  const points:number[][]=[];
  for(const x of [-78,42]) for(let i=0;i<=8;i++) {
    const t=i/8;
    points.push([x,-28+t*56],[x+34,-28+t*56],[x+t*34,-28+t*56]);
  }
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2;points.push([Math.cos(a)*19,Math.sin(a)*29]);}
  g.clear();
  for(const[x,y]of points)g.circle(x,y+2,7.5).fill(0xa9b1b0);
  for(const[x,y]of points)g.circle(x-1,y-1,6.8).fill(0xf1ead7);
};

function DecorEventsLayer() {
  const root=useRef<Container>(null), cvs=useRef<Container>(null), bird=useRef<Container>(null), non=useRef<Container>(null);
  const pigeon=useDirectTexture(ACTION_ART.candidature);
  const clock=useRef(0);
  useSceneTick(ticker=>{
    const node=root.current;if(!node)return;
    if(scene.reducedMotion||scene.momentActive||interiorAt(scene.focus)){node.visible=false;return;}
    const time=Date.now()/1000, event=decorEventAt(scene.focus,time);
    node.visible=event.active&&!interiorAt(event.x);
    if(!node.visible)return;
    clock.current+=ticker.elapsedMS/1000;
    node.x=event.x;
    const top=(scene.topInset+(event.kind==="pigeon"?64:48)-scene.camera.screenOffsetY)/scene.camera.scale+scene.camera.y;
    node.y=Math.max(top,event.kind==="cv"?355:310)+Math.sin(event.phase*Math.PI*2)*12;
    node.alpha=Math.min(1,event.phase*6,(1-event.phase)*6)*0.9;
    if(cvs.current){cvs.current.visible=event.kind==="cv";cvs.current.children.forEach((p,i)=>{p.rotation=Math.sin(clock.current*1.4+i)*0.25;p.y=Math.sin(clock.current*2+i)*15;});}
    if(bird.current){bird.current.visible=event.kind==="pigeon";bird.current.y=Math.sin(clock.current*3)*7;}
    if(non.current)non.current.visible=event.kind==="cloud";
  });
  return <pixiContainer ref={root} visible={false} label="decor-events">
    <pixiContainer ref={cvs}>{[0,1,2].map(i=><pixiGraphics key={i} draw={paper} x={i*45}/>)}</pixiContainer>
    <pixiContainer ref={bird}>
      {pigeon?<pixiSprite texture={pigeon} width={84} height={84} anchor={0.5}/>:null}
      <pixiGraphics draw={g=>{g.clear().poly([-135,40,136,43,132,86,-132,82]).fill(0xe9dfbc).stroke({color:0x453c30,width:2});}}/>
      <DecorLabel text="Retour à l’expéditeur" rect={[-126,43,252,40]}/>
    </pixiContainer>
    <pixiContainer ref={non}><pixiGraphics draw={cloud}/></pixiContainer>
  </pixiContainer>;
}
export const DecorEvents=memo(DecorEventsLayer);
