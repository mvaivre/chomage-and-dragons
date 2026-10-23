import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import * as THREE from "three";
registerHooks({ resolve(s, c, n) { if (s.startsWith("@/")) return n(new URL(`../src/${s.slice(2)}.ts`, import.meta.url).href, c); if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c); } });
const { VoxelResources } = await import('../src/components/voxel/resources.ts');
const { landmarkModel } = await import('../src/components/voxel/landmarks.ts');
const { tearsSite, sceneryFootprints, landscapePlots, treeFits, foregroundPlots } = await import('../src/components/voxel/layout.ts');
const { terrainHeight, routeHeight, routeZ, riverSites, riverAt, FOREGROUND_DEPTH, BACKGROUND_DEPTH } = await import('../src/components/voxel/world.ts');
const { OcclusionWindow } = await import('../src/components/voxel/occlusion.ts');

test('the enlarged tears sculpture and flowing water fit their shared, tree-free site',()=>{
 const r=new VoxelResources(), model=landmarkModel(r,'tears'),site=tearsSite(0),box=new THREE.Box3().setFromObject(model);
 assert.ok(box.max.y>7 && box.max.y<10);assert.ok(box.max.x-box.min.x>7);
 assert.ok(box.min.x>=-site.rx && box.max.x<=site.rx && box.min.z>=-site.rz&&box.max.z<=site.rz);
 const reserved=sceneryFootprints(site.x-15,site.x+15).find(s=>s.id==='tears:0');assert.equal(reserved.x,site.x);assert.equal(reserved.z,site.z);
 assert.equal(typeof model.userData.animate,'function');model.userData.animate(0);const water=model.getObjectByName('tear-flow'),before=water.children[0].instanceMatrix.array.slice();model.userData.animate(.7);assert.notDeepEqual(water.children[0].instanceMatrix.array,before);
 r.release(model);assert.equal(r.instances.size,0);r.dispose();
});
test('river crossings have real water under the route, stay bounded and repeat deterministically',()=>{
 assert.ok(riverSites(0).length>0);assert.deepEqual(riverSites(0),riverSites(0));
 for(const site of riverSites(0)){for(const z of [-BACKGROUND_DEPTH+1,routeZ(site.x),FOREGROUND_DEPTH-1]){const water=riverAt(site.x,z);assert.ok(water);assert.ok(terrainHeight(site.x,z)<water.y);assert.ok(water.y<routeHeight(site.x)-.4);}}
});
test('a feathered cutout protects the floor and objects behind the hero in either camera direction',()=>{
 const mask=new OcclusionWindow(), camera=new THREE.OrthographicCamera(-10,10,8,-8,.1,100);
 for(const direction of [1,-1]){camera.position.set(0,8,direction*12);camera.lookAt(0,1,0);camera.updateMatrixWorld();camera.updateProjectionMatrix();mask.begin(800,640);mask.add(camera,new THREE.Vector3(0,1,0),2.4,0);assert.equal(mask.count,1);
  const center=mask.windows[0];assert.ok(center.w>30);assert.ok(mask.coverage(center.x,center.y,center.z-2,1)>0.95);assert.equal(mask.coverage(center.x,center.y,center.z+1,1),0);assert.equal(mask.coverage(center.x,center.y,center.z-2,0),0);assert.equal(mask.coverage(center.x+center.w*1.1,center.y,center.z-2,1),0);
  assert.ok(mask.coverage(center.x+center.w*.85,center.y,center.z-2,1)>0 && mask.coverage(center.x+center.w*.85,center.y,center.z-2,1)<1);
 }
 const r=new VoxelResources(true);assert.equal(r.cutout.count,0);r.dispose();
});

const { landscapeModel } = await import('../src/components/voxel/landscapes.ts');
const { skyDragon, skyFlights } = await import('../src/components/voxel/sky.ts');
const { riverBridge } = await import('../src/components/voxel/bridges.ts');
const { makeChunk } = await import('../src/components/voxel/chunks.ts');
function cost(root) { let triangles=0,draws=0;root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);draws++;}});return {triangles,draws}; }

test('nine biomes have distinct, bounded sites and safe tree clearings, on consecutive laps',()=>{
 for(const lap of [0,1,3]){
  const plots=landscapePlots(lap);assert.deepEqual(plots,landscapePlots(lap));
  assert.equal(new Set(plots.map(p=>p.biome)).size,9);assert.ok(new Set(plots.map(p=>p.kind)).size>=12);
  const r=new VoxelResources(true);
  for(const plot of plots){
   const model=landscapeModel(r,plot);const count=r.instances.size;
   for(const time of [0,1,7,31]){
    model.userData.animate?.(time);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);
    assert.ok(box.min.x>=plot.x-plot.rx-.01&&box.max.x<=plot.x+plot.rx+.01,`${plot.id} x bounds`);
    assert.ok(box.min.z>=plot.z-plot.rz-.01&&box.max.z<=plot.z+plot.rz+.01,`${plot.id} z bounds`);
   }
   assert.equal(r.instances.size,count);assert.ok(cost(model).triangles<2000,`${plot.id} triangle budget`);assert.ok(cost(model).draws<=6);
   const others=sceneryFootprints(plot.x-20,plot.x+20).filter(p=>p.id!==plot.id);
   for(const other of others)assert.ok(Math.abs(plot.x-other.x)>=plot.rx+other.rx+.69||Math.abs(plot.z-other.z)>=plot.rz+other.rz+.69,`${plot.id} overlaps ${other.id}`);
   assert.equal(treeFits(plot.x+plot.rx+1,plot.z,1,[plot]),false,'canopy clearance, not just trunk clearance');
   r.release(model);
  }
  assert.equal(r.instances.size,0);assert.equal(r.ownedMaterials.size,0);r.dispose();
 }
});
test('bridges clear the route and their river, foreground and flight animations keep bounded resources',()=>{
 const r=new VoxelResources(true,4);
 for(const site of riverSites(0)){
  const bridge=riverBridge(r,site),initial=r.instances.size;bridge.userData.animate(0);const before=bridge.children.at(-1).children[0].instanceMatrix.array.slice();
  bridge.userData.animate(2);assert.notDeepEqual(bridge.children.at(-1).children[0].instanceMatrix.array,before);assert.equal(r.instances.size,initial);assert.ok(cost(bridge).triangles<2000);r.release(bridge);
 }
 for(const flight of skyFlights(0)){
  const dragon=skyDragon(r,flight.x,flight.color);assert.ok(cost(dragon).triangles<400);const count=r.instances.size;
  for(let t=0;t<60;t+=.5){dragon.userData.animate(t);assert.ok(dragon.position.y>=routeHeight(dragon.position.x)+5.3);assert.ok(Math.abs(dragon.position.x-flight.x)<=10);}
  assert.equal(r.instances.size,count);r.release(dragon);
 }
 assert.ok(foregroundPlots(0).length>=6);
 for(const x of [171,199,272,350,387,449,497]){
  const cx=Math.floor(x/16),chunk=makeChunk(cx,0,r),reserved=sceneryFootprints(cx*16-4,(cx+1)*16+4);
  for(const tree of chunk.userData.trees)assert.ok(treeFits(tree.x,tree.z,tree.size,reserved));
  chunk.userData.dispose();
 }
 assert.equal(r.instances.size,0);r.dispose();
});

test('the default desktop composition contains elevated villages and their hero together',async()=>{
 const {landscapeView}=await import('../src/components/voxel/layout.ts'),r=new VoxelResources();
 for(const plot of landscapePlots(0).filter(p=>['hamlet','alpine-hamlet','forge'].includes(p.kind))){
  const model=landscapeModel(r,plot),bounds=new THREE.Box3().setFromObject(model),frame=landscapeView(plot.x);
  const focus=new THREE.Vector3(plot.x,routeHeight(plot.x)+.18,routeZ(plot.x)),camera=new THREE.OrthographicCamera(-14.1,14.1,8.9,-9.9,.1,100);
  camera.position.set(focus.x+Math.sin(.62)*38*Math.cos(.74),focus.y+Math.sin(.74)*38,focus.z+Math.cos(.62)*38*Math.cos(.74));camera.lookAt(focus);camera.zoom=frame.zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z]){const p=new THREE.Vector3(x,bounds.max.y,z).project(camera);assert.ok(p.y<.94,`${plot.kind} roof is framed (${p.y})`);}
  assert.equal(frame.lift,0);
  const hero=new THREE.Vector3(plot.x,routeHeight(plot.x)+1,routeZ(plot.x)).project(camera);assert.ok(hero.y>-.78,`${plot.kind}: hero above action dock`);
  r.release(model);
 }
 r.dispose();
});

test('all longitudinal terrain edges are shared instead of narrow vertical risers',()=>{
 const r=new VoxelResources(true,4);
 for(const cx of [0,1,12,23,26,28,31,34]){
  const chunk=makeChunk(cx,0,r);
  for(const mesh of chunk.children.filter(o=>o.isMesh&&!o.isInstancedMesh&&o.name!=='fogged-ground-continuation')){
   const n=mesh.geometry.attributes.normal;
   for(let i=0;i<n.count;i+=3)assert.ok(!(Math.abs(n.getX(i))>.99&&Math.abs(n.getY(i))<.01),'no dark longitudinal sliver');
  }
  chunk.userData.dispose();
 }
 r.dispose();
});
