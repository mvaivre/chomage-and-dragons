import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('@/'))return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url).href,context);
  return nextResolve(specifier,context);
}});
const {battlePlayback}=await import('../src/lib/game/battle-presentation.ts');
const {playEncounter}=await import('../src/lib/game/encounters.ts');
const before=(extra={})=>({id:'battle',eventId:'event',playerId:'me',monster:'ai',rare:false,slot:2,place:'Plaine',at:'2026-10-23T12:00:00Z',status:'battle',hp:100,energy:100,turn:1,balls:3,braced:false,message:'',...extra});
const turn=(e,move)=>{
  const s={players:[],events:[{id:'event',playerId:'me',kind:'candidature',at:e.at}],casts:[],encounters:[e]};
  const next=playEncounter(s,e.id,e.turn,move,e.at).encounter;
  return battlePlayback(e,next,move);
};
test('playback separates player damage from the later enemy hit without changing the saved result',()=>{
  for(const move of ['argue','polite']){
    const e=before(),original=structuredClone(e),p=turn(e,move);
    assert.equal(p.playerEnergy,100);assert.equal(p.playerDamage,move==='argue'?28:18);
    assert.equal(p.enemyDamage,move==='argue'?14:6);assert.equal(p.reply,true);
    assert.equal(p.after.energy,p.playerEnergy-p.enemyDamage);assert.deepEqual(e,original);
    assert.equal(p.enemyLine,'Remplacement intégral !');assert.ok(p.playerLine.length<45);
  }
});
test('rest shows its capped recovery before the protected incoming attack, including heavy attacks',()=>{
  for(const energy of [30,94,100]){
    const p=turn(before({energy,turn:2}),'rest');
    assert.equal(p.playerEnergy,Math.min(100,energy+30));assert.equal(p.recovered,Math.min(30,100-energy));
    assert.equal(p.heavy,true);assert.equal(p.enemyDamage,11);
  }
});
test('a successful capture never animates an enemy reply; a final knockout still does',()=>{
  const captured=turn(before({hp:16}),'capture');
  assert.equal(captured.after.status,'captured');assert.equal(captured.reply,false);assert.equal(captured.enemyDamage,0);
  const lost=turn(before({energy:1}),'argue');
  assert.equal(lost.after.status,'lost');assert.equal(lost.reply,true);assert.equal(lost.enemyDamage,1);
});
