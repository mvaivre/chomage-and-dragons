import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return next(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?`${s}.ts`:s,c);}});
const {createInitiationProgress,parseInitiationProgress,initiationStorageKey,advanceInitiation,INITIATION_EXAMPLE_STEPS}=await import('../src/lib/game/initiation.ts');
const {JOURNEY_STEPS}=await import('../src/lib/config.ts');

test('six taps teach a real step value, opening and casting, with no timers, quizzes or journal events',()=>{
  assert.equal(INITIATION_EXAMPLE_STEPS,JOURNEY_STEPS.candidature);
  let p=createInitiationProgress();
  const states=[];for(let i=0;i<5;i++){p=advanceInitiation(p);states.push({...p});}
  assert.equal(states[0].journeyDone,true);assert.equal(states[1].stage,1);
  assert.equal(states[2].chestOpen,true);assert.equal(states[2].powerCast,false);
  assert.equal(states[3].powerCast,true);assert.equal(states[4].stage,2);
  assert.equal(advanceInitiation(p),p,'the final tap is handled by the dialog, never an extra exercise');
  assert.equal('events' in p,false);
});
test('old unfinished rites reset without changing the seen key; malformed progress cannot bypass a lesson',()=>{
  assert.equal(initiationStorageKey('local:test'),'chomage:welcome:rites-v2:local%3Atest');
  assert.notEqual(initiationStorageKey('group:one'),initiationStorageKey('group:two'));
  for(const raw of [null,'{','null','[]',JSON.stringify({stage:2,dragonDone:true,encounters:4}),JSON.stringify({version:3,stage:2,powerCast:true})])assert.deepEqual(parseInitiationProgress(raw),createInitiationProgress());
  const interrupted={version:3,stage:2,journeyDone:true,chestOpen:true,powerCast:false};
  assert.equal(parseInitiationProgress(JSON.stringify(interrupted)).stage,1);
  for(let p=createInitiationProgress(),i=0;i<6;i++,p=advanceInitiation(p))assert.deepEqual(parseInitiationProgress(JSON.stringify(p)),p);
});
