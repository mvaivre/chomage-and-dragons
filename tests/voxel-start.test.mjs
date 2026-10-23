import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
registerHooks({resolve(s,c,n){if(s.startsWith('@/'))return n(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c);}});
const {startingMarket}=await import('../src/components/voxel/starting-market.ts');
const {VoxelResources}=await import('../src/components/voxel/resources.ts');
const {START_MARKET_X,startingMarketSite,outsideRoadVisible}=await import('../src/components/voxel/sites.ts');
const {routeZ,terrainSurface}=await import('../src/components/voxel/world.ts');

test('the starting market closes the left lane, reserves all its planting space and leaves the saved start clear',()=>{
 const r=new VoxelResources(true),market=startingMarket(r);
 try {
  market.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(market),site=startingMarketSite();
  assert.ok(bounds.max.x<-2.5,'no market geometry reaches the playable start');
  assert.ok(bounds.min.x>=site.x-site.rx&&bounds.max.x<=site.x+site.rx);
  assert.ok(bounds.min.z>=site.z-site.rz&&bounds.max.z<=site.z+site.rz);
  for(const dz of [-1.3,0,1.3]){
   const z=routeZ(START_MARKET_X)+dz,y=terrainSurface(START_MARKET_X,routeZ(START_MARKET_X))+1;
   const ray=new THREE.Raycaster(new THREE.Vector3(START_MARKET_X-1.5,y,z),new THREE.Vector3(1,0,0),0,2.5);
   assert.ok(ray.intersectObject(market,true).length,`the stocked cart closes the lane at z offset ${dz}`);
  }
  assert.equal(outsideRoadVisible(START_MARKET_X-1),false);
  assert.equal(outsideRoadVisible(0),true);
  let triangles=0,calls=0;
  market.traverse(o=>{if(o.isMesh){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
  assert.ok(triangles<2000,`${triangles} triangles`);assert.ok(calls<=10,`${calls} draws`);
  assert.equal(r.lights.size,0);
  r.release(market);assert.equal(r.instances.size,0);
 } finally {r.dispose();}
});
