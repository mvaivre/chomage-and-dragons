import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
registerHooks({resolve(s,c,next){if(s.startsWith('@/'))return next(new URL(`../../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {dragonNests,dragonVariantAt,DRAGON_VARIANTS}=await import('../../src/lib/game/dragon.ts');
const {WORLD_LENGTH,surfaceAt}=await import('../../src/lib/game/world.ts');
const url=process.env.GAME_TEST_URL??'http://localhost:3000',folder=process.env.DRAGON_COLOUR_SCREENSHOTS;
const sample=(page,x)=>page.evaluate(({x,ground})=>{
 const scene=window.__decorScene,root=window.__pixiApp.stage.getChildrenByLabel('dragon-nest',true).find(n=>Math.abs(n.x-x)<1);
 const body=root.getChildByLabel('dragon-body'),fire=root.getChildByLabel('dragon-fire'),flame=fire.getChildByLabel('dragon-fire-body');
 const previous=fire.getChildByLabel('dragon-fire-previous'),glamour=root.getChildByLabel('dragon-glamour');
 const names=[];const visit=n=>{if(typeof n.text==='string'&&n.text.startsWith('Mika · Nv '))names.push(n.getBounds().maxY);n.children?.forEach(visit);};visit(window.__pixiApp.stage);
 return {source:body.texture.source.label,frame:body.texture.frame.x/512+body.texture.frame.y/512*4,y:root.y,anchor:body.anchor.y*body.texture.orig.height,
  fire:fire.visible,mouth:fire.getGlobalPosition(),
  flame:JSON.stringify([flame.texture.frame,flame.alpha,previous.alpha]),bounds:flame.getBounds(),glamour:glamour?.children.map(c=>c.alpha),
  foot:root.getGlobalPosition().y,ground:scene.camera.screenOffsetY+ground*scene.camera.scale,hero:scene.heroes.get('test'),nameBottom:Math.max(...names)};
},{x,ground:surfaceAt(x)});

test('five dragon coats breathe registered fire and keep their identity through a meal',{timeout:220000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());if(folder)await mkdir(folder,{recursive:true});
 for(const x of dragonNests(0,WORLD_LENGTH-1))await t.test(dragonVariantAt(x),async()=>{
  const variant=dragonVariantAt(x);
  for(const[name,width,height]of[['desktop',1280,800],['mobile',390,844],['wide',2400,900]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.addInitScript(count=>{const at=new Date().toISOString();localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at}],events:Array.from({length:count},(_,i)=>({id:`a${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));},Math.round((x+80)/WORLD_LENGTH*100));
    await page.goto(`${url}/local?debug&hour=12`);await page.waitForFunction(()=>window.__pixiApp&&document.querySelector('.action-button--refus')&&!document.querySelector('.action-button--refus').disabled);
    await page.evaluate(x=>{window.__decorScene.exploreCenter=x;window.__decorScene.pan=0;},x);await page.waitForFunction(x=>Math.abs(window.__decorScene.camera.x+window.__decorScene.camera.viewW/2-x)<2,x);
    const saved=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));
    const button=page.locator(`[data-environment-id="nest:${x}"]`);await button.waitFor();
    for(let i=0;i<3;i++){await button.focus();await page.keyboard.press('Enter');}
    await page.waitForFunction(x=>window.__pixiApp.stage.getChildrenByLabel('dragon-nest',true).find(n=>Math.abs(n.x-x)<1)?.getChildByLabel('dragon-fire')?.visible,x);
    await page.waitForTimeout(650);const a=await sample(page,x);await page.waitForTimeout(250);const b=await sample(page,x);
    assert.ok(a.source.endsWith(DRAGON_VARIANTS[variant].art));assert.equal(a.frame,2);assert.equal(a.y,surfaceAt(x));assert.equal(a.anchor,476);assert.ok(Math.abs(a.foot-a.ground)<1);
    assert.ok(a.bounds.minX>=-2,'the flame fits the portrait frame');
    assert.ok((await page.locator('.dragon-encounter').boundingBox()).y>a.nameBottom+4,'the challenge button leaves the player name readable');
    assert.notEqual(a.flame,b.flame);assert.deepEqual(a.hero,b.hero);assert.equal(a.hero.y,650);
    if(variant==='gold'){assert.equal(a.glamour.length,5);assert.notDeepEqual(a.glamour,b.glamour);}
    if(folder){await page.addStyleTag({content:'.dev-explorer{display:none!important}'});await page.screenshot({path:`${folder}/${variant}-${name}.jpg`,quality:90});}
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.__decorScene.reducedMotion);await page.waitForTimeout(100);const still=await sample(page,x);await page.waitForTimeout(240);const after=await sample(page,x);
    assert.equal(still.flame,after.flame);if(variant==='gold')assert.deepEqual(still.glamour,after.glamour);
    if(name==='desktop'){
     await page.emulateMedia({reducedMotion:'no-preference'});await button.focus();await page.keyboard.press('Enter');
     await page.waitForFunction(()=>window.__decorScene.dragonMeal!==null);
     await page.waitForFunction(()=>window.__pixiApp.stage.getChildByLabel('dragon-meal',true)?.texture.frame.y===512);
     assert.ok((await page.evaluate(()=>window.__pixiApp.stage.getChildByLabel('dragon-meal',true).texture.source.label)).endsWith(DRAGON_VARIANTS[variant].art));
     await page.waitForFunction(()=>window.__decorScene.dragonMeal===null&&!window.__decorScene.heroEffects.has('test'));
    }
    assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),saved);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
});
