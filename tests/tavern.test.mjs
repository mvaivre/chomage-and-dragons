import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return n(s.startsWith('@/')?new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);}});
const {WORLD_LENGTH}=await import('../src/lib/game/world.ts');
const {interiorAt,interiorsInRange}=await import('../src/lib/game/decor.ts');
const {nextDoor,inRoom}=await import('../src/lib/game/doors.ts');
const {hiredPosition}=await import('../src/lib/game/progress.ts');
const {tavernMoonwalk}=await import('../src/lib/game/tavern.ts');

test('the final tavern contains every hired lane and keeps one identity across lap zero',()=>{
 for(const steps of [0,99,200,201,400,990]){
  const finish=hiredPosition(steps)*WORLD_LENGTH;
  const room=interiorAt(finish);
  assert.equal(room.id,'tavern');
  for(const lane of [-80,-40,0,40,80])assert.ok(inRoom(finish+lane,room));
  assert.equal(interiorAt(finish-1),interiorAt(finish+1));
  assert.equal(interiorsInRange(finish-200,finish+200).filter(r=>r.id==='tavern').length,1);
  assert.equal(nextDoor(finish-50,finish+50),null,'no phantom door at the loop boundary');
  assert.equal(nextDoor(finish+50,finish-50),null);
 }
});
test('the tavern has two real door crossings in either direction on later laps',()=>{
 for(const lap of [0,1,19]){
  const room=interiorAt((lap+1)*WORLD_LENGTH),start=room.from-10,end=room.to+10;
  for(const direction of [1,-1]){
   const from=direction>0?start:end,to=direction>0?end:start;
   const first=nextDoor(from,to);
   assert.equal(first.destination.from,room.from);
   const second=nextDoor(first.x+direction*.1,to);
   assert.equal(second.destination,null);
   assert.equal(nextDoor(second.x+direction*.1,to),null);
  }
 }
});
test('the pigeon faces against its glide, pauses before turning and freezes for reduced motion',()=>{
 const frames=new Set();
 for(let t=0;t<32;t+=.05){
  const pose=tavernMoonwalk(t),next=tavernMoonwalk(t+.001),speed=next.offset-pose.offset;
  if(Math.abs(speed)>.001)assert.equal(Math.sign(speed),-pose.facing);
  frames.add(pose.frame);
  assert.ok(Math.abs(pose.offset)<=42.001);
  assert.deepEqual(tavernMoonwalk(t,true),{offset:0,facing:1,frame:0});
 }
 assert.equal(frames.size,4);
 assert.equal(tavernMoonwalk(7.99).offset,tavernMoonwalk(8).offset);
 assert.equal(tavernMoonwalk(15.99).offset,tavernMoonwalk(16).offset);
});
