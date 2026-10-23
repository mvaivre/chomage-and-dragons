import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {chromium} from 'playwright';

test('GPU grain stays identical when the fine/coarse mesh boundary moves, and water stays smooth',{timeout:90000},async t=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.route('https://terrain-qa.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;let source;
  if(path==='/favicon.ico'){await route.fulfill({status:204,body:''});return;}
  if(path==='/'){await route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'});return;}
  if(path==='/world.js')source='export const FOG_NEAR=23,FOG_FAR=30;';
  else if(['/distance-fog.js','/resources.js','/occlusion.js','/terrain-surface.js','/game-world.js'].includes(path)){
   const file=path==='/game-world.js'?'../../src/lib/game/world.ts':`../../src/components/voxel${path.replace('.js','.ts')}`;
   source=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"./world"','"https://terrain-qa.test/world.js"').replaceAll('"./distance-fog"','"https://terrain-qa.test/distance-fog.js"').replaceAll('"./occlusion"','"https://terrain-qa.test/occlusion.js"').replaceAll('"@/lib/game/world"','"https://terrain-qa.test/game-world.js"');
  }else source=await readFile(new URL(`../../node_modules/three/build${path}`,import.meta.url),'utf8');
  source=source.replace(/from ['"]three['"]/g,'from "https://terrain-qa.test/three.module.js"');await route.fulfill({contentType:'text/javascript',body:source});
 });
 await page.goto('https://terrain-qa.test/');
 const result=await page.evaluate(async()=>{
  const T=await import('https://terrain-qa.test/three.module.js'),{VoxelResources}=await import('https://terrain-qa.test/resources.js'),{addTerrainGrain}=await import('https://terrain-qa.test/terrain-surface.js');
  const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.outputColorSpace=T.SRGBColorSpace;
  const r=new VoxelResources(true),scene=new T.Scene(),camera=new T.OrthographicCamera(-4,4,4,-4,.1,100),mat=r.material(0xffffff).clone();mat.vertexColors=true;r.addFog(mat,true);addTerrainGrain(mat);
  scene.add(new T.AmbientLight(0xffffff,2));const meshes=[];
  function plane(x,from,to,resolution,surface){const g=new T.PlaneGeometry(8,to-from,resolution,resolution).rotateX(-Math.PI/2);g.setAttribute('terrainSurface',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(surface),1));const color=new T.Color(0x567b48).multiplyScalar(.94),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));const m=new T.Mesh(g,mat);m.position.set(x,0,(from+to)/2);scene.add(m);meshes.push(m);}
  function draw(x,seam,surface=1){for(const mesh of meshes){scene.remove(mesh);mesh.geometry.dispose();}meshes.length=0;plane(x,8,seam,32,surface);plane(x,seam,16,2,surface);r.focus.set(x,12);camera.position.set(x,20,12);camera.lookAt(x,0,12);camera.updateMatrixWorld();camera.updateProjectionMatrix();renderer.render(scene,camera);const pixels=new Uint8Array(256*256*4),gl=renderer.getContext();gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;}
  const biomes=[20,100,180,270,340,400,460,500,560],results=[];
  for(const x of biomes){const a=draw(x,12),b=draw(x,14);let mismatches=0,left=0,right=0,n=0;for(let y=4;y<252;y++)for(let px=4;px<251;px++){const i=(y*256+px)*4;for(let c=0;c<3;c++){if(Math.abs(a[i+c]-b[i+c])>1)mismatches++;const d=Math.abs(a[i+c]-a[i+4+c]);if(y<128)left+=d;else right+=d;n++;}}results.push({x,mismatches,left:left/n,right:right/n});}
  const water=draw(500,12,0),plain=draw(500,14,0);let delta=0,min=255,max=0;for(let i=0;i<water.length;i+=4){min=Math.min(min,water[i]);max=Math.max(max,water[i]);delta=Math.max(delta,Math.abs(water[i]-plain[i]));}
  for(const mesh of meshes)mesh.geometry.dispose();mat.dispose();r.dispose();renderer.dispose();return{results,water:{min,max,delta}};
 });
 for(const p of result.results){assert.equal(p.mismatches,0,`pattern must ignore mesh boundaries: ${JSON.stringify(p)}`);assert.ok(p.left>.1&&p.right>.1,`both resolutions contain actual grain: ${JSON.stringify(p)}`);assert.ok(p.left/p.right>.65&&p.left/p.right<1.5,`comparable detail across the seam: ${JSON.stringify(p)}`);}
 assert.ok(result.water.min>20);assert.equal(result.water.max-result.water.min,0);assert.equal(result.water.delta,0);assert.deepEqual(errors,[]);console.log(result);
});
