/** Repeatable visual/performance fixture; isolated browser storage never touches a real group. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){return n(s.startsWith('@/')?new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href:s,c);}});
const {decorEventAt}=await import('../src/lib/game/decor-events.ts');
const label = process.argv[2] ?? 'after';
const steps = (process.env.DECOR_STEPS ?? '1,19').split(',').filter(Boolean).map(Number);
const url = process.env.GAME_TEST_URL ?? 'http://localhost:3123';
const folder = `docs/decor-previews/${label}`;
await fs.mkdir(folder, { recursive: true });
const openBrowser = () => chromium.launch({ timeout: 30_000, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let browser = await openBrowser();
let captures = 0;
const sizes = process.env.DECOR_SIZES ? process.env.DECOR_SIZES.split(',').map(s=>s.split('x').map(Number)) : [[1280,720],[390,844],[320,568],[844,390],[1920,1080]];
const errors = [];
const results = [];
async function fixture(step, size, hour = 12) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] } });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ step }) => {
    if (localStorage.getItem('louchomage:v2')) return;
    const at = new Date().toISOString();
    localStorage.setItem('louchomage:moi:v1', 'test');
    localStorage.setItem('louchomage:v2', JSON.stringify({ players: [{ id:'test', name:'Mika', characterId:'skater', joinedAt:at }, {id:'lou',name:'Lou',characterId:'barde',joinedAt:at}], events: [...Array.from({length:Math.floor(step/2)+(step%2?2:0)},(_,i)=>({id:`qa-${i}`,playerId:'test',kind:'candidature',at})), ...(step%2?[{id:'qa-adjust',playerId:'test',kind:'entretien',at}]:[])], casts:[] }));
  }, { step });
  await page.goto(`${url}/local?debug&hour=${hour}&variant=classic`);
  await page.waitForFunction(() => window.__pixiApp && !document.querySelector('.action-button--refus')?.disabled, null, {timeout:30_000});
  await page.waitForTimeout(2200);
  if (process.env.DECOR_EVENT) {
    let seconds = 84;
    if (process.env.DECOR_EVENT !== 'office') {
      const focus = await page.evaluate(() => window.__decorScene.focus);
      seconds = Array.from({length:9000},(_,i)=>i).find(s=>{
        const e=decorEventAt(focus,s);
        return e.active&&e.kind===process.env.DECOR_EVENT&&e.phase>.5&&e.phase<.6;
      });
      if (seconds === undefined) throw new Error('No matching event in the QA window');
      // Catch the pigeon between neighbouring boards, while it crosses the hero's lane.
      if (process.env.DECOR_EVENT === 'pigeon') seconds += (focus + 40 - decorEventAt(focus, seconds).x) / (1680 / 9);
    }
    await page.evaluate(s=>{Date.now=()=>s*1000;window.__decorScene.momentActive=false;},seconds);
    await page.waitForTimeout(350);
  }
  await page.addStyleTag({content:'.dev-explorer, nextjs-portal { visibility: hidden !important; }'});
  return { context, page };
}
try {
  for (const step of steps) for (const size of sizes) for (const hour of [12,22]) {
    const {context,page} = await fixture(step, size, hour);
    const name = `${step}-${size.join('x')}-${hour}.jpg`;
    await page.screenshot({path:`${folder}/${name}`, type:'jpeg', quality:67});
    await context.close();
    if (++captures % 10 === 0) { await browser.close(); browser = await openBrowser(); }
  }
  if (process.env.DECOR_PERF !== '0') for (const [size, throttle] of [[[1280,720],1],[[390,844],4]]) {
    const {context,page} = await fixture(Number(process.env.DECOR_PERF_STEP ?? 2),size);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
    const renderer = await page.evaluate(() => {
      const app=window.__pixiApp, gl=app.renderer.gl;
      const ext=gl?.getExtension('WEBGL_debug_renderer_info');
      return {type:app.renderer.type,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
    });
    const metrics = async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    const before=await metrics(); await page.waitForTimeout(5000); const after=await metrics();
    await page.evaluate(()=>{window.__qaFrames=[];let last=performance.now();window.__qaMeasure=true;const tick=now=>{window.__qaFrames.push(now-last);last=now;if(window.__qaMeasure)requestAnimationFrame(tick)};requestAnimationFrame(tick)});
    await page.locator('.action-button--refus').click();
    await page.waitForTimeout(4300);
    const frames = await page.evaluate(()=>{window.__qaMeasure=false;return window.__qaFrames.sort((a,b)=>a-b)});
    results.push({step:Number(process.env.DECOR_PERF_STEP ?? 2),viewport:size,throttle,renderer,idleCPU:100*(after.TaskDuration-before.TaskDuration)/(after.Timestamp-before.Timestamp),maxFrameMS:frames.at(-1),p95FrameMS:frames[Math.floor(frames.length*.95)]});
    await context.close();
  }
  await fs.writeFile(`${folder}/results.json`,JSON.stringify({label,captures,steps,sizes,hours:[12,22],results,errors},null,2)+'\n');
  console.log(JSON.stringify({label,captures,steps,sizes,hours:[12,22],results,errors},null,2));
  if(errors.length) process.exitCode=1;
} finally {await browser.close()}
