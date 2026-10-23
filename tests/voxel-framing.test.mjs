import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {roadFrustum} from '../src/components/voxel/framing.ts';
test('the road stays at the usable screen centre through zoom and full orbit',()=>{
 for(const [width,height,top,bottom] of [[1440,960,80,160],[390,844,100,220],[1920,1080,70,140]])
 for(const zoom of [.45,1,2,3.5])for(const angle of [0,.62,Math.PI,4.7]){
  const c=new THREE.OrthographicCamera();Object.assign(c,roadFrustum(width,height,zoom,top,bottom));c.zoom=zoom;
  const road=new THREE.Vector3(505,17.3,2.3);c.position.set(road.x+Math.sin(angle)*28,road.y+25,road.z+Math.cos(angle)*28);c.lookAt(road);c.updateMatrixWorld();c.updateProjectionMatrix();
  const p=road.clone().project(c);assert.ok(Math.abs((p.x+1)*width/2-width/2)<1e-8);assert.ok(Math.abs((1-p.y)*height/2-(top+height-bottom)/2)<1e-8);
 }
});
test('telephoto perspective anchors the road at the same usable centre',async()=>{
 const{frameRoadPerspective,MINIATURE_CAMERA_DISTANCE}=await import('../src/components/voxel/framing.ts');
 for(const[w,h,top,bottom]of[[1440,960,80,160],[390,844,100,220]])for(const zoom of [.4,1,2,3.5])for(const a of [0,.62,Math.PI]){
  const c=new THREE.PerspectiveCamera(28,w/h,.1,250),road=new THREE.Vector3(505,17.3,2.3),d=MINIATURE_CAMERA_DISTANCE;frameRoadPerspective(c,w,h,zoom,top,bottom);
  c.position.set(road.x+Math.sin(a)*d*Math.cos(.74),road.y+Math.sin(.74)*d,road.z+Math.cos(a)*d*Math.cos(.74));c.lookAt(road);c.updateMatrixWorld();c.updateProjectionMatrix();const p=road.clone().project(c);
  assert.ok(Math.abs((p.x+1)*w/2-w/2)<1e-8);assert.ok(Math.abs((1-p.y)*h/2-(top+h-bottom)/2)<1e-8);
 }
});

test('free exploration freezes current framing, permits manual zoom and releases it on recenter',async()=>{
 const{ExplorationZoom}=await import('../src/components/voxel/framing.ts');const zoom=new ExplorationZoom();
 assert.equal(zoom.resolve(false,1,.8,.55),.55);
 for(const automatic of [.28,1,.72,.4])assert.equal(zoom.resolve(true,1,.8,automatic),.8);
 assert.equal(zoom.resolve(true,1.5,.8,.28),1.5*.8);
 assert.equal(zoom.resolve(false,1.5,1.2,.6),.6);
 assert.equal(zoom.resolve(true,1.5,.63,1),.63,'next exploration captures the new visible scale');
});
