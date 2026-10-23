import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
registerHooks({resolve(s,c,n){if(s.startsWith('@/'))return n(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c);}});
const {INTERIORS,interiorsInRange}=await import('../src/lib/game/decor.ts');
const {entranceBuilding}=await import('../src/components/voxel/entrances.ts');
const {VoxelResources}=await import('../src/components/voxel/resources.ts');
const {journeyPoint,portalSite,entranceViewZoom}=await import('../src/components/voxel/layout.ts');
const {portalFootprint,onPortalApproach,outsideRoadVisible,villageSites}=await import('../src/components/voxel/sites.ts');
const {WORLD_SCALE,WORLD_METRES,terrainHeight}=await import('../src/components/voxel/world.ts');
test('each public building has a distinct large exterior and a real inward-opening doorway within its reserved footprint',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){const c={font:'',fillRect(){},strokeRect(){},measureText(t){return{width:t.length*parseFloat(this.font.replace('bold ',''))*.55};},fillText(){}};return{width:0,height:0,getContext(){return c;}};}}});
 const r=new VoxelResources(true);const names=new Set();
 try{for(const room of INTERIORS){
  const root=entranceBuilding(r,room),site=portalFootprint(room,0),b=new THREE.Box3().setFromObject(root);names.add(root.name);
  assert.ok(b.max.y>=6.8);assert.ok(b.max.x-b.min.x>=9);assert.ok(b.min.x>=-site.rx-.001&&b.max.x<=site.rx+.001);assert.ok(b.min.z>=-site.rz&&b.max.z<=site.rz);
  let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});assert.ok(triangles<2000,`${room.id}: ${triangles} triangles`);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,1.8,5),new THREE.Vector3(0,0,-1));root.updateMatrixWorld(true);
  assert.ok(ray.intersectObject(root,true)[0].point.z>3,'closed door blocks the entrance');
  root.userData.door.rotation.y=Math.PI*.55;root.updateMatrixWorld(true);
  assert.ok(ray.intersectObject(root,true)[0].point.z<2,'open doorway reaches the vestibule, without a wall slab');
  r.release(root);
 }assert.equal(names.size,3);assert.equal(r.instances.size,0);assert.equal(r.lights.size,0);assert.equal(r.ownedMaterials.size,0);
 }finally{r.dispose();if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}
});
test('the outdoor road ends at every entrance and its clear paved approach meets the threshold on successive laps',()=>{
 for(const lap of [0,1,3])for(const room of interiorsInRange(lap*WORLD_METRES*WORLD_SCALE,(lap+1)*WORLD_METRES*WORLD_SCALE))for(const end of [0,1]){
  const site=portalSite(room,end),sign=end?1:-1;
  assert.equal(outsideRoadVisible(site.boundary+sign*8.1),true);
  for(let d=.01;d<8;d+=.2){const source=site.boundary+sign*d,p=journeyPoint(source*WORLD_SCALE);assert.equal(outsideRoadVisible(source),false);assert.equal(onPortalApproach(p.x,p.z),true);assert.ok(p.y>=terrainHeight(p.x,p.z)+.17,'feet clear the paved ground');}
  const p=journeyPoint((site.boundary+sign*.0001)*WORLD_SCALE);assert.ok(Math.abs(p.x-site.x)<.001);assert.ok(Math.abs(p.z-site.doorZ)<.001);assert.ok(Math.abs(p.y-site.y-.36)<.001);
  assert.ok(entranceViewZoom(site.boundary+sign*6,true)<.8,'phone sees the destination before arriving');
 }
});
test('new-lap village houses do not overlap the tavern exit building',()=>{
 for(const lap of [0,1,3])for(const house of villageSites(lap))for(const room of interiorsInRange((house.x-12)*WORLD_SCALE,(house.x+12)*WORLD_SCALE))for(const end of[0,1]){
  const p=portalFootprint(room,end);assert.ok(Math.abs(p.x-house.x)>=p.rx+3.1+.69||Math.abs(p.z-house.z)>=p.rz+2.8+.69);
 }
});
