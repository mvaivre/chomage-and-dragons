import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('@/'))return next(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {BIOME_RESIDENTS}=await import('../src/lib/game/biome-residents.ts');
const {environmentSites,RESIDENTS,BACKGROUND_RESIDENTS}=await import('../src/lib/game/environment.ts');
const {BIOMES,WORLD_LENGTH}=await import('../src/lib/game/world.ts');

test('each resident species stays in one habitat across both planes and later laps',()=>{
 const habitats=new Map();
 for(const biome of BIOMES)for(const kind of [...RESIDENTS[biome.id],...BACKGROUND_RESIDENTS[biome.id]]){
  if(!habitats.has(kind))habitats.set(kind,new Set());habitats.get(kind).add(biome.id);
 }
 for(const[kind,homes]of habitats)assert.equal(homes.size,1,kind);
 const sites=[1,.76].flatMap(factor=>environmentSites(0,WORLD_LENGTH*3,factor));
 for(const site of sites)assert.ok(habitats.get(site.kind).has(site.biome));
 assert.equal(new Set(Object.values(BIOME_RESIDENTS).map(p=>p.biome)).size,8);
 for(const[kind,profile]of Object.entries(BIOME_RESIDENTS))for(let lap=0;lap<3;lap++){
  assert.ok(sites.some(s=>s.kind===kind&&s.biome===profile.biome&&s.factor===1&&Math.floor(s.x/WORLD_LENGTH)===lap),`${kind}, lap ${lap}`);
 }
});

test('forest trolls and snowy mountain yetis never cross habitats',()=>{
 assert.ok(RESIDENTS.foret.includes('troll'));
 assert.ok(RESIDENTS.montagne.includes('yeti'));
 const sites=[1,.76].flatMap(factor=>environmentSites(0,WORLD_LENGTH*3,factor));
 for(const[kind,biome]of [['troll','foret'],['yeti','montagne']]){
  const residents=sites.filter(site=>site.kind===kind);
  for(let lap=0;lap<3;lap++)assert.ok(residents.some(site=>Math.floor(site.x/WORLD_LENGTH)===lap),`${kind}, lap ${lap}`);
  assert.ok(residents.every(site=>site.biome===biome),`${kind} stays in ${biome}`);
 }
});
