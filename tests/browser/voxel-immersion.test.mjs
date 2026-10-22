import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const url=process.env.GAME_TEST_URL??"http://localhost:3000";
test('all nine biomes keep their scenery, cutout, save and mobile rendering budgets through travel and reverse views',{timeout:180000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.addInitScript(()=>{const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'barde',joinedAt:at}],events:[],casts:[]}));});
 await page.goto(`${url}/local?debug&profile&hour=12`);await page.waitForFunction(()=>window.__voxelWorld?.ready&&!document.querySelector('.action-button--refus')?.disabled);
 const save=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));await page.getByRole('button',{name:/Explorer le monde/}).click();
 let peakTriangles=0,peakCalls=0;
 for(const [x,kind]of [[970,'paddock'],[3800,'cabin'],[8565,'mangrove'],[9979,'mushrooms'],[13600,null],[14364,'fishing-huts'],[17539,'hamlet'],[19354,'alpine-hamlet'],[21017,'goat-pen'],[22431,'oasis'],[24857,'forge'],[25855,'obsidian'],[27700,'vineyard'],[13600,null],[8565,'mangrove']]){
  await page.getByLabel('Position de test').fill(String(x));await page.waitForFunction(x=>Math.abs(window.__voxelWorld.focus*50-x)<2&&window.__voxelWorld.chunks===5,x);
  const w=await page.evaluate(()=>window.__voxelWorld);
  if(kind)assert.ok(w.landscapes.some(p=>p.kind===kind),`${kind} is loaded in the actual game`);
  assert.ok(w.occlusion.windows.length>0);assert.equal(w.occlusion.enabled,1);assert.equal(w.occlusion.backPlantingVisible,true);
  assert.equal(w.performance.shadowMapAllocated,false);assert.equal(w.performance.bloom,false);assert.ok(w.performance.pixelRatio<=1);
  peakTriangles=Math.max(peakTriangles,w.triangles);peakCalls=Math.max(peakCalls,w.calls);assert.ok(w.triangles<150000);assert.ok(w.calls<200);assert.ok(w.geometries<150);
 }
 // The original camera-side deletion hid all the trees here. The shader must work in both directions.
 await page.getByRole('button',{name:/Caméra libre/}).click();
 for(let i=0;i<4;i++)await page.getByRole('button',{name:'Tourner la vue à droite'}).click();
 await page.waitForFunction(()=>window.__voxelWorld.azimuth>Math.PI);
 await page.waitForTimeout(400);const reverse=await page.evaluate(()=>window.__voxelWorld);assert.ok(reverse.occlusion.windows.length>0);assert.equal(reverse.occlusion.backPlantingVisible,true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),save);assert.deepEqual(errors,[]);console.log({peakTriangles,peakCalls});await context.close();
});

test('the actual shader reveals the hero through foreground foliage while retaining the tree',{timeout:90000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 const pink=[];
 for(const enabled of [false,true]){
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.addInitScript(()=>{const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'barde',joinedAt:at}],events:Array.from({length:45},(_,i)=>({id:`seed-${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));});
  await page.goto(`${url}/local?debug&profile&hour=12${enabled?'':'&occlusion=0'}`);await page.waitForFunction(()=>window.__voxelWorld?.ready&&!document.querySelector('.action-button--refus')?.disabled);await page.waitForTimeout(300);
  const shot=await page.screenshot(),w=await page.evaluate(()=>window.__voxelWorld.occlusion.windows[0]);
  pink.push(await page.evaluate(async({base64,w})=>{
   const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'})),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    if(Math.hypot(x-w[0],canvas.height-y-w[1])>w[3])continue;
    const i=(y*canvas.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(r>g*1.15&&b>g*1.05&&r>b*.85)count++;
   }return count;
  },{base64:shot.toString('base64'),w}));
  assert.equal(await page.evaluate(()=>window.__voxelWorld.occlusion.backPlantingVisible),true);assert.deepEqual(errors,[]);await context.close();
 }
 assert.ok(pink[1]>pink[0]+100,`visible hero pixels with cutout ${pink[1]}, without ${pink[0]}`);
});
