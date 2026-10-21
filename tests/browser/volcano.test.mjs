import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3000';
const folder=process.env.VOLCANO_SCREENSHOTS;
const CENTER=25250.4;
const setup=async(page,count=84)=>{
 await page.addInitScript(count=>{
  const at=new Date().toISOString();localStorage.setItem('louchomage:moi:v1','test');
  localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');
  localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at}],events:Array.from({length:count},(_,i)=>({id:`a${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));
 },count);
 await page.goto(`${url}/local?debug&hour=12`);
 await page.waitForFunction(()=>window.__pixiApp&&window.__decorScene&&document.querySelector('.action-button--refus')&&!document.querySelector('.action-button--refus').disabled);
};
const explore=async(page,x)=>{
 await page.evaluate(x=>{window.__decorScene.exploreCenter=x;window.__decorScene.pan=0;},x);
 await page.waitForFunction(x=>Math.abs(window.__decorScene.camera.x+window.__decorScene.camera.viewW/2-x)<3,x);
};
const sample=page=>page.evaluate(()=>{
 const stage=window.__pixiApp.stage,s=window.__decorScene;
 const lava=stage.getChildByLabel('volcano:lava',true),eruption=stage.getChildByLabel('volcano:eruption',true);
 const paths=node=>JSON.stringify(node.children.at(-1).context.instructions.slice(0,8).map(i=>i.data.path?.instructions));
 const glow=stage.getChildByLabel('volcano:light:ground',true);
 const hero=s.heroes.get('test');
 return {lava:paths(lava),eruption:paths(eruption),pulse:glow.children[0].alpha,light:glow.visible,hero,
  foot:s.camera.screenOffsetY+hero.y*s.camera.scale,header:s.topInset,dock:s.camera.viewH*s.camera.scale-s.bottomInset,
  neighbours:stage.getChildrenByLabel(/^biome-art:(?:desert|taverne)$/,true).map(n=>n.alpha)};
});

test('the volcanic caldera animates behind a grounded, readable hero at three camera sizes',{timeout:120000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 if(folder)await mkdir(folder,{recursive:true});
 for(const[name,width,height]of[['desktop',1280,800],['mobile',390,844],['wide',2400,900]])await t.test(name,async()=>{
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await setup(page);await explore(page,CENTER);
  await page.waitForFunction(()=>window.__pixiApp.stage.getChildByLabel('volcano:lava',true)?.children.at(-1).context.instructions.length>0);
  const saved=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));
  const a=await sample(page);await page.waitForTimeout(650);const b=await sample(page);
  assert.notEqual(a.lava,b.lava);assert.notEqual(a.eruption,b.eruption);assert.notEqual(a.pulse,b.pulse);
  assert.ok(a.light);assert.ok(a.neighbours.length>0&&a.neighbours.every(n=>n<.001));
  assert.equal(a.hero.y,650);assert.deepEqual(a.hero,b.hero);assert.ok(a.foot>a.header+140&&a.foot<a.dock-40);
  if(name==='desktop'){
   await page.evaluate(()=>{window.__decorScene.night=1;window.__decorScene.warm=0;});
   await page.waitForTimeout(150);
   const tint=await page.evaluate(()=>window.__pixiApp.stage.getChildByLabel('world-depth:0.16:1',true).tint);
   assert.ok((tint>>16)>180,'the crater keeps its incandescent colour under the night lighting');
   if(folder){await page.addStyleTag({content:'.dev-explorer{display:none!important}'});await page.screenshot({path:`${folder}/desktop-night.jpg`,quality:90});}
   await page.evaluate(()=>{window.__decorScene.night=0;window.__decorScene.warm=0;});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.__decorScene.reducedMotion);await page.waitForTimeout(150);
  const still=await sample(page);await page.waitForTimeout(550);const after=await sample(page);
  assert.equal(still.lava,after.lava);assert.equal(still.eruption,after.eruption);assert.equal(still.pulse,after.pulse);
  await page.emulateMedia({reducedMotion:'no-preference'});
  if(folder){await page.addStyleTag({content:'.dev-explorer{display:none!important}'});await page.screenshot({path:`${folder}/${name}.jpg`,quality:90});}
  for(const[place,x]of[['desert',23800],['tavern',26700]]){
   await explore(page,x);assert.equal(await page.evaluate(()=>window.__pixiApp.stage.getChildByLabel('volcano:light:ground',true).visible),false);
   if(folder)await page.screenshot({path:`${folder}/${name}-${place}.jpg`,quality:88});
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),saved);assert.deepEqual(errors,[]);
  await context.close();
 });
});

test('music follows the hero through forest, water and lava while exploration leaves it playing',{timeout:90000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 for(const[biome,count,track]of[['foret',21,'firelit'],['lac',43,'ambient'],['cascade',55,'ambient'],['volcan',84,'medieval']])await t.test(biome,async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  await setup(page,count);await page.keyboard.press('Shift');
  await page.waitForFunction(track=>window.__musicState?.().track===track&&window.__musicState().voices.some(v=>!v.paused&&v.time>.15),track);
  await explore(page,biome==='volcan'?6500:CENTER);
  assert.equal(await page.evaluate(()=>window.__musicState().track),track);
  await context.close();
 });
});
