import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) {
  if (s.startsWith('@/')) return next(new URL(`../src/${s.slice(2)}.ts`, import.meta.url).href, c);
  if (c.parentURL?.endsWith('.ts') && s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`, c);
  return next(s, c);
} });
const { createDragonRun, advanceDragonRun, steerDragonRun, dragonScore } = await import('../src/lib/game/dragon-flight.ts');
const { canChallengeDragon, dragonIdleFrame, dragonNests, dragonFrame, dragonBeat, DRAGON_DURATION, dragonReply, dragonMealFrame, DRAGON_MEAL_DURATION, DRAGON_VARIANTS, dragonVariantAt, dragonFirePower } = await import('../src/lib/game/dragon.ts');
const { roomAt } = await import('../src/lib/game/doors.ts');
const { WORLD_LENGTH } = await import('../src/lib/game/world.ts');

test('camera browsing cannot unlock a dragon, and nests stay outside interior rooms on every lap', () => {
  const nests = dragonNests(0, WORLD_LENGTH * 3);
  assert.equal(nests.length, 15);
  for (const x of nests) {
    assert.equal(roomAt(x), null);
    assert.equal(canChallengeDragon(x - 211, x, false), false);
    assert.equal(canChallengeDragon(undefined, x, false), false);
    assert.equal(canChallengeDragon(x, x, true), false);
    assert.equal(canChallengeDragon(x + 209, x, false), true);
  }
});

test('the swallow has an arrival, closed digestion, rear release and complete departure with valid poses', () => {
  assert.equal(dragonBeat(0), 'arrive');
  assert.equal(dragonFrame(1200), 2);
  assert.equal(dragonFrame(1800), 3);
  assert.equal(dragonFrame(2500), 4);
  assert.equal(dragonFrame(4000), 5);
  assert.equal(dragonBeat(4500), 'release');
  assert.equal(dragonBeat(DRAGON_DURATION), 'leave');
  for (let t = 0; t <= DRAGON_DURATION; t += 33) assert.ok(dragonFrame(t) >= 0 && dragonFrame(t) < 8);
});

test('a resident jokes, grows irritated, warns, then eats on every fourth accepted visit', () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const replies = Array.from({ length: 4 }, (_, step) => dragonReply(cycle * 4 + step));
    assert.match(replies[0].line, /coup de froid/);
    assert.match(replies[1].line, /tranquille/);
    assert.match(replies[2].line, /je te mange/);
    assert.deepEqual(replies.map(reply => reply.swallow), [false, false, false, true]);
  }
  assert.equal(dragonMealFrame(0), 2);
  assert.equal(dragonMealFrame(900), 3);
  assert.equal(dragonMealFrame(2000), 4);
  assert.equal(dragonMealFrame(3200), 5);
  assert.equal(dragonMealFrame(DRAGON_MEAL_DURATION), 6);
});

test('a resident starts awake, rests briefly and wakes for visitors or reduced motion', () => {
  assert.equal(dragonIdleFrame(0), 6);
  const cycle = Array.from({ length: 480 }, (_, i) => dragonIdleFrame(i / 10));
  assert.ok(cycle.filter(frame => frame === 6).length > cycle.length * 0.8);
  assert.ok(cycle.includes(2), 'the resident can yawn');
  assert.ok(cycle.includes(7), 'the resident can rest occasionally');
  for (let t = 0; t < 100; t += 0.25) {
    assert.equal(dragonIdleFrame(t, true), 6, 'a visitor keeps the dragon awake');
    assert.equal(dragonIdleFrame(t, false, true), 6, 'reduced motion holds a stable awake pose');
    assert.equal(dragonIdleFrame(t + 48), dragonIdleFrame(t));
  }
  for (const invalid of [-4, NaN, Infinity]) assert.equal(dragonIdleFrame(invalid), 6);
});

function play(seed, dt, steer) {
  const run = createDragonRun(seed);
  while (run.status === 'running') {
    if (steer) {
      const danger = lane => run.objects.some(o => o.kind === 'fire' && o.lane === lane && o.x > 12 && o.x < 29);
      const gold = run.objects.filter(o => o.kind === 'gold' && o.x > 12 && o.x < 29).sort((a, b) => a.x - b.x);
      const lane = gold.find(o => !danger(o.lane))?.lane ?? [run.lane, 0, 1, 2].find(l => !danger(l));
      if (lane !== undefined) run.lane = lane;
    }
    advanceDragonRun(run, dt);
  }
  return run;
}

test('the dragon course is winnable at mobile and desktop frame rates; an idle shield fails', () => {
  for (let seed = 0; seed < 40; seed++) for (const dt of [1 / 20, 1 / 30, 1 / 60]) {
    const run = play(seed, dt, true);
    assert.equal(run.status, 'won', `seed ${seed}, ${dt}`);
    assert.ok(run.gold >= 5 && dragonScore(run) <= 350);
  }
  assert.ok(Array.from({ length: 20 }, (_, seed) => play(seed, 1 / 30, false)).filter(r => r.status === 'lost').length >= 19);
});

test('dragon input is bounded and outcomes cannot be awarded twice', () => {
  const run = createDragonRun(5);
  steerDragonRun(run, -10); assert.equal(run.lane, 0);
  steerDragonRun(run, 10); assert.equal(run.lane, 2);
  run.status = 'lost';
  const before = structuredClone(run);
  advanceDragonRun(run, 20); steerDragonRun(run, -1);
  assert.deepEqual(run, before);
});

test('all five dragon coats keep eight complete transparent poses on the shared foot baseline', async () => {
  const { createRequire } = await import('node:module');
  const { readFile, stat } = await import('node:fs/promises');
  const require = createRequire(import.meta.url);
  const sharp = require(require.resolve('sharp', { paths: [require.resolve('next/package.json')] }));
  for(const {art} of Object.values(DRAGON_VARIANTS)){
  const path = new URL(`../public${art}`, import.meta.url);
  const meta = JSON.parse(await readFile(new URL(`../public${art.replace(/\.webp$/,'.json')}`, import.meta.url)));
  const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, meta.columns * meta.width);
  assert.equal(info.height, meta.rows * meta.height);
  assert.ok((await stat(path)).size < 500_000);
  for (let cell = 0; cell < 8; cell++) {
    let last = 0, solid = 0;
    for (let y = 0; y < meta.height; y++) for (let x = 0; x < meta.width; x++) {
      const alpha = data[((Math.floor(cell / 4) * meta.height + y) * info.width + (cell % 4) * meta.width + x) * 4 + 3];
      if (alpha > 24) { last = Math.max(last, y); solid++; assert.ok(x > 3 && x < meta.width - 4 && y > 3 && y < meta.height - 4, `clipped pose ${cell}`); }
    }
    assert.ok(solid > 15_000);
    assert.ok(Math.abs(last - (meta.baseline - 1)) < 4, `floating pose ${cell}: ${last}`);
  }
  }
});

test('each journey meets all five colours and a swallowing resident keeps its coat on later laps',()=>{
 const nests=dragonNests(0,WORLD_LENGTH-1);
 assert.equal(new Set(nests.map(dragonVariantAt)).size,5);
 assert.equal(new Set(Object.values(DRAGON_VARIANTS).map(v=>v.art)).size,5);
 for(const x of nests)for(let lap=0;lap<4;lap++)assert.equal(dragonVariantAt(x+lap*WORLD_LENGTH),dragonVariantAt(x));
});

test('fire grows and fades between breaths, warns on click three and stays still with reduced motion',()=>{
 for(let time=0;time<80;time+=.02){
  const p=dragonFirePower(time,Infinity,0);assert.ok(p>=0&&p<=1);
  assert.ok(Math.abs(p-dragonFirePower(time+.016,Infinity,0))<.06);
  assert.ok(Math.abs(p-dragonFirePower(time+18,Infinity,0))<1e-8);
  assert.equal(dragonFirePower(time,Infinity,0,true),0);
 }
 assert.equal(dragonFirePower(0,1,3),1);
 assert.equal(dragonFirePower(0,1,1),0);assert.equal(dragonFirePower(0,1,2),0);
 assert.equal(dragonFirePower(0,1,4),0);
 assert.equal(dragonFirePower(0,.2,3,true),.7);assert.equal(dragonFirePower(0,2.8,3,true),.7);
 assert.equal(dragonFirePower(0,3.2,3,true),0);
});

test('the four painted flame frames share one mouth origin and leave transparent margins',async()=>{
 const {createRequire}=await import('node:module'),{readFile}=await import('node:fs/promises');
 const require=createRequire(import.meta.url),sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
 const {data,info}=await sharp(await readFile(new URL('../public/art/world-v3/animations/dragon-fire-v1.webp',import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,2048);assert.equal(info.height,256);
 for(let frame=0;frame<4;frame++){
  let solid=0,mouth=0;
  for(let y=0;y<256;y++)for(let x=0;x<512;x++)if(data[(y*2048+frame*512+x)*4+3]>24){
   solid++;assert.ok(x>=6&&x<508&&y>=5&&y<251,`fire ${frame} clipped`);
   if(x<30&&Math.abs(y-128)<12)mouth++;
  }
  assert.ok(solid>18000);assert.ok(mouth>20,`fire ${frame} detached from mouth`);
 }
});
