import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3000';
test('the actual road stays centred through zoom and orbit on desktop and mobile',{timeout:120000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'barde',joinedAt:at}],events:Array.from({length:82},(_,i)=>({id:`seed-${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));});
  await page.goto(`${url}/local?debug&profile&hour=12`);await page.waitForFunction(()=>window.__voxelWorld?.ready&&!document.querySelector('.action-button--refus')?.disabled);
  const save=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));
  for(const button of [null,'Rapprocher la caméra','Rapprocher la caméra','Tourner la vue à droite','Tourner la vue à droite','Éloigner la caméra','Éloigner la caméra']){
   if(button)await page.getByRole('button',{name:button,exact:true}).click();await page.waitForTimeout(300);
   const road=await page.evaluate(()=>window.__voxelWorld.roadScreen),size=page.viewportSize();
   assert.ok(Math.abs(road.x-size.width/2)<1,JSON.stringify(road));assert.ok(Math.abs(road.y-(road.top+size.height-road.bottom)/2)<1,JSON.stringify(road));
  }
  const perf=await page.evaluate(()=>window.__voxelWorld.performance);if(mobile){assert.equal(perf.shadowMapAllocated,false);assert.equal(perf.bloom,false);}
  assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),save);assert.deepEqual(errors,[]);await context.close();
 }
});

test('Shift exploration preserves the chosen zoom across scenery and rooms, including after manual zoom',{timeout:90000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 for(const motion of ['reduce','no-preference']){
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:motion}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'barde',joinedAt:at}],events:Array.from({length:3},(_,i)=>({id:`seed-${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));});
 await page.goto(`${url}/local?debug&profile&hour=12`);await page.waitForFunction(()=>window.__voxelWorld?.ready&&!document.querySelector('.action-button--refus')?.disabled);await page.waitForTimeout(1400);
 const save=await page.evaluate(()=>localStorage.getItem('louchomage:v2')),initial=await page.evaluate(()=>window.__voxelWorld.zoom),rooms=new Set(),biomes=new Set();
 async function pan(expected){
  await page.keyboard.down('Shift');await page.mouse.move(1080,470);await page.mouse.down();await page.mouse.move(180,470,{steps:18});await page.mouse.up();await page.keyboard.up('Shift');await page.waitForTimeout(200);
  const state=await page.evaluate(()=>window.__voxelWorld);rooms.add(state.room);biomes.add(state.biome);
  assert.ok(Math.abs(state.zoom-expected)<.005,`exploring ${state.biome}/${state.room} at ${state.focus}: zoom ${state.zoom}, expected ${expected}`);
  return state;
 }
 for(let i=0;i<6;i++)await pan(initial);
 assert.ok(biomes.size>=2,'cross actual biome boundaries');assert.ok(rooms.has(null)&&rooms.size>1,'cross an interior boundary');
 await page.mouse.move(640,470);await page.mouse.wheel(0,-160);await page.waitForTimeout(1000);
 const manual=await page.evaluate(()=>window.__voxelWorld.zoom);assert.ok(manual>initial*1.1,'explicit wheel zoom still works');await pan(manual);
 await page.getByRole('button',{name:'Mon personnage',exact:true}).click();await page.waitForFunction(()=>Math.abs(window.__voxelWorld.focus-18.144)<.03);await page.waitForTimeout(400);
 const recentered=await page.evaluate(()=>({zoom:window.__voxelWorld.zoom,focus:window.__voxelWorld.focus}));assert.ok(Math.abs(recentered.focus-18.144)<.1);assert.ok(Math.abs(recentered.zoom-initial)<.005,'normal framing returns when following the hero');await pan(recentered.zoom);
 assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),save);assert.deepEqual(errors,[]);await page.close();
 }
});
