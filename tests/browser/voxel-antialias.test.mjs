import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {chromium} from 'playwright';

test('the scene is multisampled before focus; in-focus fine details survive unchanged and depth still blurs the distance',{timeout:60000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.route('https://voxel-aa.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;let source;
  if(path==='/favicon.ico'){await route.fulfill({status:204,body:''});return;}
  if(path==='/'){await route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'});return;}
  if(['/scene-pass.js','/miniature.js'].includes(path))source=ts.transpileModule(await readFile(new URL(`../../src/components/voxel${path.replace('.js','.ts')}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"./miniature"','"https://voxel-aa.test/miniature.js"');
  else source=await readFile(new URL(path.startsWith('/addons/')?`../../node_modules/three/examples/jsm/${path.slice(8)}`:`../../node_modules/three/build${path}`,import.meta.url),'utf8');
  source=source.replace(/from ['"]three['"]/g,'from "https://voxel-aa.test/three.module.js"').replaceAll('"three/addons/','"https://voxel-aa.test/addons/');await route.fulfill({contentType:'text/javascript',body:source});
 });
 await page.goto('https://voxel-aa.test/');
 const result=await page.evaluate(async()=>{
  const T=await import('https://voxel-aa.test/three.module.js'),{ScenePass,sceneSamples}=await import('https://voxel-aa.test/scene-pass.js'),{MiniaturePass}=await import('https://voxel-aa.test/miniature.js'),{EffectComposer}=await import('https://voxel-aa.test/addons/postprocessing/EffectComposer.js'),{OutputPass}=await import('https://voxel-aa.test/addons/postprocessing/OutputPass.js');
  const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene();scene.background=new T.Color(0);const camera=new T.OrthographicCamera(-4,4,4,-4,.1,50);camera.position.z=10;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const geometry=new T.BoxGeometry(1,1,.05),material=new T.MeshBasicMaterial({color:0xffffff});
  for(const z of [0,-14])for(let i=0;i<29;i++){const m=new T.Mesh(geometry,material);m.scale.set(.04,2.6,1);m.position.set(-2.8+i*.2,z===0?-1.9:1.9,z);m.rotation.z=.18;scene.add(m);}
  const miniature=new MiniaturePass(),samples=sceneSamples(renderer),source=new ScenePass(scene,camera,miniature,samples),composer=new EffectComposer(renderer,new T.WebGLRenderTarget(256,256,{type:T.HalfFloatType,depthBuffer:false}));composer.addPass(source);composer.addPass(new OutputPass());
  miniature.setResolutionScale(.25);miniature.setFocus(10,.1,50);const frames=[];
  for(const [aa,focus] of [[0,false],[samples,false],[samples,true]]){
   source.target.samples=aa;source.target.dispose();miniature.enabled=focus;composer.render();
   const gl=renderer.getContext(),pixels=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let fractional=0;const energy=[0,0],count=[0,0];
   for(let y=15;y<241;y++)for(let x=20;x<236;x++){const band=y<108?0:y>148?1:-1;if(band<0)continue;const i=(y*256+x)*4,value=pixels[i];if(band===0&&value>2&&value<253)fractional++;const dx=value-pixels[i+4],dy=value-pixels[i+256*4];energy[band]+=dx*dx+dy*dy;count[band]++;}
   frames.push({fractional,energy:energy.map((e,i)=>e/count[i]),near:Array.from(pixels.slice(15*256*4,108*256*4))});
  }
  const nearDifference=frames[1].near.reduce((max,n,i)=>n>0&&i%4!==3?Math.max(max,Math.abs(n-frames[2].near[i])):max,0),solidDifference=frames[1].near.reduce((max,n,i)=>n>=254&&i%4!==3?Math.max(max,Math.abs(n-frames[2].near[i])):max,0),glError=renderer.getContext().getError();
  source.setSize(1,1);const small=source.target.width===1&&source.target.height===1;for(const f of frames)delete f.near;
  for(const p of composer.passes)p.dispose();composer.dispose();geometry.dispose();material.dispose();const remainingTextures=renderer.info.memory.textures;renderer.dispose();return{samples,frames,nearDifference,solidDifference,glError,small,remainingTextures};
 });
 console.log(result);assert.ok(result.samples>=2&&result.samples<=4);assert.equal(result.glError,0);assert.equal(result.small,true);assert.equal(result.remainingTextures,0);
 assert.equal(result.frames[0].fractional,0,'control has hard single-sample edges');assert.ok(result.frames[1].fractional>100,'MSAA adds subpixel edge coverage');
 assert.ok(result.nearDifference<=1,'focused geometry and its subpixel edge coverage survive unchanged');
 assert.ok(result.frames[2].energy[1]<result.frames[1].energy[1]*.85,'resolved scene depth still selects distant blur');assert.deepEqual(errors,[]);
});

test('unsupported HDR MSAA keeps the real mobile game on the native antialiased path',{timeout:60000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.addInitScript(()=>{
  const original=WebGL2RenderingContext.prototype.getInternalformatParameter;
  WebGL2RenderingContext.prototype.getInternalformatParameter=function(target,format,pname){return format===this.RGBA16F&&pname===this.SAMPLES?new Int32Array():original.call(this,target,format,pname);};
  const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'barde',joinedAt:at}],events:[],casts:[]}));
 });
 await page.goto(`${process.env.GAME_TEST_URL??'http://localhost:3000'}/local?debug&profile&hour=12`);await page.waitForFunction(()=>window.__voxelWorld?.ready&&!document.querySelector('.action-button--refus')?.disabled);
 const w=await page.evaluate(()=>{const w=window.__voxelWorld;return{triangles:w.triangles,...w.performance};});
 assert.equal(w.antialias,'msaa');assert.equal(w.sourceSamples,null);assert.equal(w.miniature,false);assert.equal(w.bloom,false);assert.deepEqual(w.blurSize,[1,1]);assert.ok(w.triangles>1000&&w.triangles<150000);
 assert.deepEqual(errors,[]);await context.close();
});
