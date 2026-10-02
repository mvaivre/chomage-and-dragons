import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s,c,n) {return n(s.startsWith('@/')?new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);} });
const { DECOR_TEXTS, DECOR_SPACING, INTERIORS, TRANSITION_CLEARANCE, INTERIOR_CLEARANCE, decorForLap, groupDecor, personaliseDecor, interiorAt } = await import('../src/lib/game/decor.ts');
const { BIOMES, WORLD_LENGTH } = await import('../src/lib/game/world.ts');

test('every catalogue gag is unique and fits in eight words',()=>{
  const texts=Object.values(DECOR_TEXTS).flat();
  assert.ok(DECOR_TEXTS.refusal.length>=80);
  assert.equal(new Set(texts).size,texts.length);
  for(const text of texts) assert.ok(text.split(/\s+/).length<=8, text);
});

test('whole laps are repeatable, spaced, and avoid buildings and transition silhouettes',()=>{
  for(let lap=0;lap<100;lap++) {
    const sites=decorForLap(lap);
    assert.deepEqual(sites,JSON.parse(JSON.stringify(decorForLap(lap))));
    assert.ok(sites.length>=40&&sites.length<=60,`lap ${lap}: ${sites.length}`);
    for(const [i,s] of sites.entries()) {
      if(i) assert.ok(s.x-sites[i-1].x>=DECOR_SPACING);
      const x=s.x-lap*WORLD_LENGTH;
      for(const b of BIOMES.slice(0,-1)) assert.ok(Math.abs(x-b.to*WORLD_LENGTH)>=TRANSITION_CLEARANCE);
      for(const r of INTERIORS) assert.ok(x<r.from-INTERIOR_CLEARANCE||x>r.to+INTERIOR_CLEARANCE);
    }
    assert.ok(decorForLap(lap+1)[0].x-sites.at(-1).x>=DECOR_SPACING,'also across the loop');
  }
  assert.notDeepEqual(decorForLap(0).map(s=>s.text),decorForLap(1).map(s=>s.text));
});

test('interiors repeat for every traveller, for eleven steps within their original land',()=>{
  for(const room of INTERIORS) for(const lap of [0,1,20]) {
    assert.equal(interiorAt(room.from+lap*WORLD_LENGTH)?.id,room.id);
    assert.equal(interiorAt(room.to+lap*WORLD_LENGTH)?.id,room.id);
    assert.equal(interiorAt(room.from+lap*WORLD_LENGTH-1),undefined);
    const steps=(room.to-room.from)/WORLD_LENGTH*200;
    assert.ok(steps>=10&&steps<=15);
  }
});

test('group signs honour the journal, crowns, daily runs and all hired companions',()=>{
  const players=[{id:'lou',name:'Lou Dupont',characterId:'barde'},{id:'mika',name:'Mika',characterId:'skater',hiredAt:'2026-09-15'}];
  const events=Array.from({length:10},(_,i)=>({id:`refusal-${i}`,playerId:'lou',kind:'refus',at:`2026-09-${String(i+1).padStart(2,'0')}T12:00:00Z`}));
  const group={players,events,daily:[{id:'d',day:'2026-09-25',playerId:'mika',kind:'pigeon',score:99,at:'2026-09-25T12:00:00Z'}],day:'2026-09-25',month:'2026-09'};
  const result=groupDecor(group);
  assert.equal(result.graves.length,8);
  assert.equal(result.graves[0].eventId,'refusal-9');
  assert.match(result.crown.text,/Lou/);
  assert.equal(result.crown.characterId,'barde');
  assert.match(result.daily,/Mika/);
  assert.match(result.hired[0],/Mika.*Engagé·e/);
  assert.deepEqual(result,groupDecor({...group,players:[...players].reverse(),events:[...events].reverse()}));
  const sites=decorForLap(0), decorated=personaliseDecor(sites,result);
  assert.deepEqual(decorated.map(s=>s.x),sites.map(s=>s.x));
  assert.equal(decorated.filter(s=>s.kind==='grave').length,8);
  for(const s of decorated) assert.ok(s.text.split(/\s+/).length<=8,s.text);
  const undone=groupDecor({...group,events:[]});
  assert.equal(undone.graves.length,0);
  assert.equal(undone.crown.characterId,undefined);
  assert.match(groupDecor({...group,daily:[{...group.daily[0],pending:true}]}).daily,/attend/);
  const largeGroup = groupDecor({...group, players:Array.from({length:15},(_,i)=>({id:`p${i}`,name:`Ami${i}`,characterId:'barde',hiredAt:'2026-09-15'}))});
  const board = personaliseDecor(sites,largeGroup).filter(s=>s.kind==='hired').map(s=>s.text).join(' · ');
  for(let i=0;i<15;i++) assert.ok(board.split(' · ').includes(`Ami${i}`));
});

test('one illustrated scene in each land, with room for its road-bound silhouette',()=>{
 for(let lap=0;lap<30;lap++) {
  const sites=decorForLap(lap).filter(s=>s.setpiece);
  assert.equal(sites.length,8);
  assert.equal(new Set(sites.map(s=>s.biome)).size,8);
  for(const site of sites)for(const offset of [-330,0,330])assert.equal(interiorAt(site.x+offset),undefined);
 }
});

test('ambient events are rare and keep the same trajectory across viewport sizes',async()=>{
 const {decorEventAt}=await import('../src/lib/game/decor-events.ts');
 for(const x of [200,5800,40000]) {
  let active=0;
  for(let time=0;time<900;time++) {
   const event=decorEventAt(x,time);assert.deepEqual(event,decorEventAt(x+1,time));
   if(event.active)active++;
  }
  assert.equal(active,90);
 }
});
