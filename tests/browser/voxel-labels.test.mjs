import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3000';
test('player names follow every rendered camera frame without layout or React churn',{timeout:90000},async t=>{
 const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>b.close());
 for(const mobile of [false,true]){
  const c=await b.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile}),p=await c.newPage();
  await p.addInitScript(()=>{const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'barde',joinedAt:at}],events:Array.from({length:22},(_,i)=>({id:`seed-${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));});
  await p.goto(`${url}/local?debug&hour=12`);await p.waitForFunction(()=>window.__voxelWorld?.ready&&!document.querySelector('.action-button--refus')?.disabled);await p.waitForTimeout(1200);
  const save=await p.evaluate(()=>localStorage.getItem('louchomage:v2'));
  const session=await c.newCDPSession(p);await session.send('Performance.enable');const before=(await session.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value;
  await p.getByRole('button',{name:'Rapprocher la caméra',exact:true}).click();
  const result=await p.evaluate(()=>new Promise(resolve=>{
   const node=document.querySelector('.voxel-name.is-me'),start=performance.now(),original=node;let lastFrame=-1,lastPosition='',frames=0,updated=0;
   let childMutations=0;const observer=new MutationObserver(records=>{childMutations+=records.length;});observer.observe(node,{childList:true,subtree:true});
   function sample(){const f=window.__voxelWorld.performance.frames,style=node.style.cssText;if(f!==lastFrame){if(lastFrame>=0){frames++;if(style!==lastPosition)updated++;}lastFrame=f;lastPosition=style;}
    if(performance.now()-start<650)requestAnimationFrame(sample);else {const mutations=observer.takeRecords();observer.disconnect();resolve({frames,updated,reused:original===document.querySelector('.voxel-name.is-me'),childMutations:childMutations+mutations.length});}}
   requestAnimationFrame(sample);
  }));
  assert.ok(result.frames>=8);assert.ok(result.updated/result.frames>.8,`${mobile?'mobile':'desktop'}: label updated on only ${result.updated}/${result.frames} rendered frames`);assert.equal(result.reused,true);assert.equal(result.childMutations,0,'name text is not rerendered during movement');
  const layouts=(await session.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value-before;assert.ok(layouts<=3,`camera motion caused ${layouts} layouts`);
  const scans=await p.evaluate(()=>window.__voxelWorld.performance.targetScans);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>window.__voxelWorld.performance.targetScans),scans,'unchanged scenery is not traversed again');
  console.log({mobile,...result,layouts});
  assert.equal(await p.evaluate(()=>localStorage.getItem('louchomage:v2')),save);await c.close();
 }
});
