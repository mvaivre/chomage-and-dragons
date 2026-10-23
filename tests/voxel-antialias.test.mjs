import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
registerHooks({resolve(s,c,n){if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c);}});
const {ScenePass,sceneSamples}=await import('../src/components/voxel/scene-pass.ts');
const {MiniaturePass}=await import('../src/components/voxel/miniature.ts');
const renderer=(color,depth)=>({getContext:()=>({RENDERBUFFER:1,RGBA16F:2,DEPTH24_STENCIL8:3,SAMPLES:4,getInternalformatParameter:(_,format)=>new Int32Array(format===2?color:depth)})});

test('source MSAA selects a common HDR/depth format within four samples and tolerates unsupported hardware',()=>{
 assert.equal(sceneSamples(renderer([8,4,2],[8,4,2])),4);
 assert.equal(sceneSamples(renderer([8,4,2],[8,2])),2);
 assert.equal(sceneSamples(renderer([],[4])),0);
 assert.equal(sceneSamples(renderer([4],[2])),0);
 assert.equal(sceneSamples({getContext:()=>({})}),0);
});

test('the source keeps MSAA on one HDR target and shrinks/releases its resources',()=>{
 const focus=new MiniaturePass(),pass=new ScenePass(new THREE.Scene(),new THREE.PerspectiveCamera(),focus,4);
 assert.equal(pass.target.samples,4);assert.equal(pass.target.depthTexture.format,THREE.DepthStencilFormat);
 assert.equal(pass.target.resolveDepthBuffer,true);assert.equal(pass.target.resolveStencilBuffer,false);
 focus.setResolutionScale(.25);pass.setSize(390,844);assert.deepEqual(focus.blurSize.toArray(),[98,211]);
 // Release the old framebuffer and shrink the focus buffers on the low profile.
 let released=0;pass.target.addEventListener('dispose',()=>released++);pass.setSize(1,1);
 assert.equal(released,1);assert.deepEqual(focus.blurSize.toArray(),[1,1]);
 let focusReleased=0;const dispose=focus.dispose.bind(focus);focus.dispose=()=>{focusReleased++;dispose();};
 pass.dispose();assert.equal(released,2);assert.equal(focusReleased,1);
});
