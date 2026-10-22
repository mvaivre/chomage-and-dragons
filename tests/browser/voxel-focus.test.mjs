import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {chromium} from 'playwright';
const url=process.env.GAME_TEST_URL??'http://localhost:3000';
const launch=()=>chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});

test('depth of field softens the actual background while keeping the hero sharp',{timeout:90000},async t=>{
 const browser=await launch();t.after(()=>browser.close());const measurements=[];
 for(const enabled of [false,true]){
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.addInitScript(()=>{const at=new Date().toISOString();localStorage.setItem('chomage:welcome:rites-v2:local%3Atest','seen');localStorage.setItem('louchomage:moi:v1','test');localStorage.setItem('louchomage:v2',JSON.stringify({players:[{id:'test',name:'Mika',characterId:'barde',joinedAt:at}],events:Array.from({length:45},(_,i)=>({id:`seed-${i}`,playerId:'test',kind:'candidature',at})),casts:[]}));});
  await page.goto(`${url}/local?debug&profile&hour=12${enabled?'':'&miniature=0'}`);await page.waitForFunction(()=>window.__voxelWorld?.ready&&!document.querySelector('.action-button--refus')?.disabled);await page.waitForTimeout(300);
  const before=await page.evaluate(()=>localStorage.getItem('louchomage:v2')),w=await page.evaluate(()=>window.__voxelWorld.occlusion.windows[0]),shot=await page.screenshot();
  assert.equal(await page.evaluate(()=>window.__voxelWorld.performance.miniature),enabled);
  measurements.push(await page.evaluate(async({base64,w})=>{
   const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'})),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let pink=0,energy=0,n=0;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const dist=Math.hypot(x-w[0],canvas.height-y-w[1]),i=(y*canvas.width+x)*4;
    if(dist>w[3]*3&&x>40&&x<canvas.width-40&&y>85&&y<canvas.height-170)for(let c=0;c<3;c++){const dx=data[i+c]-data[i+4+c],dy=data[i+c]-data[i+canvas.width*4+c];energy+=dx*dx+dy*dy;n++;}
    if(dist<=w[3]){const r=data[i],g=data[i+1],b=data[i+2];if(r>g*1.15&&b>g*1.05&&r>b*.85)pink++;}
   }return{pink,energy:energy/n};
  },{base64:shot.toString('base64'),w}));
  assert.equal(await page.evaluate(()=>localStorage.getItem('louchomage:v2')),before);assert.deepEqual(errors,[]);await context.close();
 }
 assert.ok(measurements[1].energy<measurements[0].energy*.85,'background high frequencies decrease');assert.ok(measurements[1].pink>=measurements[0].pink*.95,'the hero stays sharp');console.log(measurements);
});

test('fully fogged geometry matches the sky pixels in direct and HDR rendering',{timeout:90000},async t=>{
 const browser=await launch();t.after(()=>browser.close());const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 // Serve the real renderer and shader source in a minimal GPU scene. The world
 // constants are the only fixture; the material implementation is unmodified.
 await page.route('https://voxel-qa.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;let source;
  if(path==='/favicon.ico'){await route.fulfill({status:204,body:''});return;}
  if(path==='/'){await route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'});return;}
  if(path==='/world.js')source='export const FOG_NEAR=23,FOG_FAR=30;';
  else if(['/resources.js','/occlusion.js'].includes(path))source=ts.transpileModule(await readFile(new URL(`../../src/components/voxel${path.replace('.js','.ts')}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"./world"','"https://voxel-qa.test/world.js"').replaceAll('"./occlusion"','"https://voxel-qa.test/occlusion.js"');
  else source=await readFile(new URL(path.startsWith('/addons/')?`../../node_modules/three/examples/jsm/${path.slice(8)}`:`../../node_modules/three/build${path}`,import.meta.url),'utf8');
  source=source.replace(/from ['"]three['"]/g,'from "https://voxel-qa.test/three.module.js"');await route.fulfill({contentType:'text/javascript',body:source});
 });
 await page.goto('https://voxel-qa.test/');const pixels=await page.evaluate(async()=>{
  const T=await import('https://voxel-qa.test/three.module.js'),{VoxelResources}=await import('https://voxel-qa.test/resources.js'),{OutputPass}=await import('https://voxel-qa.test/addons/postprocessing/OutputPass.js');
  const r=new VoxelResources(true),renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(32,32);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,100);camera.position.set(0,0,50);camera.lookAt(0,0,40);const plane=new T.Mesh(new T.PlaneGeometry(1,2),r.material(0x33ff44));plane.position.set(.5,0,40);scene.add(plane);
  const target=new T.WebGLRenderTarget(32,32,{type:T.HalfFloatType}),output=new OutputPass(),result=[];
  for(const color of [0x536f71,0x4c344d,0x172535])for(const hdr of [false,true]){
   scene.background=new T.Color(color);r.fogColor.copy(scene.background);renderer.setRenderTarget(hdr?target:null);renderer.render(scene,camera);if(hdr){output.renderToScreen=true;output.render(renderer,null,target);}
   const gl=renderer.getContext(),sky=new Uint8Array(4),fog=new Uint8Array(4);gl.readPixels(8,16,1,1,gl.RGBA,gl.UNSIGNED_BYTE,sky);gl.readPixels(24,16,1,1,gl.RGBA,gl.UNSIGNED_BYTE,fog);result.push({color,hdr,sky:[...sky],fog:[...fog]});
  }
  // A near, unlit control must render black rather than the sky. This catches
  // a missing/failed plane shader that would otherwise make both halves match.
  plane.position.z=0;scene.background=new T.Color(0x536f71);renderer.setRenderTarget(null);renderer.render(scene,camera);const control=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(24,16,1,1,gl.RGBA,gl.UNSIGNED_BYTE,control);
  target.dispose();output.dispose();plane.geometry.dispose();r.dispose();renderer.dispose();return {result,control:[...control]};
 });
 for(const p of pixels.result)for(let c=0;c<3;c++)assert.ok(Math.abs(p.sky[c]-p.fog[c])<=1,JSON.stringify(p));assert.ok(pixels.control.slice(0,3).every(c=>c<2));assert.deepEqual(errors,[]);console.log(pixels);
});
