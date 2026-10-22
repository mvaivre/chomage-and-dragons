import test from 'node:test';import assert from 'node:assert/strict';import{registerHooks}from'node:module';
registerHooks({resolve(s,c,n){if(s.startsWith('@/'))return n(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c);}});
const {continuationHeight,terrainHeight,routeHeight,BACKGROUND_DEPTH,FOREGROUND_DEPTH}=await import('../src/components/voxel/world.ts');
const {miniatureDefocus,MiniaturePass}=await import('../src/components/voxel/miniature.ts');
test('the continuation meets each terrain edge and slopes down smoothly instead of cutting a cliff',()=>{
 for(const x of [18.75,171.25,272.25,387.25,497.25,512.25])for(const side of [-1,1]){
  const edge=side<0?-BACKGROUND_DEPTH:FOREGROUND_DEPTH,inside=edge-side*.25;
  assert.ok(Math.abs(continuationHeight(x,edge)-terrainHeight(x,inside))<1e-8);
  assert.ok(Math.abs(continuationHeight(x,edge+side*18)-routeHeight(x)-.12)<1e-8);
  let previous=continuationHeight(x,edge),lastDelta=0;
  for(let d=.1;d<=18;d+=.1){const y=continuationHeight(x,edge+side*d),delta=y-previous;assert.ok(Math.abs(delta)<.4,'bounded slope');assert.ok(Math.abs(delta-lastDelta)<.03,'no sudden ledge');previous=y;lastDelta=delta;}
 }
});
test('miniature focus keeps the hero and inspected object sharp with bounded near/far blur',()=>{
 for(const focus of [12,38,76]){assert.equal(miniatureDefocus(focus,focus),0);assert.equal(miniatureDefocus(focus+2,focus),0);assert.equal(miniatureDefocus(focus-2,focus),0);assert.equal(miniatureDefocus(focus+16,focus),1);assert.equal(miniatureDefocus(focus-16,focus),1);assert.ok(miniatureDefocus(focus+6,focus)>0&&miniatureDefocus(focus+6,focus)<1);}
 const pass=new MiniaturePass();pass.setSize(1280,900);assert.equal(pass.blurSize.x,640);assert.equal(pass.blurSize.y,450);pass.setSize(1,1);assert.equal(pass.blurSize.x,1);assert.equal(pass.blurSize.y,1);pass.dispose();
});
