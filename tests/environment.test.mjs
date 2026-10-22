import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s,c,next) {
 if(s.startsWith('@/')) return next(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);
 if(c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`,c);
 return next(s,c);
}});
const {canExploreTarget,environmentSites,environmentLine,ENVIRONMENT_LABELS}=await import('../src/lib/game/environment.ts');
const {BIOMES,WORLD_LENGTH}=await import('../src/lib/game/world.ts');
const {roomAt}=await import('../src/lib/game/doors.ts');

test('visible characters are interactive while exploring, only a paused scene blocks conversation',()=>{
 assert.equal(canExploreTarget(true,false),true);
 assert.equal(canExploreTarget(false,false),false);
 assert.equal(canExploreTarget(true,true),false);
 assert.equal(canExploreTarget(false,true),false);
});
test('residents keep their habitats on successive laps and leave the volcanic caldera empty',()=>{
 for(const factor of [1,0.76]){
 const sites=environmentSites(0,WORLD_LENGTH*3,factor);
 assert.equal(new Set(sites.map(s=>s.id)).size,sites.length);
 assert.ok(sites.every(s=>s.biome!=='volcan'));
 for(const biome of BIOMES.filter(b=>b.id!=='volcan')) for(let lap=0;lap<3;lap++) assert.ok(sites.some(s=>s.biome===biome.id && Math.floor(s.x/WORLD_LENGTH)===lap),`${biome.id}, lap ${lap}, factor ${factor}`);
 for(const site of sites){ for(const offset of [-210,0,210]) assert.equal(roomAt(site.x+offset),null);assert.ok(ENVIRONMENT_LABELS[site.kind]); }
 const left=6500,right=14000;
 assert.deepEqual(environmentSites(left,right,factor),sites.filter(s=>s.x>=left && s.x<=right));
 }
});
test('walking trolls leave space for forest trunks and their clickable inhabitants',()=>{
 const forest=BIOMES.find(b=>b.id==='foret');
 for(const site of environmentSites(0,WORLD_LENGTH,1).filter(s=>s.biome==='foret')){
 for(let tree=forest.from*WORLD_LENGTH+120;tree<forest.to*WORLD_LENGTH-280;tree+=390) assert.ok(Math.abs(tree-site.x)>=190);
 }
});
test('resident dialogue is short, cycles and is safe before the first visit',()=>{
 for(const kind of Object.keys(ENVIRONMENT_LABELS)){
 assert.equal(environmentLine(kind,-1),environmentLine(kind,0));
 const lines=Array.from({length:12},(_,visit)=>environmentLine(kind,visit));
 assert.ok(new Set(lines).size>=3);assert.ok(lines.every(line=>line.length<=72));
 }
});

const {trollPatrol,trollWalkFrame}=await import('../src/lib/game/troll-motion.ts');
test('troll patrol stops at either end, turns without teleporting and repeats smoothly',()=>{
 for(let t=0;t<40;t+=.05){
  const a=trollPatrol(t),b=trollPatrol(t+.01);
  assert.ok(a.offset>=-60 && a.offset<=60);
  assert.ok(Math.abs(a.offset-b.offset)<.3);
  const repeated=trollPatrol(t+20);assert.ok(Math.abs(repeated.offset-a.offset)<1e-8);assert.equal(repeated.direction,a.direction);
  assert.ok([0,1,2,3].includes(trollWalkFrame(a.distance)));
 }
 for(const [time,offset,direction] of [[8,60,1],[18,-60,-1]]){
  const p=trollPatrol(time);assert.equal(p.moving,false);assert.equal(p.offset,offset);assert.equal(p.direction,direction);
 }
 for(const time of [0,7,10,17,20]){
  assert.ok(Math.abs(trollPatrol(time+.01).offset-trollPatrol(time-.01).offset)<.001);
 }
 assert.deepEqual([0,10,20,30,40].map(trollWalkFrame),[0,1,2,3,0]);
});
