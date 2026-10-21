import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){
 if(s.startsWith('@/')) return next(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);
 if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);
 return next(s,c);
}});
const {BIOMES,WORLD_LENGTH,biomeAt}=await import('../src/lib/game/world.ts');
const {VOLCANO,volcanicLightAt,lavaPulse}=await import('../src/lib/game/volcano.ts');
const {HIDDEN_ITEMS}=await import('../src/lib/game/hidden-objects.ts');
const {roomAt}=await import('../src/lib/game/doors.ts');
const {JOURNEY_TARGET}=await import('../src/lib/config.ts');

test('the volcano follows the dunes without moving earlier lands or the final tavern',()=>{
 assert.equal(BIOMES.length,9);assert.equal(WORLD_LENGTH,30240);assert.equal(JOURNEY_TARGET,200);
 assert.deepEqual(BIOMES.slice(0,6).map(b=>[b.id,b.from,b.to]),[
  ['plaine',0,.11],['foret',.11,.24],['marais',.24,.37],['lac',.37,.49],['cascade',.49,.61],['montagne',.61,.73]
 ]);
 for(let i=1;i<BIOMES.length;i++)assert.equal(BIOMES[i-1].to,BIOMES[i].from);
 assert.equal(biomeAt(VOLCANO.from-1).id,'desert');assert.equal(biomeAt(VOLCANO.center).id,'volcan');
 assert.equal(biomeAt(VOLCANO.to+1).id,'taverne');assert.equal(roomAt(WORLD_LENGTH-80)?.id,'tavern');
});
test('incandescent light fades smoothly at both borders and repeats on later laps',()=>{
 for(const x of [-200,0,VOLCANO.from-1,VOLCANO.from,VOLCANO.to,VOLCANO.to+1,WORLD_LENGTH])assert.equal(volcanicLightAt(x),0);
 assert.equal(volcanicLightAt(VOLCANO.center),1);
 for(let x=VOLCANO.from-50;x<=VOLCANO.to+50;x+=2){
  const a=volcanicLightAt(x);assert.ok(a>=0&&a<=1);
  assert.ok(Math.abs(a-volcanicLightAt(x+1))<.006);
  assert.ok(Math.abs(a-volcanicLightAt(x+WORLD_LENGTH*4))<1e-10);
 }
 for(let time=0;time<90;time+=.02){
  assert.ok(lavaPulse(time)>=.65&&lavaPulse(time)<=.99);
  assert.ok(Math.abs(lavaPulse(time)-lavaPulse(time+.016))<.004);
  assert.equal(lavaPulse(time,true),.82);
 }
});
test('the forge hammer extends the saved collection while the old identifiers remain valid',()=>{
 for(const land of ['plaine','foret','marais','lac','cascade','montagne','desert','taverne'])assert.equal(HIDDEN_ITEMS.filter(i=>i.id===`hidden:0:${land}`).length,1);
 const hammer=HIDDEN_ITEMS.find(i=>i.id==='hidden:0:volcan');assert.match(hammer.art,/hammer.webp$/);
 assert.equal(biomeAt(hammer.x).id,'volcan');assert.equal(biomeAt(HIDDEN_ITEMS.find(i=>i.biome==='desert').x).id,'desert');
});
