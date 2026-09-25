"use client";
import { useEffect, useRef } from "react";
import type { Container, Graphics } from "pixi.js";
import { interiorsInRange } from "@/lib/game/decor";
import { scene, WORLD_BOTTOM } from "./scene";
import { useSceneTick } from "./useSceneTick";

/** Cut actual world intervals out of a faster foreground plane, including at room edges. */
export function OutdoorMask({factor, children}:{factor:number;children:React.ReactNode}) {
  const content=useRef<Container>(null), mask=useRef<Graphics>(null), last=useRef("");
  useEffect(()=>{const node=content.current;if(node && mask.current)node.mask=mask.current;return()=>{if(node)node.mask=null;};},[]);
  useSceneTick(()=>{
    const {camera}=scene, key=`${camera.x}:${camera.viewW}`;
    if(!mask.current || last.current===key)return;
    last.current=key;
    const left=camera.x-1600,right=camera.x+camera.viewW+1600;
    const shift=(camera.x+camera.viewW/2)*(factor-1);
    const g=mask.current;g.clear();let cursor=left;
    for(const room of interiorsInRange(left,right)) {
      if(room.from>cursor)g.rect(cursor+shift,-WORLD_BOTTOM,room.from-cursor,WORLD_BOTTOM*2).fill(0xffffff);
      cursor=Math.max(cursor,room.to);
    }
    if(cursor<right)g.rect(cursor+shift,-WORLD_BOTTOM,right-cursor,WORLD_BOTTOM*2).fill(0xffffff);
  });
  return <pixiContainer><pixiContainer ref={content}>{children}</pixiContainer><pixiGraphics ref={mask} draw={()=>{}} /></pixiContainer>;
}
