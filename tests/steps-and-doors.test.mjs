import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){return n(s.startsWith('@/')?new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);}});
const {standings,collectiveTotals,soleLeader}=await import('../src/lib/game/standings.ts');
const {journeySteps}=await import('../src/lib/game/scoring.ts');
const {nextDoor,roomAt,sameRoom}=await import('../src/lib/game/doors.ts');
const {WORLD_LENGTH}=await import('../src/lib/game/world.ts');
const players=[{id:'me'},{id:'lou'}];
const events=[
 {id:'a',playerId:'me',kind:'candidature',at:'2026-08-31T12:00:00Z'},
 {id:'b',playerId:'me',kind:'entretien',at:'2026-08-31T22:05:00Z'},
 {id:'c',playerId:'me',kind:'refus',journeyBonus:1,at:'2026-09-02T12:00:00Z'},
 {id:'d',playerId:'lou',kind:'refus',at:'2026-09-02T12:00:00Z'},
];
test('rankings replay saved journeys, bonus steps and the zero floor without a new currency',()=>{
 const rows=standings(events,players);
 assert.deepEqual(rows.map(r=>[r.playerId,r.steps]),[['me',4],['lou',3]]);
 for(const p of players)assert.equal(rows.find(r=>r.playerId===p.id).steps,journeySteps(events.filter(e=>e.playerId===p.id)));
 assert.equal(collectiveTotals(events).steps,7);
 assert.equal(soleLeader(rows).playerId,'me');
 const legacy=[{...events[0],journeyMultiplier:2}];
 assert.equal(standings(legacy,players)[0].steps,4);
});
test('a monthly ranking measures actual change across Zurich midnight, including undo and negative progress',()=>{
 assert.deepEqual(standings(events,players,'2026-09').map(r=>[r.playerId,r.steps]),[['lou',3],['me',2]]);
 assert.equal(standings(events,players,'2026-08')[0].steps,2);
 const undone=standings(events.slice(0,2),players,'2026-09');
 assert.equal(undone.find(r=>r.playerId==='me').steps,-2);
 assert.equal(soleLeader(undone),null);
 assert.equal(standings(events,players,'2026-10')[0].steps,0);
 assert.equal(soleLeader(standings([events[2],{...events[2],id:'e',playerId:'lou'}],players)),null);
});
test('doors split forward and reverse travel without skipping rooms, on any lap',()=>{
 for(const lap of [0,1,20])for(const direction of [1,-1]){
  const offset=lap*WORLD_LENGTH;let x=offset+(direction>0?500:7000),target=offset+(direction>0?7000:500);const crossed=[];
  for(let i=0;i<10;i++){const door=nextDoor(x,target);if(!door)break;crossed.push(Math.round((door.x-offset)*10)/10);x=door.x+direction*.1;assert.ok(sameRoom(roomAt(x),door.destination));}
  assert.deepEqual(crossed,direction>0?[1000,2663.2,4300,5963.2]:[5963.2,4300,2663.2,1000]);
  assert.equal(nextDoor(x,target),null);
 }
 assert.equal(nextDoor(1400,1450),null);
 assert.equal(nextDoor(1400,1400),null);
 assert.equal(sameRoom(roomAt(1400),roomAt(1400+WORLD_LENGTH)),false);
});
