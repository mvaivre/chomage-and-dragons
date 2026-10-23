import test from 'node:test';
import assert from 'node:assert/strict';

class Param {
  value=0;
  setValueAtTime(value) { assert.ok(Number.isFinite(value)); this.value=value; }
  exponentialRampToValueAtTime(value) { assert.ok(Number.isFinite(value)&&value>0); this.value=value; }
}
class Node {
  gain=new Param(); frequency=new Param(); Q=new Param(); threshold=new Param(); ratio=new Param();
  connect(node) { return node; }
  start(at) { assert.ok(Number.isFinite(at)); this.started=at; }
  stop(at) { assert.ok(Number.isFinite(at)&&at>=this.started); this.stopped=at; }
}
class AudioContext {
  static instances=[];
  currentTime=0; sampleRate=1000; state='running'; destination=new Node(); nodes=[];
  constructor() { AudioContext.instances.push(this); }
  node() { const node=new Node(); this.nodes.push(node); return node; }
  createGain() { return this.node(); }
  createDynamicsCompressor() { return this.node(); }
  createOscillator() { return this.node(); }
  createBufferSource() { return this.node(); }
  createBiquadFilter() { return this.node(); }
  createBuffer(_channels,length) { return {getChannelData:()=>new Float32Array(length)}; }
  resume() { this.state='running'; return Promise.resolve(); }
}
globalThis.window={AudioContext,localStorage:{getItem:()=>null,setItem:()=>{}}};
const {sfx,setMuted}=await import('../src/lib/client/sound.ts');
const sounds=[()=>sfx.encounterAppear(),()=>sfx.encounterAppear(true),()=>sfx.encounterPrompt(),()=>sfx.battleStart(),...['argue','polite','rest','capture'].map(move=>()=>sfx.battleMove(move))];

test('all encounter cues honor mute and schedule only short, finite sounds',()=>{
  setMuted(true);for(const sound of sounds)sound();assert.equal(AudioContext.instances.length,0);
  setMuted(false);
  for(const sound of sounds){
    const previous=AudioContext.instances[0]?.nodes.length??0;
    sound();const nodes=AudioContext.instances[0].nodes.slice(previous).filter(n=>n.started!==undefined);
    assert.ok(nodes.length>0);assert.ok(nodes.every(n=>n.stopped-n.started>0&&n.stopped<=1.3));
  }
  const context=AudioContext.instances[0],before=context.nodes.length;
  setMuted(true);for(const sound of sounds)sound();assert.equal(context.nodes.length,before);
});

test('reduced-motion reveal sound ends before its shorter 300ms prompt transition',()=>{
  setMuted(false);const context=AudioContext.instances[0],before=context.nodes.length;
  sfx.encounterAppear(true,true);
  const nodes=context.nodes.slice(before).filter(n=>n.started!==undefined);
  assert.ok(nodes.every(n=>n.stopped<.3),'the appearance sting finishes before the choices pop');
});
