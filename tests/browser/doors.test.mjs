import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3123';

test('welcome and room travel work with the saved game',{timeout:150000},async t=>{
 const browser=await chromium.launch({timeout:30000,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 t.after(()=>browser.close());
 async function fixture(steps,welcome=false){
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({steps,welcome})=>{
   if(localStorage.getItem('louchomage:v2'))return;
   const at=new Date().toISOString();if(!welcome)localStorage.setItem('chomage:welcome:steps-v1','seen');
   localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at},{id:'lou',name:'Lou',characterId:'barde',joinedAt:at}],events:Array.from({length:steps/2},(_,i)=>({id:`s${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));
  },{steps,welcome});
  await page.goto(`${url}/local?debug&hour=12&variant=classic`);
  await page.waitForFunction(()=>window.__decorScene?.heroes.has('test'));
  if(!welcome)await page.waitForFunction(()=>!document.querySelector('.action-button--refus')?.disabled);
  return{page,context,errors};
 }
 async function watch(page){await page.evaluate(()=>{
  window.__doorSamples=[];window.__recordDoors=true;
  const sample=()=>{const s=window.__decorScene;window.__doorSamples.push({x:s.heroes.get('test')?.x,room:s.room?.id??null,fade:s.doorTransition?{...s.doorTransition}:null});if(window.__recordDoors)requestAnimationFrame(sample);};sample();
 });}
 async function assertArrival(page,steps,room){
  const x=steps*30240/200-80;
  await page.waitForFunction(({x,room})=>Math.abs((window.__decorScene?.heroes.get('test')?.x??Infinity)-x)<.5&&!window.__decorScene.doorTransition&&(window.__decorScene.room?.id??null)===room,{x,room},{timeout:15000});
 }
 await t.test('one brief welcome, keyboard isolation, persistence and reopenable help',async()=>{
  const{page,context,errors}=await fixture(0,true);
  const dialog=page.getByRole('dialog',{name:'Les refus font avancer.'});await dialog.waitFor();
  await page.keyboard.press('2');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')).events.length),0);
  assert.ok((await dialog.innerText()).includes('+3 pas'));
  await dialog.getByRole('button',{name:'C’est parti !'}).click();await page.reload();
  await page.waitForFunction(()=>!document.querySelector('.action-button--refus')?.disabled);
  assert.equal(await page.locator('.welcome-card').count(),0);
  await page.getByRole('button',{name:'Aide',exact:true}).click();await dialog.waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('an action crosses the entrance, pauses for the fade and completes all steps; undo returns outside',async()=>{
  const{page,context,errors}=await fixture(6);await watch(page);
  await page.locator('.action-button--refus').click();await assertArrival(page,9,'orp');
  const samples=await page.evaluate(()=>{window.__recordDoors=false;return window.__doorSamples;});
  const faded=samples.filter(s=>s.fade);assert.ok(faded.length>3,'fade spans several frames');
  assert.ok(faded.some(s=>!s.fade.switched)&&faded.some(s=>s.fade.switched),'both scenes rendered under fade');
  assert.ok(Math.max(...faded.map(s=>s.x))-Math.min(...faded.map(s=>s.x))<.5,'feet wait at threshold');
  await page.reload();await assertArrival(page,9,'orp');
  await page.locator('.action-undo').click();await assertArrival(page,6,null);
  assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('a power observes a friend in another room, then returns to the original room',async()=>{
  const{page,context,errors}=await fixture(12);
  await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('louchomage:v2'));const at=new Date().toISOString();state.events.push(...Array.from({length:17},(_,i)=>({id:`lou-${i}`,playerId:'lou',kind:'candidature',at})));localStorage.setItem('louchomage:v2',JSON.stringify(state));});
  await page.reload();await assertArrival(page,12,'orp');
  await page.locator('.recap__close').click();
  await page.locator('.power-menu__trigger').click();await page.locator('.power-choice').first().click();await page.locator('.power-target').filter({hasText:'Lou'}).click();
  await page.waitForFunction(()=>window.__decorScene.room?.id==='factory'&&!window.__decorScene.doorTransition);
  await page.waitForFunction(()=>window.__decorScene.room?.id==='orp'&&!window.__decorScene.doorTransition,null,{timeout:10000});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')).events.length),23);
  assert.deepEqual(errors,[]);await context.close();
 });
 await t.test('exit leaves the building to the left and reverse travel re-enters, including reduced motion',async()=>{
  const{page,context,errors}=await fixture(18);
  await page.locator('.action-button--candidature').click();await assertArrival(page,20,null);
  const exit=await page.evaluate(()=>{let found;const walk=n=>{if(n.label==='building:orp:exit')found=n;n.children?.forEach(walk);};walk(window.__pixiApp.stage);return found?{x:found.x,visible:found.visible}:null;});
  assert.ok(exit?.visible&&exit.x<20*30240/200-80);
  await page.reload();await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.action-button--entretien').click();await assertArrival(page,17,'orp');
  assert.deepEqual(errors,[]);await context.close();
 });
});
