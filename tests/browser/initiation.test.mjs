import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3000';
test('the short rites fit mobile, restore progress, animate their examples and leave the journal intact',{timeout:60000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await p.addInitScript(()=>{if(localStorage.getItem('louchomage:v2'))return;const at=new Date().toISOString();localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'demon',joinedAt:at}],events:[],casts:[]}));});
 await p.goto(`${url}/local?debug`);await p.waitForFunction(()=>document.querySelector('.rite-scene canvas')?.dataset.model==='demon');
 const journal=()=>p.evaluate(()=>localStorage.getItem('louchomage:v2'));const before=await journal();
 for(const [w,h]of [[390,844],[320,568],[844,390],[1440,960]]) {await p.setViewportSize({width:w,height:h});assert.ok(await p.locator('.initiation-card').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&n.scrollWidth<=n.clientWidth;}));assert.ok(await p.locator('.initiation-primary').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));}
 await p.setViewportSize({width:390,height:844});
 await p.getByRole('button',{name:'Essayer une candidature · +2 pas',exact:true}).tap();
 assert.equal(await p.locator('.initiation-primary').isDisabled(),true,'the brief motion plays before the next action');
 await p.getByRole('button',{name:'Découvrir les coffres →'}).tap();await p.getByRole('button',{name:'Ouvrir le coffre',exact:true}).tap();
 await p.reload();await p.getByRole('button',{name:'Essayer le pouvoir',exact:true}).waitFor();
 assert.equal(await p.locator('.rite-scene').getAttribute('data-scene'),'treasure');
 await p.getByRole('button',{name:'Essayer le pouvoir',exact:true}).tap();await p.getByRole('button',{name:'Voyager ensemble →'}).tap();
 assert.equal(await p.locator('.rite-scene').getAttribute('data-scene'),'company');
 assert.equal(await p.locator('.initiation-card').getByRole('button').count(),4,'one action, close, skip and restart; no quiz');
 await p.getByRole('button',{name:'Commencer le voyage',exact:true}).tap();await p.locator('.initiation-card').waitFor({state:'detached'});assert.equal(await journal(),before);
 await p.getByRole('button',{name:/Ouvrir le carnet/}).click();await p.getByRole('button',{name:'Quêtes',exact:true}).click();await p.locator('.adventure-menu__initiation').click();
 await p.getByRole('button',{name:'Essayer une candidature · +2 pas',exact:true}).waitFor();await p.keyboard.press('Escape');await p.locator('.initiation-card').waitFor({state:'detached'});assert.equal(await journal(),before);
 assert.deepEqual(errors,[]);
});
