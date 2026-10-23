import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3000';

test('a roaming NPC detours around an idle hero in the real desktop and mobile game',{timeout:60000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'chevalier',joinedAt:at}],events:[],casts:[]}));});
  await page.goto(`${url}/local?debug&profile&hour=12`);await page.waitForFunction(()=>window.__voxelWorld?.ready&&!document.querySelector('.action-button--refus')?.disabled);
  const save=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));
  const result=await page.evaluate(()=>new Promise(resolve=>{
   const world=window.__voxelWorld,hero=world.actors.find(a=>a.id==='test').position,npc=world.inhabitants.find(n=>n.id==='wanderer:0');
   // Arrange a deterministic autonomous crossing via the live cosmetic body.
   // The real patrol, steering, rendering and collision code then run unmodified.
   Object.assign(npc.position,{x:hero[0]-2.4,y:hero[1],z:hero[2]});Object.assign(npc.home,{x:hero[0]+2.3,y:hero[1],z:hero[2]-2.7});
   const clearance=world.actors.find(a=>a.id==='test').radius+npc.radius+.15,samples=[{...npc.position,hits:npc.hits,mode:npc.mode}],start=performance.now();let frame=-1;
   function sample(){const w=window.__voxelWorld,n=w.inhabitants.find(n=>n.id==='wanderer:0');if(w.performance.frames!==frame){frame=w.performance.frames;samples.push({x:n.position.x,y:n.position.y,z:n.position.z,hits:n.hits,mode:n.mode});}
    if(n.position.x>hero[0]+1.4||performance.now()-start>6500)resolve({hero,samples,clearance});else requestAnimationFrame(sample);
   }requestAnimationFrame(sample);
  }));
  assert.ok(result.samples.length>=3);let arc=0;
  for(let i=1;i<result.samples.length;i++){
   const a=result.samples[i-1],b=result.samples[i],dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,h=result.hero,t=l?Math.max(0,Math.min(1,((h[0]-a.x)*dx+(h[2]-a.z)*dz)/l)):0;
   assert.ok(Math.hypot(a.x+dx*t-h[0],a.z+dz*t-h[2])>=result.clearance-1e-4,'no frame crosses the hero');assert.equal(b.hits,0);assert.equal(b.mode,'walking');arc=Math.max(arc,Math.abs(b.z-h[2]));
  }
  assert.ok(arc>result.clearance-.02,'a visible arc around the hero');assert.ok(result.samples.at(-1).x>result.hero[0]+1.4,'the NPC reaches the far side');
  assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),save);assert.deepEqual(errors,[]);console.log({mobile,samples:result.samples.length,arc});await context.close();
 }
});
