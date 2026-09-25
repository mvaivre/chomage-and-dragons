import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
const folder=new URL('../public/art/world-v3/decor/',import.meta.url);

test('decor atlas cells keep alpha gutters, complete silhouettes and registered feet',async()=>{
  for(const name of (await fs.readdir(folder)).filter(n=>n.endsWith('.json'))) {
    const m=JSON.parse(await fs.readFile(new URL(name,folder),'utf8'));
    if(m.columns*m.rows===1)continue;
    const {data,info}=await sharp(new URL(name.replace('.json','.webp'),folder).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,m.columns*m.width,name); assert.equal(info.height,m.rows*m.height,name);
    for(let cell=0;cell<m.columns*m.rows;cell++) {
      let count=0,bottom=0,edge=0;
      for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++) {
        const a=data[((Math.floor(cell/m.columns)*m.height+y)*info.width+(cell%m.columns)*m.width+x)*4+3];
        if(a>32){ count++;bottom=Math.max(bottom,y);if(x<2||x>=m.width-2||y<2||y>=m.height-2)edge++; }
      }
      assert.ok(count>100,`${name}:${cell} empty`);assert.equal(edge,0,`${name}:${cell} clipped`);
      assert.ok(Math.abs(bottom-m.baseline)<=5,`${name}:${cell} bottom ${bottom}`);
    }
    for(const frame of m.frames??[]) for(const [x,y,w,h] of !frame.text?[]:Array.isArray(frame.text[0])?frame.text:[frame.text]) {
      assert.ok(x>=0&&y>=0&&x+w<=m.width&&y+h<=m.height,`${name} text rectangle`);
    }
  }
});

test('interior tiles are opaque where required and meet exactly at their edges',async()=>{
 for(const name of (await fs.readdir(folder)).filter(n=>n.endsWith('.json'))) {
  const m=JSON.parse(await fs.readFile(new URL(name,folder),'utf8'));if(!m.tile)continue;
  const {data,info}=await sharp(new URL(name.replace('.json','.webp'),folder).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<info.height;y++)for(let c=0;c<4;c++)assert.equal(data[(y*info.width)*4+c],data[(y*info.width+info.width-1)*4+c],`${name}: seam ${y}`);
  if(m.opaque)for(let i=3;i<data.length;i+=4)assert.equal(data[i],255,name);
 }
});

test('decor downloads fit the six-megabyte addition budget',async()=>{
 const files=(await fs.readdir(folder)).filter(n=>n.endsWith('.webp'));
 const bytes=(await Promise.all(files.map(n=>fs.stat(new URL(n,folder))))).reduce((s,f)=>s+f.size,0);
 assert.ok(bytes<=6_000_000,`${bytes} bytes of decor`);
});
