import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {access} from 'node:fs/promises';
registerHooks({resolve(s,c,n){return n(s.startsWith('@/')?new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);}});
const {HIDDEN_ITEMS,hiddenItemForId,hiddenItemsInRange}=await import('../src/lib/game/hidden-objects.ts');
const {BIOMES,WORLD_LENGTH,biomeAt,surfaceAt}=await import('../src/lib/game/world.ts');
const {interiorAt}=await import('../src/lib/game/decor.ts');
const {PUNCHLINES,punchlineFor,residentPunchline}=await import('../src/lib/game/punchlines.ts');

test('the finite hidden collection has one small, grounded, accessible prop per biome',async()=>{
 assert.equal(HIDDEN_ITEMS.length,BIOMES.length);
 assert.equal(new Set(HIDDEN_ITEMS.map(item=>item.id)).size,HIDDEN_ITEMS.length);
 for(const item of HIDDEN_ITEMS){
  assert.equal(biomeAt(item.x).id,item.biome);
  assert.ok(item.size>=44&&item.size<=54);
  assert.equal(item.y,surfaceAt(item.x)-2);
  for(const offset of [-150,0,150])assert.equal(interiorAt(item.x+offset),undefined);
  assert.equal(hiddenItemForId(item.id),item);
  await access(new URL(`../public${item.art}`,import.meta.url));
 }
 assert.equal(hiddenItemForId('hidden:1:plaine'),null);
 assert.deepEqual(hiddenItemsInRange(-200,WORLD_LENGTH+200),HIDDEN_ITEMS);
 assert.deepEqual(hiddenItemsInRange(700,1000),[HIDDEN_ITEMS[0]]);
});

test('the roast bank is stable between devices and residents cycle without repeats',()=>{
 assert.equal(PUNCHLINES.length,24);
 assert.equal(new Set(PUNCHLINES).size,24);
 assert.equal(punchlineFor('same-attempt'),punchlineFor('same-attempt'));
 assert.ok(new Set(Array.from({length:200},(_,i)=>punchlineFor(`attempt-${i}`))).size>20);
 assert.equal(new Set(Array.from({length:24},(_,i)=>residentPunchline('troll',i))).size,24);
 assert.equal(residentPunchline('troll',-1),residentPunchline('troll',0));
});
