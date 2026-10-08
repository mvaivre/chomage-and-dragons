import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
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
 assert.ok(new Set(lines).size>=3);assert.ok(lines.every(line=>line.length<=72));
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

const {Container}=await import('pixi.js');
const {scene}=await import('../src/components/game/scene.ts');
const {environmentTargets,updateSpriteTarget}=await import('../src/components/game/environment-targets.ts');
test('click targets follow transformed feet and disappear with hidden room or scenery parents',()=>{
 const previous={...scene.camera};
 const stage=new Container(),layer=new Container(),parent=new Container(),feet=new Container();
 stage.addChild(layer);layer.addChild(parent);parent.addChild(feet);
 Object.assign(scene.camera,{x:400,y:60,scale:1.25,viewW:1280,screenOffsetY:25});
 stage.scale.set(1.25);stage.y=25;
 parent.position.set(950,602);feet.position.set(35,10);
 for(const factor of [1,.76]){
  layer.x=(0-400-640)*factor+640;layer.y=-60*factor;
  environmentTargets.set('test-foot',{});
  updateSpriteTarget('test-foot',feet,100,70,factor);
  const t=environmentTargets.get('test-foot');
  assert.equal(t.visible,true);assert.ok(Math.abs(t.worldX-985/factor)<1e-8);assert.equal(t.worldY,562);
  parent.visible=false;updateSpriteTarget('test-foot',feet,100,70,factor);assert.equal(t.visible,false);parent.visible=true;
 }
 environmentTargets.delete('test-foot');Object.assign(scene.camera,previous);stage.destroy({children:true});
});

test('troll walk atlas keeps four distinct complete poses on a shared foot baseline',async()=>{
 const require=createRequire(import.meta.url);const sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
 const path=new URL('../public/art/world-v3/animations/environment-troll-walk.webp',import.meta.url);
 const meta=JSON.parse(await readFile(new URL('../public/art/world-v3/animations/environment-troll-walk.json',import.meta.url)));
 const {data,info}=await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,2048);assert.equal(info.height,512);assert.equal(meta.poses.length,4);assert.ok((await stat(path)).size<650000);
 const silhouettes=[];
 for(let i=0;i<4;i++){let solid=0,foot=0,signature='';for(let y=0;y<512;y++)for(let x=0;x<512;x++){const a=data[(y*2048+i*512+x)*4+3];if(a>24){solid++;foot=Math.max(foot,y);assert.ok(x>3 && x<508 && y>3 && y<508,`walk ${i} cropped`);}if(x%16===0 && y%16===0)signature+=a>24?'1':'0';}assert.ok(solid>15000);assert.ok(Math.abs(foot-meta.baseline)<=2);silhouettes.push(signature);}
 assert.equal(new Set(silhouettes).size,4);
});
