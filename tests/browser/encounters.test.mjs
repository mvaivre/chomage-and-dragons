import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3100';
const output = '/tmp/louchomage-encounters';

const seed = (count=2) => {
  const at=new Date().toISOString();
  return {players:[{id:'test',name:'Mika',characterId:'barde',joinedAt:at}],events:Array.from({length:count},(_,i)=>({id:`seed-${i}`,playerId:'test',kind:'candidature',at})),casts:[]};
};

test('wild encounters, captures, reloads and roadside games on desktop and mobile', {timeout:180000}, async t => {
  await mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  t.after(()=>browser.close());
  async function fixture(viewport, count=2, saved=null, motion="reduce") {
    const context=await browser.newContext({viewport,reducedMotion:motion}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(state=>{
      if(localStorage.getItem('louchomage:v2'))return;
      localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');
      localStorage.setItem('louchomage:moi:v1','test');
      localStorage.setItem('louchomage:v2',JSON.stringify(state));
    },saved??seed(count));
    await page.goto(`${url}/local?debug&profile&hour=12`);
    await page.waitForFunction(()=>window.__voxelWorld?.ready);
    return {context,page,errors};
  }
  const saved = page=>page.evaluate(()=>JSON.parse(localStorage.getItem('louchomage:v2')));
  await t.test('object reveal precedes the choice pop; every battle move is directly available',async()=>{
    const state=seed(3);
    state.encounters=[{id:'seed-2-wild',playerId:'test',eventId:'seed-2',slot:2,monster:'ai',rare:false,place:'Plaine de la Poisse',at:new Date().toISOString(),status:'offered',hp:100,energy:100,turn:0,balls:3,braced:false,message:'Une IA sauvage apparaît !'}];
    const {context,page,errors}=await fixture({width:1280,height:850},3,state,'no-preference');
    try {
      await page.locator('.wild-encounter[data-entrance="reveal"][open]').waitFor();
      assert.equal(await page.getByRole('button',{name:'Relever le défi',exact:true}).count(),0,'the choices wait for the reveal');
      await page.waitForTimeout(550);await page.screenshot({path:`${output}/animated-ai-reveal.png`});
      await page.locator('.wild-encounter[data-entrance="ready"]').waitFor();
      await page.getByRole('button',{name:'Relever le défi',exact:true}).click();
      for(const name of ['Argument béton','Relance polie','Souffler','Chômageball']) assert.equal(await page.getByRole('button',{name:new RegExp('^'+name)}).isVisible(),true);
      assert.equal(await page.getByRole('button',{name:/^Agir|^← Retour/}).count(),0);
      await page.getByRole('button',{name:/^Relance polie/}).click();
      await page.waitForFunction(()=>!document.querySelector('.wild-encounter__commands button')?.disabled);
      assert.equal((await saved(page)).encounters[0].hp,82);
      await page.screenshot({path:`${output}/direct-battle-actions.png`});
      await page.keyboard.press('Escape');assert.equal((await saved(page)).encounters[0].status,'fled');assert.deepEqual(errors,[]);
    }finally{await context.close();}
  });
  await t.test('keyword briefing lists the seeded targets before a deliberate start, on desktop and mobile',async()=>{
    for(const viewport of [{width:1280,height:850},{width:320,height:568}]){
      const {context,page,errors}=await fixture(viewport,1);
      try {
        await page.getByRole('button',{name:/Ouvrir le carnet/}).click();
        await page.getByRole('button',{name:'Quêtes',exact:true}).click();
        await page.locator('.adventure-menu__games button').filter({hasText:'Le CV à mots-clés'}).click();
        await page.getByRole('heading',{name:'Les 5 mots à récupérer',exact:true}).waitFor();
        const expected=await page.locator('.keyword-briefing li').allTextContents();
        assert.equal(expected.length,5);assert.equal(new Set(expected).size,5);
        assert.equal(await page.locator('.mini-game__tags').count(),0,'a single clear briefing before play');
        await page.keyboard.press('ArrowRight');await page.waitForTimeout(500);
        assert.equal(await page.locator('.mini-game__arena').getAttribute('data-status'),'ready','reading has no time limit and arrows cannot accidentally start');
        await page.screenshot({path:`${output}/${viewport.width===320?'mobile':'desktop'}-keyword-briefing.png`});
        const fit=await page.locator('.mini-game').evaluate(n=>n.scrollWidth<=n.clientWidth+1);assert.equal(fit,true);
        await page.getByRole('button',{name:'Lancer le robot',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('.mini-game__arena')?.dataset.status==='running');
        assert.equal(await page.locator('.keyword-briefing').count(),0);
        assert.deepEqual(await page.locator('.mini-game__tags .mini-game__tag').allTextContents(),expected,'the same targets stay visible during play');
        await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
      }finally{await context.close();}
    }
  });
  for (const [name,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]) {
    await t.test(`${name}: real movement, battle, capture and collection`, async()=>{
      const {context,page,errors}=await fixture(viewport);
      try {
        await page.locator('.action-button--candidature').click();
        await page.locator('.wild-encounter[data-entrance="ready"][open]').waitFor();
        assert.equal(await page.locator('.mini-game-invite').count(),0);
        await page.screenshot({path:`${output}/${name}-offer.png`});
        const encounter=(await saved(page)).encounters[0];
        assert.equal(await page.locator('.voxel-world__canvas canvas').getAttribute('data-encounter'),encounter.monster);
        const events=JSON.stringify((await saved(page)).events);
        await page.getByRole('button',{name:'Relever le défi',exact:true}).click();
        await page.getByRole('button',{name:/^Argument béton/}).click();
        await page.getByRole('button',{name:/^Argument béton/}).waitFor({state:'visible'});
        await page.waitForFunction(()=>!document.querySelector('.wild-encounter__commands button')?.disabled);
        await page.reload();
        await page.locator('.wild-encounter[data-status="battle"][open]').waitFor();
        assert.equal((await saved(page)).encounters[0].hp,72,'resume weakened enemy without replay');
        for(let i=0;i<2;i++){
            await page.getByRole('button',{name:/^Argument béton/}).click();
          await page.waitForFunction(()=>!document.querySelector('.wild-encounter__commands button')?.disabled);
        }
        await page.screenshot({path:`${output}/${name}-battle.png`});
        await page.getByRole('button',{name:/^Chômageball/}).click();
        await page.getByRole('button',{name:'Voir ma collection',exact:true}).click();
        await page.getByRole('heading',{name:'Mes dossiers classés',exact:true}).waitFor();
        assert.equal((await saved(page)).encounters[0].status,'captured');
        assert.equal(JSON.stringify((await saved(page)).events),events,'combat does not create or change official actions');
        assert.equal(await page.locator('.capture-collection article[data-found="true"]').count(),1);
        await page.screenshot({path:`${output}/${name}-collection.png`});
        const overflow=await page.locator('.adventure-menu').evaluate(n=>n.scrollWidth>n.clientWidth+1);assert.equal(overflow,false);
        await page.keyboard.press('Escape');
        await page.reload();
        await page.waitForFunction(()=>!document.querySelector('.action-button--candidature')?.disabled);
        assert.equal(await page.locator('.wild-encounter').count(),0,'a completed capture never reopens on load');
        assert.deepEqual(errors,[]);
      } finally { await context.close(); }
    });
  }
  await t.test('all seven species and rare forms fit the smallest portrait, landscape and wide views',async()=>{
    for(const [i,monster] of ['cv','orp','chair','coffee','refusal','doubt','ai'].entries()) {
      const state=seed(3),e={id:'seed-2-wild',playerId:'test',eventId:'seed-2',slot:2,monster,rare:i%2===0,place:'Plaine de la Poisse',at:new Date().toISOString(),status:'offered',hp:100,energy:100,turn:0,balls:3,braced:false,message:'Une rencontre sauvage apparaît !'};
      state.encounters=[e];
      const {context,page,errors}=await fixture({width:320,height:568},3,state);
      try {
        await page.locator('.wild-encounter[data-entrance="ready"][open]').waitFor();
        for(const [width,height] of [[320,568],[844,390],[1920,1080]]){
          await page.setViewportSize({width,height});
          const fit=await page.locator('.wild-encounter').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&n.scrollWidth<=n.clientWidth+1;});
          assert.equal(fit,true,`${monster}: ${width}×${height}`);
        }
        if(monster==='ai')await page.screenshot({path:`${output}/wide-ai.png`});
        await page.keyboard.press('1'); assert.equal((await saved(page)).events.length,3,'modal owns the shortcuts');
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>!document.querySelector('.action-button--candidature')?.disabled);
        assert.equal((await saved(page)).encounters[0].status,'fled'); assert.deepEqual(errors,[]);
      } finally { await context.close(); }
    }
  });
  await t.test('roadside pigeon can be passed with Escape; chest offers one physical slot machine',async()=>{
    const {context,page,errors}=await fixture({width:1280,height:800},0);
    try {
      await page.locator('.action-button--candidature').click();
      await page.locator('.roadside-invite[data-entrance="ready"][open]').waitFor();
      assert.equal(await page.locator('.voxel-world__canvas canvas').getAttribute('data-encounter'),'pigeon');
      await page.screenshot({path:`${output}/roadside-pigeon.png`});
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('.action-button--candidature')?.disabled);
      assert.equal((await saved(page)).miniGames[0].result,'skipped');
      assert.deepEqual(errors,[]);
    } finally { await context.close(); }
    const slots=await fixture({width:1280,height:800},4);
    try {
      await slots.page.locator('.action-button--candidature').click();
      await slots.page.getByRole('button',{name:'Ranger le butin',exact:true}).click();
      await slots.page.getByRole('heading',{name:'Une machine à sous apparaît !'}).waitFor();
      await slots.page.screenshot({path:`${output}/roadside-slots.png`});
      await slots.page.getByRole('button',{name:'Tenter ma chance',exact:true}).click();
      await slots.page.locator('.mini-game--slots[open]').waitFor();
      await slots.page.keyboard.press('Escape');
      await slots.page.waitForFunction(()=>!document.querySelector('.action-button--candidature')?.disabled);
      assert.equal(await slots.page.locator('.roadside-invite').count(),0,'no second invitation after the chest');
      assert.deepEqual(slots.errors,[]);
    } finally { await slots.context.close(); }
  });
});
