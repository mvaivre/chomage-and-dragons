import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {chromium} from 'playwright';
registerHooks({resolve(s,c,n){return n(s.startsWith('@/')?new URL(`../../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);}});
const {HIDDEN_ITEMS}=await import('../../src/lib/game/hidden-objects.ts');
const {MINI_GAMES}=await import('../../src/lib/game/mini-games.ts');
const url=process.env.GAME_TEST_URL??'http://localhost:3100';
const ready=page=>page.waitForFunction(()=>window.__decorScene&&window.__pixiApp&&!document.querySelector('.action-button--refus')?.disabled);

test('side quests work in the real renderer without changing the race',{timeout:150000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 t.after(()=>browser.close());
 async function fixture(viewport={width:1280,height:720},initiation=false){
  const context=await browser.newContext({viewport,deviceScaleFactor:2}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(initiation=>{
   if(localStorage.getItem('louchomage:v2'))return;
   const at=new Date().toISOString();
   if(!initiation)localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');
   localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at}],events:[{id:'a',playerId:'test',kind:'candidature',at},{id:'b',playerId:'test',kind:'candidature',at}],casts:[]}));
  },initiation);
  await page.goto(`${url}/local?debug&hour=12`);
  if(initiation)await page.locator('.initiation-card').waitFor();else await ready(page);
  return{context,page,errors};
 }
 await t.test('all three initiation rites teach the game without writing real actions',async()=>{
  const {context,page,errors}=await fixture({width:390,height:844},true);
  try{
   await page.getByRole('button',{name:'Décoller',exact:true}).click();
   let lane=1;
   for(const [index,target]of [0,2,1,0].entries()){
    while(lane!==target){await page.keyboard.press(lane>target?'ArrowUp':'ArrowDown');lane+=lane>target?-1:1;}
    await page.waitForFunction(count=>document.querySelector('.initiation-ring-count')?.getAttribute('aria-label')===`${count} anneaux sur quatre`,index+1);
   }
   await page.getByRole('button',{name:'Rite suivant →'}).click();
   await page.getByRole('button',{name:'Refus',exact:true}).click();
   assert.match(await page.locator('.initiation-feedback').innerText(),/Essaie/);
   for(const [index,name]of ['Candidature','Refus','Entretien','Rejet après entretien'].entries()){
    await page.getByRole('button',{name,exact:true}).click();
    if(index<3)await page.getByRole('button',{name:'Démarche suivante →'}).click();
   }
   await page.getByRole('button',{name:'Rite suivant →'}).click();
   await page.getByRole('button',{name:'Ouvrir le coffre'}).click();
   await page.getByRole('button',{name:/Viser le gobelin/}).click();
   await page.getByRole('button',{name:'Au plus joli CV'}).click();
   await page.getByRole('button',{name:'Au plus de pas ce mois'}).click();
   await page.getByRole('button',{name:'Entrer dans la légende'}).click();await ready(page);
   const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')));
   assert.equal(state.events.length,2);assert.equal(state.casts.length,0);
   await page.reload();await ready(page);assert.equal(await page.locator('.initiation-card').count(),0);
   await page.getByRole('button',{name:'Quêtes',exact:true}).click();await page.getByRole('button',{name:/Les rites d’initiation/}).click();
   await page.getByRole('button',{name:'Recommencer',exact:true}).click();
   await page.getByRole('heading',{name:'Le baptême de l’air'}).waitFor();
   await page.keyboard.press('Escape');await ready(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 await t.test('every new arcade opens, accepts keyboard and touch, and keeps the real journal intact',async()=>{
  const {context,page,errors}=await fixture({width:390,height:844});
  try{
   for(const kind of ['pigeonRace','paperCut','snake','maze','stack','pong']){
    await page.getByRole('button',{name:'Quêtes',exact:true}).click();
    await page.locator('.adventure-menu__games button').filter({hasText:MINI_GAMES[kind].title}).click();
    const game=page.locator(`.mini-game--${kind}`);await game.waitFor();
    await game.getByRole('button',{name:'C’est parti !',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.arcade-arena')?.dataset.status==='running');
    await page.keyboard.press('2');await page.keyboard.press('ArrowRight');
    const control=game.locator('.arcade-controls button:not(:disabled)').first();await control.click();
    if(kind==='stack'){
     await game.getByRole('button',{name:'Aller à droite',exact:true}).focus();await page.keyboard.press('Enter');
     assert.match(await game.locator('.mini-game__hud').innerText(),/0 points/,'Enter moves the piece instead of dropping it');
    }
    const sharp=await game.locator('canvas').evaluate(canvas=>canvas.width>=canvas.getBoundingClientRect().width*1.8);assert.ok(sharp);
    if(kind==='snake')await page.waitForFunction(()=>document.querySelector('.arcade-arena')?.dataset.status==='lost');
    await page.keyboard.press('Escape');await page.locator('.adventure-menu').waitFor();
    await page.getByRole('button',{name:'Fermer les quêtes'}).click();await ready(page);
    const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')));
    assert.equal(state.events.length,2,kind);assert.equal(state.miniGames?.length??0,0,kind);
    assert.equal(state.daily?.length??0,0,kind);
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 await t.test('eight objects can be found during free exploration and stay collected after reload',async()=>{
  const {context,page,errors}=await fixture();
  try{
   for(const item of HIDDEN_ITEMS){
    await page.evaluate(x=>{window.__decorScene.exploreCenter=x;window.__decorScene.pan=0;},item.x);
    const target=page.locator(`[data-hidden-item="${item.id}"]`);
    await target.waitFor({state:'visible'});await page.waitForTimeout(800);await target.click();
    await page.waitForFunction(id=>JSON.parse(localStorage.getItem('louchomage:v2')).discoveries?.some(d=>d.itemId===id),item.id);
    await target.waitFor({state:'detached'});
    await page.getByRole('button',{name:'J’ai compris'}).click();
   }
   await page.reload();await ready(page);
   await page.getByRole('button',{name:'Quêtes',exact:true}).click();
   await page.getByRole('button',{name:'Objets perdus · 8/8'}).click();
   assert.equal(await page.locator('.adventure-menu__collection article[data-found=true]').count(),8);
   assert.match(await page.locator('.adventure-menu__complete').innerText(),/Collection complète/);
   const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')));
   assert.equal(state.events.length,2);assert.equal(state.casts.length,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 await t.test('dragging over an object never collects it and opening a dialog releases the camera',async()=>{
  const {context,page,errors}=await fixture();
  try{
   const item=HIDDEN_ITEMS[0];
   await page.evaluate(x=>{window.__decorScene.exploreCenter=x;window.__decorScene.pan=0;},item.x);
   const target=page.locator(`[data-hidden-item="${item.id}"]`);await target.waitFor({state:'visible'});await page.waitForTimeout(1000);
   let box=await target.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2+40,{steps:5});await page.mouse.up();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')).discoveries?.length??0),0);
   box=await target.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
   await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2,{steps:5});
   assert.equal(await page.evaluate(()=>window.__decorScene.dragging),true);
   await page.keyboard.press('Escape');await page.mouse.up();
   assert.equal(await page.evaluate(()=>window.__decorScene.dragging),false);
   await page.keyboard.press('Escape');await ready(page);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
});
