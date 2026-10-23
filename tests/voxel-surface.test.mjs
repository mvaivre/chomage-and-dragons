import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks}from'node:module';
registerHooks({resolve(s,c,n){if(s.startsWith('@/'))return n(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c);}});
const {VoxelResources}=await import('../src/components/voxel/resources.ts');
const {makeChunk}=await import('../src/components/voxel/chunks.ts');
test('both sides of the detailed terrain boundary use the same world-space grain and distinguish water',()=>{
 const r=new VoxelResources(true,4),c=makeChunk(31,0,r),apron=c.getObjectByName('fogged-ground-continuation'),ground=c.children.find(o=>o.isMesh&&!o.isInstancedMesh&&o!==apron);
 assert.equal(ground.material,apron.material);
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <color_fragment>\n#include <fog_fragment>'};ground.material.onBeforeCompile(shader,{});
 assert.match(shader.fragmentShader,/voxelGroundGrain/);assert.match(shader.vertexShader,/terrainSurface/);
 for(const mesh of [ground,apron])assert.equal(mesh.geometry.attributes.terrainSurface.count,mesh.geometry.attributes.position.count);
 c.userData.dispose();r.dispose();
});
test('river foam remains thin when its animation rewrites instance transforms',async()=>{
 const T=await import('three'),{riverBridge}=await import('../src/components/voxel/bridges.ts'),{riverSites}=await import('../src/components/voxel/world.ts'),r=new VoxelResources(),bridge=riverBridge(r,riverSites(0)[0]);
 const flow=bridge.children.find(o=>o.isGroup&&o.children.some(c=>c.isInstancedMesh&&c.count===16)),mesh=flow.children[0],m=new T.Matrix4(),s=new T.Vector3();
 for(const time of [0,1,12,100]){bridge.userData.animate(time);for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);s.setFromMatrixScale(m);assert.ok(s.y<.03&&s.z<.1,'foam is a flat glint, not a unit cube');}}
 r.release(bridge);r.dispose();
});
test('ground detail crosses both old cuts gradually and lands on the actual shoulder triangles',async()=>{
 const T=await import('three'),{groundCoverFade}=await import('../src/components/voxel/shoulder-cover.ts'),{BACKGROUND_DEPTH,FOREGROUND_DEPTH}=await import('../src/components/voxel/world.ts');
 for(const side of [-1,1]){const edge=side<0?-BACKGROUND_DEPTH:FOREGROUND_DEPTH;assert.ok(groundCoverFade(edge+side*.01)>.3);assert.ok(Math.abs(groundCoverFade(edge+side*.01)-groundCoverFade(edge-side*.01))<.01);assert.equal(groundCoverFade(edge+side*10),0);}
 const r=new VoxelResources(true,4),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
 for(const cx of [1,8,12,17,21,25,28,31,34]){
  const c=makeChunk(cx,0,r),apron=c.getObjectByName('fogged-ground-continuation');c.updateMatrixWorld(true);const positions=c.userData.shoulderCover;assert.ok(positions.length>10);
  for(let i=0;i<positions.length;i+=7){const[x,y,z]=positions[i];ray.set(new T.Vector3(x,y+100,z),down);const hit=ray.intersectObject(apron)[0];assert.ok(hit,`${cx}: ground under detail`);assert.ok(Math.abs(hit.point.y-y)<.00005,`${cx}: no floating or buried detail`);}
  c.userData.dispose();
 }
 assert.equal(r.instances.size,0);r.dispose();
});
