import * as THREE from "three";
import { VoxelResources } from "./resources";
import { propModel } from "./objects";
import { terrainSurface, routeZ } from "./world";
import { START_MARKET_X } from "./sites";

/** First-lap terminus: a stocked handcart closes the road, a stall sits behind it.
 * The right-hand playable lane stays completely clear. No extra texture or light. */
export function startingMarket(r: VoxelResources) {
  const root = new THREE.Group(), batch = r.batch(root, false, 0, true), box = batch.box;
  const x = START_MARKET_X, z = routeZ(x), base = terrainSurface(x, z);
  root.name = "starting-market"; root.position.set(x, base, z);
  root.userData.startingMarket = true;
  const ground = (xx: number, zz: number) => terrainSurface(x + xx, z + zz) - base;
  // Loaded cart across the entire width of the walking lane.
  const cartY = Math.max(...[-.6,.6].flatMap(dx=>[-1.5,1.5].map(dz=>ground(dx,dz))));
  box(0x775132, 0, cartY + .62, 0, 1.5, .18, 3.7);
  for (const end of [-1,1]) {
    box(0xa87c49, end * .68, cartY + .98, 0, .12, .64, 3.65);
    for (const side of [-1,1]) {
      box(0x403b32, end * .57, cartY + .35, side * 1.42, .29, .69, .67);
      box(0x8b6944, end * .73, cartY + .35, side * 1.42, .08, .37, .37);
      box(0xc59a58, end * .79, cartY + .35, side * 1.42, .1, .12, .12);
    }
  }
  for(const side of [-1,1])box(0x906b40,0,cartY+1.0,side*1.79,1.45,.61,.12);
  for(let i=0;i<3;i++) {
    const zz=(i-1)*1.05;
    box(0xc29b60,0,cartY+.84,zz,1.12,.3,.88);
    for(let j=0;j<4;j++)box(i===0?0xc96543:i===1?0x80a44d:0xdda451,(j%2-.5)*.43,cartY+1.08+Math.floor(j/2)*.1,zz+(Math.floor(j/2)-.5)*.35,.29,.26,.28);
  }
  // Stepped striped awning, safely behind the lane and clear of village roofs.
  const sx=-2.5, sz=-3.3;
  const floor=Math.max(...[-1.45,1.45].flatMap(dx=>[-.8,.8].map(dz=>ground(sx+dx,sz+dz))));
  for(const dx of [-1.5,1.5])for(const dz of [-.85,.85]) {
    const low=ground(sx+dx,sz+dz);
    box(0x775332,sx+dx,(low+floor+2.55)/2,sz+dz,.13,floor+2.55-low,.13);
  }
  for(let i=0;i<7;i++)for(let row=0;row<3;row++)box(i%2?0xd6b76d:0x4f8f86,sx-1.35+i*.45,floor+2.6-row*.1,sz-.7+row*.65,.46,.13,.69);
  box(0x8d6542,sx,floor+.9,sz+.56,3.05,.17,.85);
  box(0xba9259,sx,floor+.5,sz+.78,2.95,.75,.13);
  for(let i=0;i<4;i++) {
    const xx=sx-1+i*.68;
    box(0x88673c,xx,floor+1.08,sz+.56,.57,.2,.6);
    for(let j=0;j<3;j++)box(i%2?0xd39343:0x7d9b4b,xx+(j-1)*.15,floor+1.24,sz+.55,.16,.19,.22);
  }
  // A low physical arrow points right; no floating label or second text panel.
  const ax=1.3, az=1.85, ay=ground(ax,az);
  box(0x765235,ax,ay+.65,az,.1,1.3,.1);
  box(0x526e63,ax+.18,ay+1.38,az,1.55,.57,.15);
  box(0xf1ce7e,ax+.05,ay+1.38,az+.09,.78,.11,.04);
  for(let i=0;i<3;i++)box(0xf1ce7e,ax+.39+i*.1,ay+1.38,az+.09,.13,.43-i*.14,.04);
  batch.finish();
  const merchant=propModel(r,"gnome");merchant.scale.setScalar(.78);
  merchant.position.set(sx,floor,sz-.15);merchant.userData.resident="gnome";root.add(merchant);
  root.userData.animate=(time:number)=>merchant.userData.animate?.(time,false,{motion:"send",blend:0});
  return root;
}
