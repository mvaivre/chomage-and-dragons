import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3100';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('Entry tests require an isolated localhost server.');
const launch = () => chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});

test('the first visit offers both worlds before loading a renderer, remembers the choice and keeps progress', {timeout:180000}, async t => {
  const browser=await launch();t.after(()=>browser.close());await mkdir('/tmp/louchomage-entry',{recursive:true});
  for(const [width,height,mode] of [[320,568,'2d'],[390,844,'3d'],[844,390,'2d'],[1280,800,'2d'],[1920,1080,'3d']]) {
    const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      if(localStorage.getItem('fixture'))return;localStorage.setItem('fixture','1');
      // An old automatically saved preference must not bypass the first explicit choice.
      localStorage.setItem('louchomage:renderer:v1','2d');
      const at=new Date().toISOString();
      localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Camille',characterId:'barde',joinedAt:at}],events:[{id:'first',playerId:'test',kind:'candidature',at}],casts:[]}));
      localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');
    });
    await page.goto(`${url}/local?debug&hour=12`);
    await page.getByRole('dialog',{name:'Choisis ton univers'}).waitFor();
    assert.equal(await page.locator('canvas').count(),0);
    assert.equal(await page.locator('.game-adventure').count(),0);
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').isVisible(),true);
    await page.screenshot({path:`/tmp/louchomage-entry/choice-${width}.png`});
    for(const dimension of ['2D','3D']) {
      const bounds=await page.getByRole('button',{name:new RegExp(`Entrer en ${dimension}`)}).evaluate(element=>{
        const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight};
      });
      assert.ok(bounds.top>=0&&bounds.bottom<=bounds.height&&bounds.left>=0&&bounds.right<=bounds.width,JSON.stringify(bounds));
    }
    if(width===1280) { await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); }
    else await page.getByRole('button',{name:new RegExp(`Entrer en ${mode.toUpperCase()}`)}).click();
    await page.waitForFunction(mode=>window.__worldView?.().phase==='ready'&&window.__worldView().mode===mode,mode);
    const saved=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:renderer-choice:v1')),'1');
    const other=mode==='2d'?'3d':'2d';
    await page.getByRole('button',{name:other.toUpperCase(),exact:true}).click();
    await page.waitForFunction(mode=>window.__worldView?.().phase==='ready'&&window.__worldView().mode===mode,other);
    assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),saved);
    await page.reload();await page.waitForFunction(mode=>window.__worldView?.().phase==='ready'&&window.__worldView().mode===mode,other);
    assert.equal(await page.getByRole('dialog',{name:'Choisis ton univers'}).count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),saved);
    assert.deepEqual(errors,[]);await context.close();
  }
});

test('choosing 3D still works when local storage is blocked', {timeout:60000}, async t => {
  const browser=await launch();t.after(()=>browser.close());const page=await browser.newPage();
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','SecurityError');};});
  await page.goto(`${url}/local?debug`);
  await page.getByRole('button',{name:/Entrer en 3D/}).click();
  await page.waitForFunction(()=>window.__worldView?.().phase==='ready'&&window.__worldView().mode==='3d');
  await page.getByPlaceholder('Mika').waitFor();
});

test('the landing prunes confirmed missing groups, retaining signed-out or temporarily unavailable groups and solo data', {timeout:60000}, async t => {
  const browser=await launch();t.after(()=>browser.close());const page=await browser.newPage();
  await page.addInitScript(()=>{
    if(localStorage.getItem('fixture'))return;localStorage.setItem('fixture','1');
    localStorage.setItem('louchomage:groupes:v1',JSON.stringify([{slug:'gone-000000',name:'Ancien groupe'},{slug:'keep-000000',name:'Groupe conservé'},{slug:'retry-000000',name:'Groupe à réessayer'}]));
    localStorage.setItem('louchomage:jeton:gone-000000','obsolete');localStorage.setItem('louchomage:moi:gone-000000','old-player');
    localStorage.setItem('louchomage:jeton:keep-000000','keep-token');localStorage.setItem('louchomage:v2','solo-progress');localStorage.setItem('louchomage:moi:v1','solo-player');
  });
  await page.route('**/api/groups/keep-000000',route=>route.fulfill({status:401,body:'{}'}));
  await page.route('**/api/groups/retry-000000',route=>route.fulfill({status:500,body:'{}'}));
  await page.goto(url);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('louchomage:groupes:v1')).length===2);
  assert.equal(await page.getByRole('button',{name:'Ancien groupe',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Groupe conservé',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Groupe à réessayer',exact:true}).count(),1);
  const stored=await page.evaluate(()=>({...localStorage}));
  assert.equal(stored['louchomage:jeton:gone-000000'],undefined);assert.equal(stored['louchomage:moi:gone-000000'],undefined);
  assert.equal(stored['louchomage:jeton:keep-000000'],'keep-token');assert.equal(stored['louchomage:v2'],'solo-progress');assert.equal(stored['louchomage:moi:v1'],'solo-player');
});

test('old game and invitation URLs return home and clean only their own saved references', {timeout:60000}, async t => {
  const browser=await launch();t.after(()=>browser.close());
  for(const suffix of ['', '/rejoindre']) {
    const context=await browser.newContext();const page=await context.newPage();
    await page.addInitScript(()=>{
      if(localStorage.getItem('fixture'))return;localStorage.setItem('fixture','1');
      localStorage.setItem('louchomage:groupes:v1',JSON.stringify([{slug:'gone-000000',name:'Ancien groupe'}]));
      localStorage.setItem('louchomage:jeton:gone-000000','obsolete');localStorage.setItem('louchomage:v2','solo-progress');
    });
    await page.goto(`${url}/g/gone-000000${suffix}`);await page.waitForURL(`${url}/`);
    await page.getByRole('heading',{name:'Créer un groupe',exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:groupes:v1'))),[]);
    assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:jeton:gone-000000')),null);
    assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),'solo-progress');await context.close();
  }
});
