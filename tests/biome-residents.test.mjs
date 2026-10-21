import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks,createRequire} from 'node:module';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
registerHooks({resolve(s,c,next){if(s.startsWith('@/'))return next(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {BIOME_RESIDENTS,biomeResidentFrame,BIOME_GESTURES,biomeGestureFrame,advanceResidentBlend}=await import('../src/lib/game/biome-residents.ts');
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

test('new resident atlases have four distinct poses with transparent gutters and fixed feet',async()=>{
 const require=createRequire(import.meta.url),sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
 for(const[kind,profile]of Object.entries(BIOME_RESIDENTS)){
  const file=new URL(`../public${profile.art}`,import.meta.url),meta=JSON.parse(await readFile(new URL(`../public${profile.art.replace('.webp','.json')}`,import.meta.url)));
  const {data,info}=await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,768);assert.equal(info.height,768);assert.equal(meta.baseline,356);
  assert.equal(profile.referenceHeight,Math.max(...meta.heights));assert.ok((await stat(file)).size<350000);
  const signatures=[];
  for(let pose=0;pose<4;pose++){
   let count=0,foot=0;const pixels=[];
   for(let y=0;y<384;y++)for(let x=0;x<384;x++){
    const i=((Math.floor(pose/2)*384+y)*info.width+pose%2*384+x)*4,a=data[i+3];
    if(a>32){count++;foot=Math.max(foot,y);assert.ok(x>3&&x<380&&y>3&&y<380,`${kind} pose ${pose} clipped`);}
    if(x%8===0&&y%8===0)pixels.push(...(a>32?data.subarray(i,i+4):[0,0,0,0]));
   }
   assert.ok(count>3000,kind);assert.ok(Math.abs(foot-356)<=2,`${kind} pose ${pose} feet`);
   signatures.push(createHash('sha256').update(Buffer.from(pixels)).digest('hex'));
  }
  assert.equal(new Set(signatures).size,4,`${kind} distinct poses`);
 }
});

test('idle gestures are sparse, reactions use their own pose and reduced motion stays still',()=>{
 assert.equal(biomeResidentFrame(0,false,false),0);assert.equal(biomeResidentFrame(3.1,false,false),1);
 assert.equal(biomeResidentFrame(6.5,false,false),2);assert.equal(biomeResidentFrame(9.5,false,false),3);
 for(let time=0;time<30;time+=.1){assert.equal(biomeResidentFrame(time,false,true),0);assert.equal(biomeResidentFrame(time,true,true),3);assert.equal(biomeResidentFrame(time,true,false),3);}
});

test('gestures prepare, hold three distinct reactions and settle with frame-rate-independent blending',()=>{
 for(let visit=1;visit<=6;visit++){
  assert.equal(biomeGestureFrame(0,visit,false),4);
  const held=5+(visit-1)%3;
  assert.equal(biomeGestureFrame(.5,visit,false),held);
  assert.equal(biomeGestureFrame(.85,visit,false),4);
  assert.equal(biomeGestureFrame(.95,visit,false),0);
  assert.equal(biomeGestureFrame(1,visit,false),0);
  for(let p=0;p<1;p+=.05)assert.equal(biomeGestureFrame(p,visit,true),held);
 }
 for(const fps of [20,30,60,120]){
  const blend={frame:0,previous:0,progress:1};let alpha=0;
  for(let i=0;i<Math.ceil(fps*.13);i++){
   const next=advanceResidentBlend(blend,5,1/fps,false);
   assert.ok(next>=alpha && next<=1);alpha=next;
  }
  assert.equal(alpha,1);assert.equal(blend.previous,0);
  assert.equal(advanceResidentBlend(blend,6,0,true),1);assert.equal(blend.previous,5);
 }
});

test('additional gesture drawings preserve complete silhouettes, common feet and transparent margins',async()=>{
 const require=createRequire(import.meta.url),sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
 for(const[kind,art]of Object.entries(BIOME_GESTURES)){
  const file=new URL(`../public${art}`,import.meta.url),meta=JSON.parse(await readFile(new URL(`../public${art.replace('.webp','.json')}`,import.meta.url)));
  assert.equal(meta.baseline,356);assert.ok((await stat(file)).size<350000);
  const {data,info}=await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,768);assert.equal(info.height,768);
  const signatures=[];
  for(let pose=0;pose<4;pose++){
   let foot=0,solid=0;const pixels=[];
   for(let y=0;y<384;y++)for(let x=0;x<384;x++){
    const i=((Math.floor(pose/2)*384+y)*768+pose%2*384+x)*4,a=data[i+3];
    if(a>32){solid++;foot=Math.max(foot,y);assert.ok(x>3&&x<380&&y>3&&y<380,`${kind} pose ${pose} clipped`);}
    if(x%8===0&&y%8===0)pixels.push(...(a>32?data.subarray(i,i+4):[0,0,0,0]));
   }
   assert.ok(solid>3000);assert.ok(Math.abs(foot-356)<=2);
   signatures.push(createHash('sha256').update(Buffer.from(pixels)).digest('hex'));
  }
  assert.equal(new Set(signatures).size,4,kind);
 }
});
