#!/usr/bin/env node
/** Deterministic import of complete vignette regions, preserving disconnected mugs/foam. */
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
const [source,destination,layout]=process.argv.slice(2);
const regions={a:[[0,0,.543,.48],[.543,0,.457,.48],[0,.48,.48,.52],[.48,.48,.52,.52]],b:[[0,0,.55,.48],[.55,0,.45,.48],[0,.48,.55,.52],[.55,.48,.45,.52]]}[layout];
if(!regions)throw new Error('Usage: compile_tavern_assets.mjs SOURCE OUTPUT a|b');
const {width,height}=await sharp(source).metadata();
const tiles=[],heights=[],widths=[],bounds=[];
for(const [index,region]of regions.entries()){
 const [x,y,w,h]=region, left=Math.round(x*width),top=Math.round(y*height);
 const rect={left,top,width:Math.min(width-left,Math.round(w*width)),height:Math.min(height-top,Math.round(h*height))};
 const {data,info}=await sharp(source).extract(rect).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,r=0,t=info.height,b=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>12){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 const crop={left:Math.max(0,l-2),top:Math.max(0,t-2),width:Math.min(info.width-l,r-l+5),height:Math.min(info.height-t,b-t+5)};
 const ratio=Math.min(488/crop.width,460/crop.height),tw=Math.round(crop.width*ratio),th=Math.round(crop.height*ratio);
 const tile=await sharp(data,{raw:info}).extract(crop).resize(tw,th).png().toBuffer();
 const tx=Math.round((512-tw)/2),ty=476-th;
 tiles.push({input:tile,left:index%2*512+tx,top:Math.floor(index/2)*512+ty});heights.push(th);widths.push(tw);bounds.push([tx,ty,tw,th]);
}
await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(tiles).webp({quality:88,alphaQuality:100,effort:6}).toFile(destination);
await fs.writeFile(destination.replace(/\.webp$/,'.json'),JSON.stringify({columns:2,rows:2,width:512,height:512,baseline:476,heights,widths,bounds},null,2)+'\n');
console.log(destination);
