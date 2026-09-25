import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';
registerHooks({resolve(s,c,n){return n(s.startsWith('@/')?new URL(`../../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);}});
const {decorEventAt}=await import('../../src/lib/game/decor-events.ts');
const url=process.env.GAME_TEST_URL??'http://localhost:3100';

test('decor rooms, motion preferences and rare events work in the actual renderer',{timeout:120000},async t=>{
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:process.env.PLAYWRIGHT_WEBGL==='metal'?['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 t.after(()=>browser.close());
 async function fixture(step){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(step=>{const at=new Date().toISOString();localStorage.setItem('chomage:welcome:steps-v1','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at}],events:Array.from({length:step/2},(_,i)=>({id:`d-${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));},step);
  await page.goto(`${url}/local?debug&hour=22&variant=classic`);
  await page.waitForFunction(()=>window.__decorScene&&window.__pixiApp&&!document.querySelector('.action-button--refus')?.disabled);
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{window.__decorFind=prefix=>{const nodes=[];const visit=n=>{if(n.label?.startsWith(prefix))nodes.push(n);n.children?.forEach(visit);};visit(window.__pixiApp.stage);return nodes;};});
  return {context,page,errors};
 }
 for(const[id,step]of [['orp',14],['factory',34]]) await t.test(`${id} keeps its occupants and freezes decorative motion`,async()=>{
   const{context,page,errors}=await fixture(step);
   await page.waitForFunction(id=>window.__decorFind(`interior:${id}`).length>0,id);
   await page.waitForFunction(id=>window.__decorFind(`npc:${id}:0`).some(n=>n.texture?.width>1),id);
   assert.equal(await page.evaluate(()=>window.__decorScene.heroes.get('test')?.y),606);
   if(id==='factory'){
    const y=await page.evaluate(()=>window.__decorFind('prop:factory:2')[0]?.y);
    await page.waitForFunction(y=>Math.abs(window.__decorFind('prop:factory:2')[0]?.y-y)>10,y,{timeout:6000});
   }
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(120);
   const first=await page.evaluate(id=>window.__decorFind(`npc:${id}`).map(n=>[n.x,n.y,n.texture.uid]),id);
   await page.waitForTimeout(800);
   assert.deepEqual(await page.evaluate(id=>window.__decorFind(`npc:${id}`).map(n=>[n.x,n.y,n.texture.uid]),id),first);
   if(id==='factory'){
    const first=await page.evaluate(()=>window.__decorFind('prop:factory:2').map(n=>[n.y,n.rotation]));
    assert.ok(first.length);await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(()=>window.__decorFind('prop:factory:2').map(n=>[n.y,n.rotation])),first);
   }
   const audio=await page.evaluate(async id=>{const b=await window.__musicPreview(id,12);const v=b.getChannelData(0);return{peak:Math.max(...v.filter((_,i)=>i%20===0)),finite:v.every(Number.isFinite)};},id);
   assert.ok(audio.finite&&audio.peak>0&&audio.peak<1);
   assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('the office sign lights only on quiet nights and the mirage fades nearby',async()=>{
  const{context,page,errors}=await fixture(180);
  await page.evaluate(()=>{Date.now=()=>84e3;});
  await page.waitForFunction(()=>window.__decorFind('night-office')[0]?.children[0]?.visible);
  await page.evaluate(()=>{window.__decorScene.momentActive=true;});
  await page.waitForFunction(()=>!window.__decorFind('night-office')[0]?.children[0]?.visible);
  await page.evaluate(()=>{window.__decorScene.momentActive=false;});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!window.__decorFind('night-office')[0]?.children[0]?.visible);
  assert.deepEqual(errors,[]);await context.close();
  const desert=await fixture(148);
  await desert.page.waitForFunction(()=>window.__decorFind('setpiece:desert')[0]?.alpha>.8);
  await desert.page.locator('.action-button--refus').click();
  await desert.page.waitForFunction(()=>window.__decorFind('setpiece:desert')[0]?.alpha<.15,null,{timeout:15000});
  assert.deepEqual(desert.errors,[]);await desert.context.close();
 });
 await t.test('each rare event yields to an action and to reduced motion',async()=>{
  const{context,page,errors}=await fixture(60);
  const focus=await page.evaluate(()=>window.__decorScene.focus);
  for(const kind of ['cv','pigeon','cloud']){
   let selected;for(let s=0;s<9000;s++){const e=decorEventAt(focus,s);if(e.active&&e.kind===kind&&e.phase>.4&&e.phase<.6){selected=s;break;}}
   assert.notEqual(selected,undefined);
   await page.evaluate(s=>{Date.now=()=>s*1000;window.__decorScene.momentActive=false;},selected);
   await page.waitForFunction(()=>window.__decorFind('decor-events')[0]?.visible);
   await page.evaluate(()=>{window.__decorScene.momentActive=true;});
   await page.waitForFunction(()=>!window.__decorFind('decor-events')[0]?.visible);
  }
  await page.evaluate(()=>{window.__decorScene.momentActive=false;});await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!window.__decorFind('decor-events')[0]?.visible);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>window.__decorFind('decor-events')[0]?.visible);
  await page.locator('.action-button--refus').click();
  await page.waitForFunction(()=>window.__decorScene.momentActive&&!window.__decorFind('decor-events')[0]?.visible);
  assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('entering the ORP announces the room after travel',async()=>{
  const{context,page,errors}=await fixture(6);
  await page.locator('.action-button--refus').click();
  await page.locator('.moment-banner').filter({hasText:'Centre ORP'}).waitFor({timeout:15000});
  assert.deepEqual(errors,[]);await context.close();
 });
});
