import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
registerHooks({resolve(s,c,next){if(s.startsWith('@/'))return next(new URL(`../../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {BIOME_RESIDENTS,BIOME_GESTURES}=await import('../../src/lib/game/biome-residents.ts');
const {environmentSites}=await import('../../src/lib/game/environment.ts');
const {WORLD_LENGTH,WALKABLE_GROUND_Y}=await import('../../src/lib/game/world.ts');
const {JOURNEY_TARGET}=await import('../../src/lib/config.ts');
const url=process.env.GAME_TEST_URL??'http://localhost:3000';
const sites=environmentSites(0,WORLD_LENGTH,1);
const sizes=[['desktop',{width:1280,height:720}],['mobile',{width:390,height:844}],['wide',{width:1920,height:1080}]];
const folder=process.env.BIOME_SCREENSHOTS;

test('each biome renders its own animated resident with grounded feet and working interaction',{timeout:180000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 t.after(()=>browser.close());if(folder)await mkdir(folder,{recursive:true});
 for(const[kind,profile]of Object.entries(BIOME_RESIDENTS).filter(([kind])=>!process.env.BIOME_ONLY||kind===process.env.BIOME_ONLY))await t.test(kind,async()=>{
  const site=sites.find(s=>s.kind===kind),count=Math.round((site.x+80)/WORLD_LENGTH*JOURNEY_TARGET/2);
  const context=await browser.newContext({viewport:sizes[0][1]}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(count=>{
   const at=new Date().toISOString();localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');
   localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'skater',joinedAt:at}],events:Array.from({length:count},(_,i)=>({id:`a${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));
  },count);
  try{
   await page.goto(`${url}/local?debug&hour=12`);await page.waitForFunction(()=>window.__decorScene&&window.__pixiApp&&!document.querySelector('.action-button--refus')?.disabled);
   const saved=await page.evaluate(()=>localStorage.getItem('louchomage:v2'));
   for(const[name,viewport]of sizes){
    await page.setViewportSize(viewport);
    await page.evaluate(x=>{window.__decorScene.exploreCenter=x;window.__decorScene.pan=0;},site.x);
    const label=`biome-resident:${kind}:${site.x}`;
    await page.waitForFunction(label=>window.__pixiApp.stage.getChildByLabel(label,true)?.getChildByLabel(`biome-body:${label.split(':')[1]}`,true)?.texture.width>1,label);
    await page.waitForTimeout(650);
    const inspect=()=>page.evaluate(({label,kind})=>{const root=window.__pixiApp.stage.getChildByLabel(label,true),node=root.getChildByLabel(`biome-body:${kind}`,true),camera=window.__decorScene.camera;
     return {y:node.y,anchor:node.anchor.y*node.texture.orig.height,rotation:node.rotation,source:node.texture.source.label,
      foot:node.getGlobalPosition().y,ground:camera.screenOffsetY+(node.y-camera.y)*camera.scale,
      pose:node.texture.frame.x/384+node.texture.frame.y/384*2,scale:node.scale.y};
    },{label,kind});
    const standing=await inspect();assert.equal(standing.y,WALKABLE_GROUND_Y+10);assert.equal(standing.anchor,356);assert.equal(standing.rotation,0);
    assert.ok(Math.abs(standing.foot-standing.ground)<1,`${kind} ${name} ground contact`);assert.match(standing.source,new RegExp(`biome-${kind}(?:-v2|-gestures)?\\.webp$`));
    if(folder)await page.screenshot({path:`${folder}/${kind}-${name}.png`});
    if(name==='mobile'){
     const button=page.locator(`[data-environment-id="${site.id}"]`);await button.waitFor({state:'visible'});
     // A tall resident's centre can be covered by the hero in the nearer lane.
     await button.click(kind==='yeti'?{position:{x:20,y:20}}:{});
     await page.locator('.environment-speech').waitFor();
     const reactionPose=BIOME_GESTURES[kind]?1:3;
     await page.waitForFunction(({label,kind,pose,gestures})=>{const n=window.__pixiApp.stage.getChildByLabel(label,true).getChildByLabel(`biome-body:${kind}`,true);return n.texture.frame.x/384+n.texture.frame.y/384*2===pose&&(!gestures||n.texture.source.label.includes('gestures'))&&n.alpha>.99;},{label,kind,pose:reactionPose,gestures:Boolean(BIOME_GESTURES[kind])});
     assert.equal((await inspect()).y,standing.y);await page.getByRole('button',{name:'Fermer le dialogue',exact:true}).click();
     await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
     const a=await inspect();await page.waitForTimeout(150);const b=await inspect();
     assert.equal(a.scale,b.scale);assert.equal(b.pose,reactionPose);await page.emulateMedia({reducedMotion:'no-preference'});
    }
   }
   assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),saved);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
});
