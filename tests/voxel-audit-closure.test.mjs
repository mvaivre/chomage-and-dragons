import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks}from'node:module';import * as THREE from 'three';
registerHooks({resolve(s,c,n){if(s.startsWith('@/'))return n(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c);}});
const w=await import('../src/components/voxel/world.ts'),sites=await import('../src/components/voxel/sites.ts'),{landscapeModel}=await import('../src/components/voxel/landscapes.ts'),{VoxelResources}=await import('../src/components/voxel/resources.ts'),{makeChunk}=await import('../src/components/voxel/chunks.ts');
test('narrative setpieces and their planting reservations stay clear of river channels',async()=>{
 const {decorForLap}=await import('../src/lib/game/decor.ts');let shifted=0;
 for(const lap of [0,1])for(const d of decorForLap(lap).filter(d=>d.setpiece)){
  const p=sites.narrativeSite(d.x/w.WORLD_SCALE);if(p.x!==d.x/w.WORLD_SCALE)shifted++;
  const reservation=sites.sceneryFootprints(p.x-1,p.x+1).find(s=>s.id===`landmark:${d.id}`);assert.ok(reservation);assert.equal(reservation.x,p.x);assert.equal(reservation.z,p.z);
  for(const river of w.riverSites(lap))for(const dz of [-2.8,0,2.8]){const r=w.riverProfile(river,p.z+dz);assert.ok(Math.abs(p.x-r.center)>=r.width+4.4);}
 }
 assert.ok(shifted>0,'exercise a previously flooded setpiece');
});
test('graded house pads support every ground-bearing house on two laps without foundation towers',()=>{
 const r=new VoxelResources();let houses=0;
 for(const lap of [0,1])for(const p of sites.landscapePlots(lap)){
  const model=landscapeModel(r,p);
  for(const h of model.userData.houses??[]){if(h.stilt)continue;houses++;assert.ok(h.groundRange<.06,`${p.id}: uneven house foundation ${h.groundRange}`);assert.ok(h.floor-w.terrainSurface(h.x,h.z)<.3);}
  r.release(model);
 }
 assert.ok(houses>=12);assert.equal(r.instances.size,0);r.dispose();
});
test('rivers meander with variable width and soft landward banks while fitting under each bridge',()=>{
 for(const river of w.riverSites(0)){
  const profiles=Array.from({length:61},(_,i)=>w.riverProfile(river,i-30));assert.ok(Math.max(...profiles.map(p=>p.center))-Math.min(...profiles.map(p=>p.center))>3);assert.ok(Math.max(...profiles.map(p=>p.width))-Math.min(...profiles.map(p=>p.width))>.5);
  for(const dz of [-1.4,0,1.4]){const p=w.riverProfile(river,w.routeZ(river.x)+dz);assert.ok(Math.abs(p.center-river.x)+p.width<4.1,'bridge spans the water across its walkable width');}
  for(const z of [-12,-5,0,7,12]){const p=w.riverProfile(river,z);for(const sign of [-1,1]){const x=p.center+sign*(p.width+.03);assert.ok(w.terrainHeight(x,z)>river.y-.05,'bank meets the surface rather than forming a dry underwater shelf');}}
 }
});
test('the facet surface and terrain sampler agree across every biome and streaming seam',()=>{
 const r=new VoxelResources(true,4),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let checked=0;
 for(const cx of [0,8,12,17,21,25,28,31,34]){
  const chunk=makeChunk(cx,0,r),meshes=chunk.children.filter(o=>o.isMesh&&!o.isInstancedMesh&&o.name!=='fogged-ground-continuation');chunk.updateMatrixWorld(true);
  for(let i=0;i<12;i++){
   const x=cx*16+.31+i*1.23,z=-12.17+i*1.83,pool=w.foregroundPool(x);
   if(w.riverAt(x,z)||w.lavaAt(x,z)||w.villagePond(x,z)||(pool&&w.poolRadius(pool,x,z)<1.3))continue;
   if(w.riverSites(0).some(s=>{const p=w.riverProfile(s,z);return Math.abs(x-p.center)<p.width+.5;}))continue;
   const y=w.terrainSurface(x,z);ray.set(new THREE.Vector3(x,y+100,z),down);const hit=ray.intersectObjects(meshes)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-y)<.00005,`${cx}: terrain/sampler mismatch ${hit.point.y-y}`);checked++;
  }
  chunk.userData.dispose();
 }
 assert.ok(checked>75);r.dispose();
});
