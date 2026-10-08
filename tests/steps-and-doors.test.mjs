import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){return n(s.startsWith('@/')?new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);}});
const {standings,collectiveTotals,soleLeader,monthlyStandings,crownOf}=await import('../src/lib/game/standings.ts');
const {journeySteps}=await import('../src/lib/game/scoring.ts');
const {nextDoor,roomAt,sameRoom,inRoom}=await import('../src/lib/game/doors.ts');
const {WORLD_LENGTH}=await import('../src/lib/game/world.ts');
const {seasonMonthKeys}=await import('../src/lib/game/calendar.ts');
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
  assert.deepEqual(crossed,direction>0?[1600,3263.2,4300,5963.2]:[5963.2,4300,3263.2,1600]);
  assert.equal(nextDoor(x,target),null);
 }
 assert.equal(nextDoor(1800,1850),null);
 assert.equal(nextDoor(1800,1800),null);
 assert.equal(sameRoom(roomAt(1800),roomAt(1800+WORLD_LENGTH)),false);
});
test('the per-frame room test agrees with room locations on every lap, outdoors included',()=>{
 for(const x of [-5,0,1599.9,1600,2500,3263.2,3263.3,4300,5000,5963.2,9000,1600+WORLD_LENGTH,2500+3*WORLD_LENGTH]){
  for(const room of [null,roomAt(2500),roomAt(5000),roomAt(2500+WORLD_LENGTH)])assert.equal(inRoom(x,room),sameRoom(roomAt(x),room),`${x}`);
 }
});
test('months follow the order of play: a late clock never credits a month with steps the journey lost',()=>{
 const late=[{id:'a',playerId:'me',kind:'candidature',at:'2026-09-30T22:01:00Z'},{id:'b',playerId:'me',kind:'entretien',at:'2026-09-30T21:58:00Z'}];
 assert.equal(standings(late,players)[0].steps,0);
 assert.equal(standings(late,players,'2026-09').find(r=>r.playerId==='me').steps,0);
 assert.equal(standings(late,players,'2026-10').find(r=>r.playerId==='me').steps,0,'the interview stays in October with the application before it');
 const months=['2026-08','2026-09','2026-10'],all=monthlyStandings(events,players,months);
 for(const month of months)assert.deepEqual(all.get(month),standings(events,players,month),month);
});
test('a crown needs a sole leader ahead; an empty month is not a tie',()=>{
 assert.deepEqual(crownOf([{playerId:'me',steps:0},{playerId:'lou',steps:0}]),{playerId:null,steps:0,tied:false});
 assert.deepEqual(crownOf([{playerId:'me',steps:-2},{playerId:'lou',steps:-2}]),{playerId:null,steps:-2,tied:false});
 assert.deepEqual(crownOf([{playerId:'me',steps:4},{playerId:'lou',steps:4}]),{playerId:null,steps:4,tied:true});
 assert.deepEqual(crownOf([{playerId:'me',steps:5},{playerId:'lou',steps:4}]),{playerId:'me',steps:5,tied:false});
 assert.deepEqual(crownOf([]),{playerId:null,steps:0,tied:false});
});
test('the palmarès lists Zurich months from January, the current one from its first day',()=>{
 assert.deepEqual(seasonMonthKeys('2026-10'),['2026-10','2026-09','2026-08','2026-07','2026-06','2026-05','2026-04','2026-03','2026-02','2026-01']);
 assert.deepEqual(seasonMonthKeys('2026-01'),['2026-01']);
 assert.equal(seasonMonthKeys('2027-03').length,12,'the season ends with December');
 assert.deepEqual(seasonMonthKeys('2025-12'),[]);
});
