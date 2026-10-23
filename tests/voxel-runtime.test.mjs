import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
registerHooks({resolve(s,c,n){if(s.startsWith('@/'))return n(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c);}});
const{FramePacer}=await import('../src/components/voxel/frame-pacer.ts');
const{SceneObjects}=await import('../src/components/voxel/scene-objects.ts');
const{LocalLightPool}=await import('../src/components/voxel/lighting.ts');
const{ContactShadows}=await import('../src/components/voxel/contact-shadows.ts');
test('pacing keeps 60/30 FPS budgets on 60, 90, 120 and 144 Hz displays without catch-up bursts',()=>{
 for(const hz of [60,90,120,144])for(const fps of [30,60]){
  const p=new FramePacer();let frames=0;for(let i=0;i<hz*4;i++)if(p.ready(i*1000/hz,1000/fps))frames++;
  assert.ok(Math.abs(frames-fps*4)<=1,`${hz} Hz / ${fps} FPS: ${frames}`);
  assert.equal(p.ready(20000,1000/fps),true);assert.equal(p.ready(20001,1000/fps),false);
  p.reset();assert.equal(p.ready(20002,1000/fps),true);
 }
});
test('interaction discovery invalidates on additions, replacements and removals, not repeated lookups',()=>{
 const objects=new SceneObjects(),a=new THREE.Group(),b=new THREE.Group();assert.equal(objects.revision,0);
 objects.set('house',a);objects.set('house',a);assert.equal(objects.revision,1);objects.get('house');assert.equal(objects.revision,1);
 objects.set('house',b);assert.equal(objects.revision,2);objects.delete('absent');assert.equal(objects.revision,2);objects.delete('house');assert.equal(objects.revision,3);
});
test('nearest-light selection matches a full sort with unsorted sources, moving parents and changing budgets',()=>{
 const world=new THREE.Scene(),outside=new THREE.Group(),hidden=new THREE.Group();world.add(outside,hidden);hidden.visible=false;outside.position.set(7,2,-3);
 const pool=new LocalLightPool(world,4),sources=Array.from({length:37},(_,i)=>{const l=new THREE.PointLight(i+1,i+1,6);l.position.set(Math.sin(i*3)*40,0,Math.cos(i*7)*40);(i%7===0?hidden:outside).add(l);return l;});
 for(const budget of [4,2,0,3,4])for(const x of [0,10,-15]){
  const focus=new THREE.Vector3(x,0,0);outside.rotation.y+=.2;world.updateMatrixWorld(true);
  const expected=sources.filter(l=>l.parent.visible).map(l=>({l,d:l.getWorldPosition(new THREE.Vector3()).distanceToSquared(focus)})).filter(p=>p.d<=900).sort((a,b)=>a.d-b.d).slice(0,budget);
  pool.update(sources,focus,budget,true);assert.equal(pool.active,expected.length);assert.deepEqual(pool.lights.map(l=>l.intensity),Array.from({length:4},(_,i)=>expected[i]?.l.intensity??0));
  expected.forEach((e,i)=>assert.ok(pool.lights[i].position.distanceTo(e.l.getWorldPosition(new THREE.Vector3()))<1e-8));
 }
});
test('contact shadow buffers upload only changed instances and keep static fractional positions stable',()=>{
 const shadows=new ContactShadows(new THREE.Scene(),new THREE.Vector2(),8),a={x:.13,y:1/3,z:-1.7,rx:.38,rz:.17,opacity:.73};
 shadows.begin(true);for(let i=0;i<8;i++)shadows.add({...a,x:a.x+i});shadows.finish();
 const matrix=shadows.mesh.instanceMatrix,shade=shadows.mesh.geometry.attributes.contactOpacity,mv=matrix.version,sv=shade.version;
 shadows.begin(true);for(let i=0;i<8;i++)shadows.add({...a,x:a.x+i});shadows.finish();assert.equal(matrix.version,mv);assert.equal(shade.version,sv);
 shadows.begin(true);for(let i=0;i<8;i++)shadows.add({...a,x:a.x+i+(i===2?1:0),opacity:i===4?.5:a.opacity});shadows.finish();
 assert.equal(matrix.version,mv+1);assert.equal(shade.version,sv+1);assert.deepEqual(matrix.updateRanges,[{start:32,count:16}]);assert.deepEqual(shade.updateRanges,[{start:4,count:1}]);
 shadows.dispose();
});
