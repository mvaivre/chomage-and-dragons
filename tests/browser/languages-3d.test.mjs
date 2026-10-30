import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3100';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname))throw Error('Use an isolated local server.');
const {t:translate}=await import('../../src/lib/i18n/index.ts');
const launch=()=>chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const ready=(page,mode)=>page.waitForFunction(mode=>window.__worldView?.().phase==='ready'&&window.__worldView().mode===mode,mode,{timeout:60000});
const save=page=>page.evaluate(()=>localStorage.getItem('louchomage:v2'));

test('the entry selects all five languages before either renderer loads and retains the choice', {timeout:180000},async t=>{
 const browser=await launch();t.after(()=>browser.close());await mkdir('/tmp/louchomage-languages',{recursive:true});
 for(const [locale,heading] of [['fr','Choisis ton univers'],['de','Wähle deine Welt'],['en','Choose your world'],['es','Elige tu mundo'],['it','Scegli il tuo mondo']]){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${url}/local?debug&hour=12`);await page.locator('.language-picker select').selectOption(locale);
  await page.getByRole('heading',{name:heading,exact:true}).waitFor();assert.equal(await page.locator('canvas').count(),0);
  for(const [width,height]of [[320,568],[844,390],[390,844]]) {
   await page.setViewportSize({width,height});
   for(const option of await page.locator('.world-choice__option').all())assert.ok(await option.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),`${locale} ${width} choice fits`);
  }
  await page.screenshot({path:`/tmp/louchomage-languages/entry-${locale}.png`});
  const mode=locale==='en'||locale==='es'?'2d':'3d';await page.locator(`.world-choice__option`).nth(mode==='2d'?0:1).click();
  await ready(page,mode);await page.getByPlaceholder('Mika').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.lang),locale);
  assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:language:v1')),locale);
  await page.screenshot({path:`/tmp/louchomage-languages/characters-${locale}-${mode}.png`,fullPage:true});
  await page.reload();await ready(page,mode);assert.equal(await page.locator('.world-choice').count(),0);if(locale!=='fr') {
   await page.getByPlaceholder('Mika').fill('Courage');await page.locator('.hero-confirm').click();
   await page.locator('.initiation-close').click();await page.locator('.journey-card').waitFor();
   assert.notEqual(await page.locator('.journey-card__place').innerText(),'Plaine de la Poisse');
   assert.equal(await page.locator('.journey-card__stats dt').first().textContent(),translate('Pas',undefined,locale));
   assert.equal(await page.locator('.journey-card__stats dt').first().evaluate(el=>getComputedStyle(el,'::after').content),'none');
   assert.ok((await page.locator('.journey-card__identity').innerText()).includes('Courage'));
   if(mode==='3d')assert.equal(await page.locator('[data-player-id]').first().innerText(),'Courage');
   await page.screenshot({path:`/tmp/louchomage-languages/world-${locale}-${mode}.png`});
   const journal=await save(page);await page.locator('.journey-card__menu').click();await page.locator('.adventure-menu__tabs button').nth(1).click();
   await page.locator('.adventure-menu__games button').nth(2).click();await page.locator('.mini-game canvas').waitFor();
   await page.screenshot({path:`/tmp/louchomage-languages/keywords-${locale}.png`});
   assert.equal(await save(page),journal);await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);await context.close();
 }
});

test('3D portraits turn, all three tutorial scenes are models, and every playable game renders meshes without changing the journal', {timeout:300000},async t=>{
 const browser=await launch();t.after(()=>browser.close());const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await mkdir('/tmp/louchomage-full-3d',{recursive:true});
 await page.addInitScript(()=>{localStorage.setItem('louchomage:renderer-choice:v1','1');localStorage.setItem('louchomage:renderer:v1','3d');localStorage.setItem('louchomage:language:v1','fr');});
 await page.goto(`${url}/local?debug&hour=12`);await ready(page,'3d');
 await page.waitForFunction(()=>Number(document.querySelector('.hero-preview canvas')?.dataset.triangles)>100);
 const rotation=await page.locator('.hero-preview canvas').getAttribute('data-rotation');
 await page.getByRole('button',{name:'Tourner le personnage à droite',exact:true}).click();await page.waitForFunction(before=>document.querySelector('.hero-preview canvas')?.dataset.rotation!==before,rotation);
 const studios=await page.locator('.character-screen canvas[data-studio]').evaluateAll(nodes=>new Set(nodes.map(n=>n.dataset.studio)).size);assert.equal(studios,1);
 await page.screenshot({path:'/tmp/louchomage-full-3d/characters.png'});
 await page.getByPlaceholder('Mika').fill('Courage');await page.getByRole('button',{name:'Entrer dans la partie',exact:true}).click();
 const before=await save(page);
 for(const [stage,actions] of [['road',['Essayer une candidature · +2 pas','Découvrir les coffres →']],['treasure',['Ouvrir le coffre','Essayer le pouvoir','Voyager ensemble →']],['company',['Commencer le voyage']]]){
  await page.waitForFunction(()=>Number(document.querySelector('.initiation-scene--3d canvas')?.dataset.triangles)>100);
  for(const [width,height] of [[390,844],[1920,1080],[1280,800]]) {
   await page.setViewportSize({width,height});
   assert.ok(await page.locator('.initiation-primary').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
   await page.screenshot({path:`/tmp/louchomage-full-3d/tutorial-${stage}-${width}.png`});
  }
  for(const name of actions)await page.getByRole('button',{name,exact:true}).click();
 }
 await page.locator('.initiation-card').waitFor({state:'detached'});assert.equal(await save(page),before);
 for(let i=0;i<12;i++){
  if(!await page.locator('.adventure-menu[open]').count())await page.locator('.journey-card__menu').click();
  await page.getByRole('button',{name:'Quêtes',exact:true}).click();await page.locator('.adventure-menu__games button').nth(i).click();
  const game=page.locator('.mini-game[open]');await game.waitFor();const canvas=game.locator('canvas').first();await canvas.waitFor();
  await page.waitForFunction(()=>document.querySelector('.mini-game canvas')?.width>100);
  assert.equal(await canvas.evaluate(c=>Boolean(c.getContext('webgl2'))),true,`3D game ${i}`);
  await page.screenshot({path:`/tmp/louchomage-full-3d/game-${i}.png`});
  const start=game.locator('.mini-game__primary');if(await start.isEnabled())await start.click();
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');
  await page.keyboard.press('Escape');await page.locator('.adventure-menu[open]').waitFor();assert.equal(await save(page),before);
 }
 await page.getByRole('button',{name:'Fermer le carnet',exact:true}).click();
 await page.getByRole('button',{name:'2D',exact:true}).click();await ready(page,'2d');
 assert.equal(await page.locator('.voxel-portrait').count(),0);assert.equal(await save(page),before);
 assert.ok(await page.evaluate(()=>Object.values(window.__worldView().lastRelease).every(v=>v===0)));
 assert.deepEqual(errors,[]);await context.close();
});

test('animated dialogue translates the complete sentence before typing its letters', {timeout:90000},async t=>{
 const browser=await launch();t.after(()=>browser.close());
 for(const locale of ['en','de','es','it']) {
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  await page.addInitScript(locale=>{
   localStorage.setItem('louchomage:renderer-choice:v1','1');localStorage.setItem('louchomage:renderer:v1','2d');localStorage.setItem('louchomage:language:v1',locale);
   const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');
   localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Courage',characterId:'barde',joinedAt:at}],events:[0,1].map(i=>({id:`seed-${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));
  },locale);
  await page.goto(`${url}/local?debug&hour=12`);await ready(page,'2d');
  await page.getByRole('button',{name:translate('Saluer le hérisson',undefined,locale),exact:true}).first().click();
  const speech=page.locator('.travel-speech');await speech.waitFor();const full=await speech.getAttribute('data-line');
  await speech.locator('.travel-speech__continue').click();
  assert.equal(await speech.locator('[aria-hidden="true"]').textContent(),full);
  assert.equal(await speech.locator('.sr-only').textContent(),full);
  await page.screenshot({path:`/tmp/louchomage-languages/dialogue-${locale}.png`});await context.close();
 }
});
