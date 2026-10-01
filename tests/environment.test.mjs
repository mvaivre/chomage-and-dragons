import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
registerHooks({ resolve(s,c,next) {
 if(s.startsWith('@/')) return next(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);
 if(c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`,c);
 return next(s,c);
}});
const {canExploreTarget,environmentSites,environmentLine,ENVIRONMENT_REACH,ENVIRONMENT_LABELS}=await import('../src/lib/game/environment.ts');
const {BIOMES,WORLD_LENGTH}=await import('../src/lib/game/world.ts');
const {roomAt}=await import('../src/lib/game/doors.ts');

test('encounters require the actual hero to arrive, even when the camera follows someone else',()=>{
 assert.equal(canExploreTarget(undefined,1000,false,false,false),false);
 assert.equal(canExploreTarget(1000,1000,true,false,false),false);
 assert.equal(canExploreTarget(1000,1000,false,true,false),false);
 assert.equal(canExploreTarget(1000,1000,false,false,true),false);
 assert.equal(canExploreTarget(1000-ENVIRONMENT_REACH,1000,false,false,false),true);
 assert.equal(canExploreTarget(1000+ENVIRONMENT_REACH+1,1000,false,false,false),false);
 for(const value of [NaN,Infinity,-Infinity]) assert.equal(canExploreTarget(value,1000,false,false,false),false);
});
test('life spans every biome and parallax plane on successive laps without entering doors',()=>{
 for(const factor of [1,0.76]){
 const sites=environmentSites(0,WORLD_LENGTH*3,factor);
 assert.equal(new Set(sites.map(s=>s.id)).size,sites.length);
 for(const biome of BIOMES) for(let lap=0;lap<3;lap++) assert.ok(sites.some(s=>s.biome===biome.id && Math.floor(s.x/WORLD_LENGTH)===lap),`${biome.id}, lap ${lap}, factor ${factor}`);
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
 assert.ok(new Set(lines).size>=3);assert.ok(lines.every(line=>line.length<=45));
 }
});
test('new atlases have eight transparent cells, crisp full silhouettes and no clipped gutter',async()=>{
 const require=createRequire(import.meta.url);const sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
 for(const name of ['environment-troll','woodland-life']){
 const path=new URL(`../public/art/world-v3/animations/${name}.webp`,import.meta.url);
 const meta=JSON.parse(await readFile(new URL(`../public/art/world-v3/animations/${name}.json`,import.meta.url)));
 const {data,info}=await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,2048);assert.equal(info.height,1024);assert.equal(meta.poses.length,8);assert.ok((await stat(path)).size<650000);
 for(let i=0;i<8;i++){let solid=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++){const a=data[((Math.floor(i/4)*512+y)*2048+i%4*512+x)*4+3];if(a>24){solid++;assert.ok(x>3 && x<508 && y>3 && y<508,`${name}, pose ${i} cropped`);}}assert.ok(solid>15000);}
 }
});

const {environmentBubble}=await import('../src/components/game/projection.ts');
test('speech moves beside tall residents under the HUD and stays within mobile edges',()=>{
 const tall={x:740,y:350,height:172};
 const side=environmentBubble(tall,1280,252);
 assert.equal(side.side,'left');assert.ok(side.left+135<tall.x-50);assert.ok(side.top>=322);
 const low=environmentBubble({x:600,y:450,height:70},1280,252);
 assert.equal(low.side,'above');assert.equal(low.top,401);
 for(const width of [280,320,390,760,1920]) for(const x of [24,width/2,width-24]){
 const bubble=environmentBubble({...tall,x},width,200);
 assert.ok(bubble.left>=Math.min(140,width/2));assert.ok(bubble.left<=width-Math.min(140,width/2));
 }
});
