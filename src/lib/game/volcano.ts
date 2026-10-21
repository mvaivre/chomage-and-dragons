import { BIOMES, WORLD_LENGTH } from "./world";
const land=BIOMES.find(b=>b.id==="volcan")!;
export const VOLCANO={from:land.from*WORLD_LENGTH,to:land.to*WORLD_LENGTH,center:(land.from+land.to)*WORLD_LENGTH/2};
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
/** Fade in physical space, including later laps, rather than switching on camera cuts. */
export function volcanicLightAt(worldX:number){
  const x=Math.max(0,worldX)%WORLD_LENGTH;
  return smooth((x-VOLCANO.from)/300)*smooth((VOLCANO.to-x)/300);
}
/** Slow, bounded incandescent breathing; reduced motion retains a steady glow. */
export function lavaPulse(seconds:number,reduced=false){
  return reduced ? .82 : .82+Math.sin(seconds*.83)*.11+Math.sin(seconds*1.71+.4)*.06;
}
