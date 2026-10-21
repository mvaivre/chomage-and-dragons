import test from 'node:test';
import assert from 'node:assert/strict';
import {TEAR_STREAMS,TEARS_POOL,tearPoint} from '../src/lib/game/tears.ts';

test('the waterfalls keep their outlets and land inside the carved basin throughout the animation',()=>{
 for(let i=0;i<TEAR_STREAMS.length;i++)for(const seconds of [0,.25,1,7,100]){
  const start=tearPoint(i,0,seconds),end=tearPoint(i,1,seconds);
  assert.deepEqual([start.x,start.y],TEAR_STREAMS[i].start);
  assert.deepEqual([end.x,end.y],TEAR_STREAMS[i].end);
  assert.ok(end.x-end.width/2>TEARS_POOL.x-TEARS_POOL.rx);
  assert.ok(end.x+end.width/2<TEARS_POOL.x+TEARS_POOL.rx);
  assert.ok(Math.abs(end.y-TEARS_POOL.y)<TEARS_POOL.ry);
  let previous=start.y;
  for(let step=1;step<=100;step++){
   const p=tearPoint(i,step/100,seconds);
   assert.ok(p.y>previous,'water keeps falling');previous=p.y;
   assert.ok(p.x-p.width/2>0&&p.x+p.width/2<1024);
  }
 }
});
test('water moves inside each veil while the stone attachments stay fixed',()=>{
 for(let i=0;i<TEAR_STREAMS.length;i++){
  assert.notEqual(tearPoint(i,.5,0).x,tearPoint(i,.5,1).x);
  assert.deepEqual(tearPoint(i,-1),tearPoint(i,0));
  assert.deepEqual(tearPoint(i,2),tearPoint(i,1));
 }
});
