import test from 'node:test';
import assert from 'node:assert/strict';
const {createLifeBody,walkAround,segmentDistance,launch,stepLife}=await import('../src/components/voxel/life.ts');

for(const dt of [1/120,1/30,.1])test(`a walking NPC circles an idle hero without crossing its body at ${1/dt} Hz`,()=>{
 const body=createLifeBody({x:-3,y:0,z:0},.7),hero={x:0,y:0,z:0},goal={x:3,y:0,z:0};let arc=0;
 for(let t=0;t<8;t+=dt){const old={...body.position};walkAround(body,goal,dt,[hero],1.1);assert.ok(segmentDistance(old,body.position,hero)>=1.1-1e-6,'swept motion stays outside the hero');arc=Math.max(arc,Math.abs(body.position.z));}
 assert.ok(arc>1);assert.ok(Math.hypot(body.position.x-goal.x,body.position.z)<.03,'resumes the original patrol destination');assert.equal(body.hits,0);assert.equal(body.mode,'walking');
});

test('targets inside the hero stop at its perimeter; overlap recovery is finite and keeps the walking bounds',()=>{
 const hero={x:0,y:0,z:0},body=createLifeBody({x:-3,y:0,z:0},.7);
 for(let i=0;i<200;i++)walkAround(body,hero,1/30,[hero],1.1);
 assert.ok(Math.hypot(body.position.x,body.position.z)>=1.1);assert.ok(Math.hypot(body.position.x,body.position.z)<1.11);
 body.position={...hero};walkAround(body,{x:3,y:0,z:0},.1,[hero],1.1,-.4,.4);
 assert.ok(Object.values(body.position).every(Number.isFinite));assert.ok(Math.hypot(body.position.x,body.position.z)>=1.1-1e-6);assert.ok(body.position.z>=-.4&&body.position.z<=.4);
});

test('several heroes block the swept path, while heroes on another floor do not divert the patrol',()=>{
 const blockers=[{x:0,y:0,z:0},{x:2,y:0,z:.2}],body=createLifeBody({x:-3,y:0,z:0},.7),goal={x:5,y:0,z:0};
 for(let i=0;i<400;i++){const old={...body.position};walkAround(body,goal,1/30,blockers,1.1);for(const hero of blockers)assert.ok(segmentDistance(old,body.position,hero)>=1.1-1e-6);}
 assert.ok(body.position.x>4.95);
 const upstairs=createLifeBody({x:-3,y:0,z:0},.7),free=createLifeBody(upstairs.home,.7);
 walkAround(upstairs,goal,.1,[{x:0,y:5,z:0}],1.1);walkAround(free,goal,.1,[],1.1);assert.deepEqual(upstairs.position,free.position);
});

test('a hero impact still launches before avoidance; flight, bounce and recovery are unchanged',()=>{
 const body=createLifeBody({x:0,y:0,z:0},.7);assert.ok(launch(body,12,0));const old=JSON.stringify(body);
 walkAround(body,{x:3,y:0,z:0},.1,[{x:0,y:0,z:0}],1.1);assert.equal(JSON.stringify(body),old,'steering never cancels a launch or moves an airborne body');
 let peak=0;for(let i=0;i<180;i++){stepLife(body,1/30,()=>0);peak=Math.max(peak,body.position.y);}
 assert.ok(peak>1.4);assert.equal(body.hits,1);assert.equal(body.mode,'walking');
});

test('a boundary-side hero is passed on the available side rather than through the wall',()=>{
 const body=createLifeBody({x:-3,y:0,z:3.8},.7),hero={x:0,y:0,z:3.8},goal={x:3,y:0,z:3.8};let lowest=3.8;
 for(let i=0;i<400;i++){const old={...body.position};walkAround(body,goal,1/30,[hero],1.1,-4.7,4.7);assert.ok(segmentDistance(old,body.position,hero)>=1.1-1e-6);assert.ok(body.position.z<=4.7&&body.position.z>=-4.7);lowest=Math.min(lowest,body.position.z);}
 assert.ok(lowest<2.8);assert.ok(body.position.x>2.95);
});

test('the NPC and hero footprints add up, including a larger avatar',()=>{
 const blockers=[{x:0,y:0,z:0,radius:1.1},{x:3,y:0,z:.3,radius:.5}],body=createLifeBody({x:-4,y:0,z:0},.7),goal={x:6,y:0,z:0},npcRadius=.6;
 for(let i=0;i<500;i++){const old={...body.position};walkAround(body,goal,1/30,blockers,npcRadius);for(const hero of blockers)assert.ok(segmentDistance(old,body.position,hero)>=npcRadius+hero.radius-1e-6);}
 assert.ok(body.position.x>5.95);
});

test('a landing between overlapping heroes escapes their union without oscillating',()=>{
 const blockers=[{x:-.5,y:0,z:0},{x:.5,y:0,z:0}],body=createLifeBody({x:0,y:0,z:0},.7);
 walkAround(body,{x:3,y:0,z:0},1/30,blockers,1.1,-.4,.4);
 for(const hero of blockers)assert.ok(Math.hypot(body.position.x-hero.x,body.position.z-hero.z)>=1.1);
 assert.ok(Object.values(body.position).every(Number.isFinite));assert.ok(Math.abs(body.position.z)<=.4);
});
