import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s.startsWith('@/'))return n(new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href,c);if(c.parentURL?.endsWith('.ts')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return n(`${s}.ts`,c);return n(s,c);}});
const {terrainHeight,routeHeight,routeZ,volcanoPools,lavaAt,lavaRadius,continuationSurface}=await import('../src/components/voxel/world.ts');
const {landscapePlots}=await import('../src/components/voxel/layout.ts');
const {VoxelResources}=await import('../src/components/voxel/resources.ts');
const {makeChunk}=await import('../src/components/voxel/chunks.ts');

test('volcanic banks rise in readable terraces instead of a sheer wall behind the road',()=>{
 let maximum=0;
 for(let x=485;x<526;x+=.5)for(let depth=2;depth<17;depth+=.5){const z=routeZ(x)-depth,delta=Math.abs(terrainHeight(x,z)-terrainHeight(x,z-.5));maximum=Math.max(maximum,delta);}
 assert.ok(maximum<1.8,`highest half-metre ledge ${maximum}`);
 const plot=landscapePlots(0).find(p=>p.kind==='forge');
 const corners=[-1.4,1.4].flatMap(dx=>[-1.15,1.15].map(dz=>terrainHeight(plot.x+dx,plot.z-.5+dz)));
 assert.ok(Math.max(...corners)-Math.min(...corners)<.26,'the forge sits on level ground');
 const x=.835*604.8,z=routeZ(x)-4;
 for(const dx of [-2,0,2])for(const dz of [-1,0,1])assert.ok(Math.abs(terrainHeight(x+dx,z+dz)-routeHeight(x+dx))<.3,'the dragon has an open shelf');
});
test('irregular lava pools stay below their banks and clear of the path',()=>{
 for(const pool of volcanoPools(0)){
  assert.equal(lavaAt(pool.x,pool.z),pool);assert.ok(terrainHeight(pool.x,pool.z)<pool.y);
  for(let a=0;a<Math.PI*2;a+=.2){const x=pool.x+Math.cos(a)*pool.rx,z=pool.z+Math.sin(a)*pool.rz;assert.ok(Math.abs(z-routeZ(x))>1.7,'lava never floods the road');}
  assert.notEqual(lavaRadius(pool,pool.x+pool.rx,pool.z),lavaRadius(pool,pool.x,pool.z+pool.rz));
 }
});
test('volcanic foreground has varied relief and bounded, grounded detail beyond the core tile',()=>{
 const heights=Array.from({length:24},(_,i)=>terrainHeight(500+i*.5,7)-routeHeight(500+i*.5));assert.ok(Math.max(...heights)-Math.min(...heights)>.4);
 const r=new VoxelResources(true,4),chunk=makeChunk(31,0,r);assert.ok(chunk.userData.volcanicClusters>=12);assert.ok(chunk.getObjectByName('basalt-skink'));
 for(const x of [498,501,505])for(const z of [13,15,19])assert.ok(Number.isFinite(continuationSurface(x,z)));
 const shoulder=chunk.getObjectByName('fogged-ground-continuation'),{position:p,normal:n}=shoulder.geometry.attributes;
 // Every shoulder edge is shared in full: interior vertical sliver faces are gone.
 for(let i=0;i<p.count;i+=3){if(Math.abs(n.getY(i))<.01){assert.ok(Math.abs(Math.abs(p.getZ(i))-12)<1e-5||Math.abs(p.getZ(i)+15)<1e-5,'vertical stitching is confined to the core boundary');}}
 chunk.userData.dispose();assert.equal(r.instances.size,0);r.dispose();
});
test('ruled volcanic terraces keep finite vertices, correct winding and matching chunk seams',()=>{
 const r=new VoxelResources(true,4),edges=new Map();
 for(const cx of [30,31,32,33]){
  const chunk=makeChunk(cx,0,r);
  for(const mesh of chunk.children.filter(o=>o.isMesh&&!o.isInstancedMesh&&o.name!=='fogged-ground-continuation')){
   const {position:p,normal:n}=mesh.geometry.attributes;
   for(let i=0;i<p.count;i+=3){
    const a=[p.getX(i),p.getY(i),p.getZ(i)],b=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)],c=[p.getX(i+2),p.getY(i+2),p.getZ(i+2)];assert.ok([...a,...b,...c].every(Number.isFinite));
    const u=b.map((v,j)=>v-a[j]),v=c.map((v,j)=>v-a[j]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(cross[0]*n.getX(i)+cross[1]*n.getY(i)+cross[2]*n.getZ(i)>0,`backwards triangle ${cx}:${i}`);
    if(n.getY(i)<=.1)continue;
    for(const point of [a,b,c])if(point[0]===cx*16||point[0]===(cx+1)*16){const key=`${point[0]}:${point[2]}`,values=edges.get(key)??new Map();const list=values.get(cx)??new Set();list.add(point[1]);values.set(cx,list);edges.set(key,values);}
   }
  }
  chunk.userData.dispose();
 }
 for(const values of edges.values())if(values.size===2){const[a,b]=[...values.values()];assert.deepEqual(a,b,'shared terrain vertices match');}
 r.dispose();
});
