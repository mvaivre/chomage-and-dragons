import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
registerHooks({resolve(s,c,next){
 if(c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`,c);
 return next(s,c);
}});
const { groundSlices, GROUND_MATERIALS, terrainBaseColor } = await import('../src/lib/game/terrain.ts');
const { BIOMES, WORLD_LENGTH, biomeMix } = await import('../src/lib/game/world.ts');

test('native floors cover every biome and transitions without gaps on every lap',()=>{
 assert.deepEqual(Object.keys(GROUND_MATERIALS).sort(),BIOMES.map(b=>b.id).sort());
 for(const start of [-1280,0,...BIOMES.flatMap(b=>[-400,-16,0,16].map(d=>b.to*WORLD_LENGTH+d)),WORLD_LENGTH*2+37]){
  const slices=groundSlices(start,1031);let end=0;
  for(const slice of slices){
   assert.equal(slice.offset,end);assert.ok(slice.width>0);end+=slice.width;
   assert.ok(slice.a in GROUND_MATERIALS);assert.ok(slice.b in GROUND_MATERIALS);
   assert.ok(slice.blend>=0 && slice.blend<=1);
   const mix=biomeMix(start+slice.offset+Math.min(4,slice.width/2));
   assert.equal(slice.a,mix.a.id);
  }
  assert.equal(end,1031);
 }
});
test('uniform biome interiors stay a single sprite and match deeper soil shading',()=>{
 for(const b of BIOMES){
  const centre=(b.from+b.to)*WORLD_LENGTH/2;
  assert.deepEqual(groundSlices(centre-512),[{offset:0,width:1024,a:b.id,b:b.id,blend:0}]);
  assert.equal(terrainBaseColor(centre),GROUND_MATERIALS[b.id]);
 }
});
test('eight distinct native textures share a transparent margin and solid walking surface',async()=>{
 const require=createRequire(import.meta.url);const sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
 const hashes=new Set();
 for(const b of BIOMES){
  const file=new URL(`../public/art/world-v3/runtime/ground-${b.id}-v2.webp`,import.meta.url);
  const bytes=await readFile(file);hashes.add(createHash('sha256').update(bytes).digest('hex'));
  const meta=JSON.parse(await readFile(new URL(`../public/art/world-v3/runtime/ground-${b.id}-v2.json`,import.meta.url)));
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,2048);assert.equal(info.height,512);assert.equal(meta.worldWidth,1024);assert.equal(meta.contactY,24);
  assert.equal(meta.baseColor,GROUND_MATERIALS[b.id]);assert.ok((await stat(file)).size<650000);
  for(let y=0;y<24;y++) for(let x=0;x<2048;x++) assert.equal(data[(y*2048+x)*4+3],0,`${b.id}: transparent margin`);
  for(const y of [100,180,300,440]) for(let x=0;x<2048;x++) assert.ok(data[(y*2048+x)*4+3]>=240,`${b.id}: gap in walking surface at ${x},${y}`);
 }
 assert.equal(hashes.size,8);
});
