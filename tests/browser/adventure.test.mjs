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
 async function fixture(viewport={width:1280,height:720},initiation=false,fresh=false){
  const context=await browser.newContext({viewport,deviceScaleFactor:2}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({initiation,fresh})=>{
   if(localStorage.getItem('louchomage:v2'))return;
   const at=new Date().toISOString();
   if(!initiation)localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');
   localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at}],events:fresh?[]:[{id:'a',playerId:'test',kind:'candidature',at},{id:'b',playerId:'test',kind:'candidature',at}],casts:[]}));
  },{initiation,fresh});
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
   assert.equal(await page.locator('.initiation-feedback--retry').count(),1);
   for(const [index,name]of ['Candidature','Refus','Entretien','Rejet après entretien'].entries()){
    await page.getByRole('button',{name,exact:true}).click();
    if(index<3)await page.getByRole('button',{name:'Démarche suivante →'}).click();
   }
   await page.getByRole('button',{name:'Rite suivant →'}).click();
   await page.getByRole('button',{name:'Ouvrir le coffre'}).click();
   await page.getByRole('button',{name:/Viser le gobelin/}).click();
   await page.getByRole('button',{name:'Au plus joli CV'}).click();
   await page.getByRole('button',{name:'Au plus de pas ce mois'}).click();
   await page.getByRole('button',{name:'Commencer le voyage'}).click();await ready(page);
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
 await t.test('the first find teaches the hunt once, links to the collection, and keeps actions locked',async()=>{
  for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:1920,height:1080}]){
   const {context,page,errors}=await fixture(viewport,false,true);
   try{
    const first=HIDDEN_ITEMS[0],second=HIDDEN_ITEMS[1];
    assert.equal(await page.locator('[data-highlighted=true]').count(),1);
    assert.equal(await page.locator('[data-highlighted=true]').getAttribute('data-hidden-item'),first.id);
    assert.equal(await page.locator('.hidden-discovery').count(),0,'rules wait for the pickup');
    const target=page.getByRole('button',{name:`Ramasser : ${first.name}`});
    await target.waitFor({state:'visible'});await page.waitForTimeout(800);
    assert.equal(await target.innerText(),'','objects have no floating label');
    const placement=await target.evaluate((node,id)=>{
     const item=window.__pixiApp.stage.getChildByLabel(id,true);
     const center=item.parent.toGlobal({x:0,y:-item.height/2}),box=node.getBoundingClientRect();
     const layer=item.parent.parent.parent;
     const camera=window.__decorScene.camera;
     return {dx:Math.abs(center.x-box.x-box.width/2),dy:Math.abs(center.y-box.y-box.height/2),
      layerX:layer.x,expectedLayerX:(-camera.x-camera.viewW/2)*.36+camera.viewW/2,backgroundName:item.parent.parent.label,
      halo:item.parent.getChildByLabel('hidden-object-glow')?.visible,
     };
    },first.id);
    assert.ok(placement.dx<1&&placement.dy<1,'the hit target follows the rendered background sprite');
    assert.equal(placement.backgroundName,'hidden-objects-background');
    assert.ok(Math.abs(placement.layerX-placement.expectedLayerX)<.01,'the object shares the background parallax');
    assert.equal(placement.halo,true);
    if(viewport.width===390){
     await page.emulateMedia({reducedMotion:'reduce'});
     assert.equal(await target.evaluate(node=>getComputedStyle(node,'::before').animationName),'none');
    }
    await target.click();
    const discovery=page.getByRole('dialog',{name:'Objets cachés'});await discovery.waitFor();
    assert.match(await discovery.innerText(),/Clique sur les objets cachés dans le décor pour compléter ta collection/);
    assert.equal(await page.locator('.hidden-object-target').count(),0,'world pickups pause behind the dialog');
    assert.equal(await page.locator('.action-button--refus').isDisabled(),true);
    await page.keyboard.press('2');await page.keyboard.press('r');await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')).events.length),0);
    const fits=await discovery.evaluate(node=>{const b=node.getBoundingClientRect();return b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&node.scrollWidth<=node.clientWidth;});
    assert.equal(fits,true,'the explanation fits this viewport');
    const skin=await discovery.evaluate(node=>{const s=getComputedStyle(node);return {border:s.borderTopWidth,padding:s.paddingTop,background:s.backgroundColor};});
    assert.equal(skin.border,'3px','the modal stylesheet is loaded');
    assert.equal(skin.padding,'24px');
    assert.notEqual(skin.background,'rgb(255, 255, 255)');
    await discovery.getByRole('button',{name:'Voir ma collection'}).click();
    await page.locator('.adventure-menu__collection').waitFor();
    assert.equal(await page.locator('.adventure-menu__collection article[data-found=true]').count(),1);
    assert.equal(await page.getByRole('button',{name:'Objets perdus · 1/8'}).getAttribute('aria-pressed'),'true');
    if(viewport.width===390){
     await page.getByRole('button',{name:'La salle des défis'}).click();
     await page.locator('.adventure-menu__games button').filter({hasText:MINI_GAMES.pong.title}).click();
     await page.locator('.mini-game--pong').waitFor();await page.keyboard.press('Escape');
     await page.locator('.adventure-menu').waitFor();
     assert.equal(await page.getByRole('button',{name:'La salle des défis'}).getAttribute('aria-pressed'),'true','an arcade still returns to the games tab');
    }
    await page.keyboard.press('Escape');await ready(page);
    await page.reload();await ready(page);
    assert.equal(await page.locator('[data-highlighted=true]').count(),0,'the hint stays dismissed after reload');
    assert.equal(await page.locator('.hidden-discovery').count(),0);
    await page.evaluate(x=>{window.__decorScene.exploreCenter=x;window.__decorScene.pan=0;},second.x);
    const next=page.getByRole('button',{name:`Ramasser : ${second.name}`});
    await next.waitFor({state:'visible'});await page.waitForTimeout(800);await next.click();
    await page.locator('.toast-notice').waitFor();
    assert.equal(await page.locator('.hidden-discovery').count(),0,'later finds use the short notice');
    await page.getByRole('button',{name:'J’ai compris'}).click();
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 await t.test('a first discovery outside the plain also teaches the hunt and Escape only closes that explanation',async()=>{
  const {context,page,errors}=await fixture();
  try{
   const item=HIDDEN_ITEMS[3];
   await page.evaluate(x=>{window.__decorScene.exploreCenter=x;window.__decorScene.pan=0;},item.x);
   const target=page.getByRole('button',{name:`Ramasser : ${item.name}`});
   await target.waitFor({state:'visible'});await page.waitForTimeout(800);await target.click();
   await page.getByRole('dialog',{name:'Objets cachés'}).waitFor();
   await page.keyboard.press('Escape');await ready(page);
   assert.equal(await page.locator('.hidden-discovery').count(),0);
   assert.equal(await page.locator('[data-highlighted=true]').count(),0);
   assert.equal(await page.locator(`[data-hidden-item="${HIDDEN_ITEMS[0].id}"]`).count(),1,'the uncollected letter stays in the world outside this camera');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')).discoveries.length),1);
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
    await page.getByRole('button',{name:item.id===HIDDEN_ITEMS[0].id?'Continuer':'J’ai compris',exact:true}).click();
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
