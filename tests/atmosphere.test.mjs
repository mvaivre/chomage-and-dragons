import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`,c);return next(s,c);}});
const {atmosphereAt,atmosphereBudget,atmosphereSample,canopyOffset,windAt}=await import('../src/lib/game/atmosphere.ts');
const {BIOMES,WORLD_LENGTH}=await import('../src/lib/game/world.ts');

test('atmosphere fades continuously at biome edges and repeats on every lap',()=>{
 assert.deepEqual(atmosphereAt(-850),atmosphereAt(0));
 for(const biome of BIOMES){
  const from=biome.from*WORLD_LENGTH,to=biome.to*WORLD_LENGTH;
  for(const edge of [from,to]){
   for(const key of ['fog','rays','shade']) assert.ok(Math.abs(atmosphereAt(edge-.01)[key]-atmosphereAt(edge+.01)[key])<.001);
  }
  const middle=(from+to)/2;
  assert.deepEqual(atmosphereAt(middle),atmosphereAt(middle+WORLD_LENGTH));
  for(let x=from;x<to;x+=97) for(const key of ['fog','rays','shade']) assert.ok(atmosphereAt(x)[key]>=0 && atmosphereAt(x)[key]<=1);
 }
});

test('canopy wind never moves the painted trunk, sign region or roots',()=>{
 for(const time of [0,1,7,28,53]) for(const wake of [-1,0,1]){
  for(let u=0;u<=1;u+=.1) for(const v of [.6,.7,.85,1]) assert.deepEqual(canopyOffset(u,v,time,6650,wake),{x:0,y:0});
  for(const v of [0,.1,.3,.5]) assert.deepEqual(canopyOffset(.65,v,time,6650,wake),{x:0,y:0});
 }
 assert.ok(Math.abs(canopyOffset(.1,.2,7,6650).x)>.1);
});

test('wind and branches remain bounded and move without wraparound jumps',()=>{
 for(let t=0;t<120;t+=.07){
  assert.ok(Math.abs(windAt(t,6650))<=1);
  assert.ok(Math.abs(windAt(t+.01,6650)-windAt(t,6650))<.01);
  const a=canopyOffset(.2,.2,t,6650),b=canopyOffset(.2,.2,t+.01,6650);
  assert.ok(Math.abs(a.x)<=14 && Math.abs(a.y)<=2);
  assert.ok(Math.abs(a.x-b.x)<.1 && Math.abs(a.y-b.y)<.1);
 }
});

test('mobile and software renderers bound optional effects independently of viewport height',()=>{
 const mobile=atmosphereBudget(390,false),desktop=atmosphereBudget(1920,false),software=atmosphereBudget(1920,true);
 for(const key of Object.keys(desktop)) assert.ok(mobile[key]<=desktop[key]);
 assert.equal(software.rays,0);assert.equal(software.patches,0);assert.equal(software.nearFog,0);
 assert.ok(Object.values(mobile).reduce((a,b)=>a+b,0)<=11);
 assert.ok(Object.values(desktop).reduce((a,b)=>a+b,0)<=18);
});

test('fog and rays recycle at zero opacity without jumping world anchors',()=>{
 for(const count of [2,3,5]) for(const interval of [310,440,850]){
  const boundary=interval*7.5;
  const samples=center=>new Map(Array.from({length:count},(_,slot)=>{
   const sample=atmosphereSample(center,interval,count,slot);return [sample.worldX,sample.opacity];
  }));
  const before=samples(boundary-.001),after=samples(boundary+.001);
  for(const x of new Set([...before.keys(),...after.keys()])) assert.ok(Math.abs((before.get(x)??0)-(after.get(x)??0))<.001);
 }
 assert.equal(atmosphereSample(500,440,0,0).opacity,0);
});
