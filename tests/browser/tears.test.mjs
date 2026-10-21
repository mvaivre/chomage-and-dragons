import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3000';

test('the near weeping monument keeps its footing, moving water and readable hero',{timeout:100000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 for(const[name,width,height]of[['desktop',1280,800],['mobile',390,844],['wide',2400,900]])await t.test(name,async()=>{
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const at=new Date().toISOString();localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');
   localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at}],events:Array.from({length:45},(_,i)=>({id:`a${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));
  });
  await page.goto(`${url}/local?debug&hour=12`);
  await page.waitForFunction(()=>window.__pixiApp&&document.querySelector('.action-button--refus')&&!document.querySelector('.action-button--refus').disabled);
  await page.evaluate(()=>{window.__decorScene.exploreCenter=13600;window.__decorScene.pan=0;});
  await page.waitForFunction(()=>window.__pixiApp.stage.getChildByLabel('tears-stone',true)?.texture.width===1024&&window.__pixiApp.stage.getChildByLabel('statue-of-tears:13600',true)?.visible&&Math.abs(window.__decorScene.camera.x+window.__decorScene.camera.viewW/2-13600)<3);
  const saved=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));
  const sample=()=>page.evaluate(()=>{
   const stage=window.__pixiApp.stage,root=stage.getChildByLabel('statue-of-tears:13600',true),art=root.getChildByLabel('tears-art',true),stone=root.getChildByLabel('tears-stone',true),water=root.getChildByLabel('tears-water',true),s=window.__decorScene,c=s.camera;
   const position=root.getGlobalPosition();
   return {root:[root.x,root.y,root.visible],scale:art.scale.y,stone:[stone.x,stone.y,stone.rotation],water:JSON.stringify(water.context.instructions.slice(0,8).map(i=>i.data.path?.instructions)),base:position.y,top:position.y-art.scale.y*1469*c.scale,header:s.topInset,dock:c.viewH*c.scale-s.bottomInset,hero:s.heroes.get('test'),count:stage.getChildrenByLabel(/^statue-of-tears:/,true).filter(n=>n.visible).length};
  });
  const first=await sample();await page.waitForTimeout(600);const second=await sample();
  assert.equal(first.count,1);assert.ok(first.scale*1469>250);assert.ok(first.top>=first.header+8);assert.ok(first.base<first.dock-20);
  assert.notEqual(first.water,second.water);assert.deepEqual(first.root,second.root);assert.deepEqual(first.stone,second.stone);assert.deepEqual(first.hero,second.hero);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);const still=await sample();await page.waitForTimeout(650);assert.equal((await sample()).water,still.water);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!window.__decorScene.reducedMotion);await page.waitForTimeout(400);assert.notEqual((await sample()).water,still.water);
  await page.evaluate(()=>{window.__decorScene.exploreCenter=15200;});
  await page.waitForFunction(()=>!window.__pixiApp.stage.getChildByLabel('statue-of-tears:13600',true)?.visible);
  assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),saved);
  assert.deepEqual(errors,[]);await context.close();
 });
});
