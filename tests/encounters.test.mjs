import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { applyAction, fixedContext } = await import('../src/lib/game/reducer.ts');
const { MONSTER_KINDS, activeEncounter, captureChance } = await import('../src/lib/game/encounters.ts');
const { encounterBoxes } = await import('../src/lib/game/encounter-models.ts');
const { PLAYABLE_MINI_GAMES } = await import('../src/lib/game/mini-games.ts');
const { authorize, GroupError, validateAction } = await import('../src/lib/server/groups.ts');
const at = '2026-10-23T10:00:00.000Z';
const initial = () => ({ players: [{ id: 'mika', name: 'Mika', characterId: 'skater', joinedAt: at }], events: [], casts: [] });
const log = (s, id = `event-${s.events.length}`, kind = 'candidature') => applyAction(s, {type:'addEvent', playerId:'mika', kind}, fixedContext(id, at));
const move = (s, m, e = s.encounters.at(-1)) => applyAction(s, {type:'encounterMove', encounterId:e.id, turn:e.turn, move:m}, fixedContext('turn',at));
const wild = () => { let s = initial(); for (let i=0;i<3;i++) s=log(s).state; return s; };

test('one roadside halt per journey, a wild encounter every third journey, all seven species over a cycle', () => {
  let s = initial(); const kinds = [];
  for (let i=0;i<21;i++) {
    const a = log(s); s = a.state;
    if (i % 3 === 2) {
      const e=s.encounters.at(-1); kinds.push(e.monster);
      assert.equal(e.slot,i); assert.equal(a.result.offer,null); assert.equal(a.result.chestGame,null);
      assert.equal(s.miniGames.find(m=>m.eventId===e.eventId&&m.action!=='chest').result,'skipped');
      s=move(s,'leave').state;
    } else assert.equal(s.encounters?.filter(activeEncounter).length??0,0);
    if (a.result.chestGame) assert.equal(a.result.offer,null, 'a chest machine replaces the action halt');
  }
  assert.equal(new Set(kinds).size,7); assert.deepEqual([...kinds].sort(),[...MONSTER_KINDS].sort());
  assert.ok(!PLAYABLE_MINI_GAMES.some(g=>g.kind==='ghosting'));
});

test('a battle resumes after JSON reload; seeded turns reject duplicates, stale turns, invalid moves and forged victories', () => {
  let s=wild(), e=s.encounters[0];
  assert.equal(move(s,'capture').result.rejected,'challenge not accepted');
  s=move(s,'challenge').state; e=s.encounters[0];
  const a=move(s,'argue'), b=move(JSON.parse(JSON.stringify(s)),'argue');
  assert.deepEqual(a,b); assert.equal(a.state.encounters[0].hp,72);
  assert.equal(move(a.state,'argue',e).state,a.state);
  assert.equal(move(s,'win').result.rejected,'unknown move');
  assert.equal(move(s,'challenge').result.rejected,'already battling');
  assert.equal(a.state.events,s.events); assert.equal(a.state.casts,s.casts);
});

test('every monster is capturable with three arguments; capture is stored once without changing steps or loot', () => {
  for (const monster of MONSTER_KINDS) for (const rare of [false,true]) {
    let s=wild(); s={...s,encounters:s.encounters.map(e=>({...e,monster,rare}))};
    const events=JSON.stringify(s.events), casts=JSON.stringify(s.casts);
    s=move(s,'challenge').state;
    for (let i=0;i<3;i++) s=move(s,'argue').state;
    assert.equal(s.encounters[0].hp,16); assert.ok(s.encounters[0].energy>0);
    s=move(s,'capture').state;
    const e=s.encounters[0]; assert.equal(e.status,'captured'); assert.equal(e.capturedAt,at); assert.equal(e.balls,2);
    assert.equal(move(s,'capture').state,s);
    assert.equal(JSON.stringify(s.events),events); assert.equal(JSON.stringify(s.casts),casts);
    assert.equal(JSON.parse(JSON.stringify(s)).encounters[0].status,'captured');
  }
  assert.equal(captureChance(1),1); assert.ok(captureChance(40)>captureChance(100));
});

test('rest recovers energy and braces heavy attacks; a polite relaunch protects while weakening', () => {
  let s=move(wild(),'challenge').state;
  s=move(s,'argue').state; assert.equal(s.encounters[0].energy,86);
  s=move(s,'polite').state; assert.equal(s.encounters[0].hp,54); assert.equal(s.encounters[0].energy,75);
  s=move(s,'rest').state; assert.equal(s.encounters[0].energy,94);
  for (let i=0;i<100;i++) s=move(s,'argue').state;
  assert.equal(s.encounters[0].status,'lost'); assert.ok(s.encounters[0].hp>=1); assert.equal(s.encounters[0].energy,0);
});

test('undo and re-entry cannot reroll encounters, orphaned battles cannot capture, and removal cleans the collection', () => {
  let s=wild(), e=s.encounters[0];
  s=applyAction(s,{type:'undoLast',playerId:'mika'},fixedContext('undo',at)).state;
  assert.equal(move(s,'challenge',e).result.rejected,'unknown encounter');
  s=log(s,'replacement').state; assert.equal(s.encounters.length,1); assert.equal(s.encounters[0].id,e.id);
  const removed=applyAction(s,{type:'removePlayer',playerId:'mika'},fixedContext('remove',at)).state;
  assert.equal(removed.encounters.length,0);
});

test('leaving is always possible and exhausted balls end a battle without reducing journey progress', () => {
  const s=wild(); assert.equal(move(s,'leave').state.encounters[0].status,'fled');
  let exhausted=move(s,'challenge').state;
  exhausted={...exhausted,encounters:exhausted.encounters.map(e=>({...e,balls:0}))};
  assert.equal(move(exhausted,'capture').result.rejected,'no balls left');
  assert.equal(move(exhausted,'leave').state.encounters[0].status,'fled');
  assert.equal(move(s,'leave').state.events,s.events);
});

test('shared encounters require the owning device and the API only accepts the turn action', () => {
  const s=wild(), action={type:'encounterMove',encounterId:s.encounters[0].id,turn:0,move:'challenge'};
  assert.doesNotThrow(()=>authorize(s,validateAction(action),'mika'));
  for (const owner of [null,'lou']) assert.throws(()=>authorize(s,action,owner),e=>e instanceof GroupError&&e.status===403);
  assert.throws(()=>authorize(s,{...action,encounterId:'forged'},'mika'),e=>e.status===404);
  assert.throws(()=>validateAction({type:'captureMonster',monster:'ai'}),e=>e.status===400);
});

test('roadside and collection models share grounded, small, finite geometry for all species and games', () => {
  for (const model of [...MONSTER_KINDS,...PLAYABLE_MINI_GAMES.map(g=>g.kind),'ball']) for (const rare of [false,true]) {
    const boxes=encounterBoxes(model,rare); assert.ok(boxes.length>0&&boxes.length<80,model);
    for (const b of boxes) {
      assert.match(b.color,/^#[0-9a-f]{6}$/i);
      assert.ok([b.x,b.y,b.z,b.w,b.h,b.d].every(Number.isFinite));
      assert.ok(b.w>0&&b.h>0&&b.d>0&&b.y-b.h/2>=-.02,model);
    }
    assert.ok(Math.max(...boxes.map(b=>b.y+b.h/2))<4);
  }
});

test('group captures survive loading on another device and concurrent duplicate turns only settle once', async () => {
  const {createMemoryDb}=await import('../src/lib/server/db.ts');
  const {createGroup,applyGroupAction,loadSnapshot,claimPlayer,playerForToken}=await import('../src/lib/server/groups.ts');
  const db=createMemoryDb(),group=await createGroup(db,{name:'Dossiers classés',password:'chomageball'});
  const joined=await applyGroupAction(db,group,{type:'addPlayer',name:'Mika',characterId:'skater'},fixedContext('mika',at),null,'1234');
  let snapshot=joined;
  for(let i=0;i<3;i++)snapshot=await applyGroupAction(db,group,{type:'addEvent',playerId:'mika',kind:'candidature'},fixedContext(`event-${i}`,at),'mika');
  const send=async m=>{const e=snapshot.state.encounters[0];snapshot=await applyGroupAction(db,group,{type:'encounterMove',encounterId:e.id,turn:e.turn,move:m},fixedContext('turn',at),'mika');};
  await send('challenge');
  const e=snapshot.state.encounters[0],action={type:'encounterMove',encounterId:e.id,turn:e.turn,move:'argue'};
  const raced=await Promise.allSettled([applyGroupAction(db,group,action,fixedContext('a',at),'mika'),applyGroupAction(db,group,action,fixedContext('b',at),'mika')]);
  assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(raced.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
  snapshot=await loadSnapshot(db,group.id);assert.equal(snapshot.state.encounters[0].hp,72);
  await send('argue');await send('argue');await send('capture');
  const token=await claimPlayer(db,group,'mika','1234');
  assert.equal(await playerForToken(db,group.id,token),'mika');
  assert.equal(await playerForToken(db,group.id,joined.deviceToken),null);
  const restored=await loadSnapshot(db,group.id);
  assert.equal(restored.state.encounters[0].status,'captured');
  assert.equal(restored.state.events.length,3);
});
