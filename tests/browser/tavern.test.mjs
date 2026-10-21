import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3000';

test('the final tavern renders, responds and respects motion preferences',{timeout:150000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 t.after(()=>browser.close());
 async function fixture({width=1440,height=960,steps=0,hired=true}={}){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({steps,hired})=>{
   if(localStorage.getItem('louchomage:v2'))return;
   const at=new Date().toISOString();localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');
   localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at,...(hired?{hiredAt:at}:{})}],events:Array.from({length:steps/2},(_,i)=>({id:`a${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));
  },{steps,hired});
  await page.goto(`${url}/local?debug&hour=22`);
  await page.waitForFunction(()=>window.__pixiApp&&document.querySelector('.action-button--refus')&&window.__decorScene?.heroes.has('test'));
  return {context,page,errors};
 }
 async function frame(page,x){
  await page.evaluate(x=>{window.__decorScene.exploreCenter=x;window.__decorScene.pan=0;},x);
  await page.waitForFunction(x=>Math.abs(window.__decorScene.camera.x+window.__decorScene.camera.viewW/2-x)<3,x);
 }
 for(const [name,width,height]of [['desktop',1280,720],['mobile',390,844],['wide',2400,1000]])await t.test(`${name} arrival keeps the hired hero inside the room and above the dock`,async()=>{
  const {context,page,errors}=await fixture({width,height});
  await page.waitForFunction(()=>window.__pixiApp.stage.getChildByLabel('tavern-art:kiss',true)?.texture.width>1);
  await page.waitForTimeout(600);
  const state=await page.evaluate(()=>{const s=window.__decorScene,h=s.heroes.get('test'),c=s.camera;return {room:s.room?.id,viewed:s.viewedRoom?.id,x:(h.x-c.x)*c.scale,y:c.screenOffsetY+(h.y-c.y)*c.scale,bottom:c.viewH*c.scale-s.bottomInset,top:s.topInset,guests:window.__pixiApp.stage.getChildByLabel(`interior:tavern:${s.room.from}`,true).children.filter(n=>n.label?.startsWith('tavern-guest')).map(n=>n.label)};});
  assert.equal(state.room,'tavern');assert.equal(state.viewed,'tavern');
  assert.ok(state.x>0&&state.x<width-12);if(name==='mobile')assert.ok(state.x>width*.65,'arrival frames the party to the left of the hero');assert.ok(state.y>state.top+90&&state.y<state.bottom-15);
  assert.equal(new Set(state.guests).size,9);
  assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('every gag has an accessible response without changing the save or swallowing the hero',async()=>{
  const{context,page,errors}=await fixture();
  await page.waitForFunction(()=>window.__pixiApp.stage.getChildByLabel('tavern-art:dragon',true)?.texture.width>1);
  const saved=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));
  for(const[id,x]of [['wizard',28650],['dancers',28920],['bard',29150],['band',29380],['chandelier',29520],['dragon',29650],['handstand',29860],['kiss',30030],['pigeon',29770]]){
   await frame(page,x);
   const button=page.locator(`[data-environment-id="tavern:28400:${id}"]`);await button.waitFor({state:'visible'});
   await button.focus();await page.keyboard.press('Enter');
   await page.locator(`.environment-speech[data-target="tavern:28400:${id}"]`).waitFor({state:'visible'});
   assert.ok((await page.locator('.environment-speech p').innerText()).length>15);
   await page.getByRole('button',{name:'Fermer le dialogue'}).click();
  }
  await frame(page,29650);
  const dragon=page.locator('[data-environment-id="tavern:28400:dragon"]');
  for(let i=0;i<4;i++){await dragon.focus();await page.keyboard.press('Enter');await page.waitForTimeout(950);}
  assert.equal(await page.evaluate(()=>window.__decorScene.dragonMeal),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),saved);
  assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('feet stay planted while the chandelier and dancers move, then all decorative motion stops',async()=>{
  const{context,page,errors}=await fixture();await frame(page,29520);
  await page.waitForFunction(()=>window.__pixiApp.stage.getChildByLabel('tavern-table',true)?.texture.width>1);
  const sample=()=>page.evaluate(()=>{const get=name=>window.__pixiApp.stage.getChildByLabel(name,true);return ['tavern-art:chandelier','tavern-art:dancers','tavern-table','tavern-art:dragon','tavern-guest:pigeon','tavern-art:pigeon'].map(name=>{const n=get(name);return {name,x:n.x,y:n.y,rotation:n.rotation,scale:n.scale.y,frame:n.texture?.uid};});});
  const first=await sample();await page.waitForTimeout(750);const second=await sample();
  assert.notEqual(first[0].rotation,second[0].rotation);assert.notEqual(first[1].y,second[1].y);
  assert.deepEqual(first[2],second[2],'the table stays planted');assert.equal(first[3].y,second[3].y);
  assert.notEqual(first[4].x,second[4].x);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
  const still=await sample();await page.waitForTimeout(700);assert.deepEqual(await sample(),still);
  assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('hiring walks into the final tavern and persists there',async()=>{
  const{context,page,errors}=await fixture({steps:186,hired:false});
  await page.locator('.action-button--embauche').click();
  await page.waitForFunction(()=>window.__decorScene.room?.id==='tavern'&&!window.__decorScene.doorTransition&&Math.abs(window.__decorScene.heroes.get('test').x-30160)<1,null,{timeout:20000});
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')).players[0].hiredAt));
  await page.reload();
  await page.waitForFunction(()=>window.__decorScene?.room?.id==='tavern'&&window.__decorScene.heroes.has('test'));
  assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('entry, exit over the lap boundary and reverse travel use real door transitions',async()=>{
  const{context,page,errors}=await fixture({steps:186,hired:false});
  await page.locator('.action-button--refus').click();
  await page.waitForFunction(()=>window.__decorScene.room?.id==='tavern'&&!window.__decorScene.doorTransition&&Math.abs(window.__decorScene.heroes.get('test').x-(189*30240/200-80))<1,null,{timeout:20000});
  assert.deepEqual(errors,[]);await context.close();
  const exit=await fixture({steps:200,hired:false});
  await exit.page.locator('.action-button--candidature').click();
  await exit.page.waitForFunction(()=>!window.__decorScene.room&&!window.__decorScene.doorTransition&&Math.abs(window.__decorScene.heroes.get('test').x-(202*30240/200-80))<1,null,{timeout:15000});
  await exit.page.reload();
  await exit.page.waitForFunction(()=>document.querySelector('.action-button--entretien')&&!document.querySelector('.action-button--entretien').disabled);
  await exit.page.locator('.action-button--entretien').click();
  await exit.page.waitForFunction(()=>window.__decorScene.room?.id==='tavern'&&!window.__decorScene.doorTransition,null,{timeout:15000});
  assert.deepEqual(exit.errors,[]);await exit.context.close();
 });
});
