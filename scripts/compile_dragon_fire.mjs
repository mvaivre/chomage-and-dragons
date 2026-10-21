import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url),sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
const source=process.argv[2];if(!source)throw new Error('Pass the generated 2 × 2 fire atlas');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const cw=Math.floor(info.width/2),ch=Math.floor(info.height/2),tiles=[];
for(let frame=0;frame<4;frame++){
 const pixels=await sharp(data,{raw:info}).extract({left:frame%2*cw,top:Math.floor(frame/2)*ch,width:cw,height:ch}).raw().toBuffer();
 let left=cw,right=0,top=ch,bottom=0;
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const i=(y*cw+x)*4;if(pixels[i+3]<80||pixels[i]<180)continue;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 // Ignore isolated specks; register each narrow leading tip to the same mouth origin.
 const ys=[];for(let x=left+3;x<left+18;x++)for(let y=top;y<=bottom;y++)if(pixels[(y*cw+x)*4+3]>160)ys.push(y);
 const tip=ys.reduce((a,b)=>a+b,0)/ys.length;
 const scale=Math.min(490/(right-left+1),118/Math.max(1,tip-top),118/Math.max(1,bottom-tip));
 const width=Math.round((right-left+1)*scale),height=Math.round((bottom-top+1)*scale);
 const image=await sharp(pixels,{raw:{width:cw,height:ch,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(width,height).png().toBuffer();
 tiles.push({input:image,left:frame*512+8,top:Math.round(128-(tip-top)*scale)});
}
const destination=new URL('../public/art/world-v3/animations/dragon-fire-v1.webp',import.meta.url);
await sharp({create:{width:2048,height:256,channels:4,background:'#00000000'}}).composite(tiles).webp({quality:90,alphaQuality:100}).toFile(destination.pathname);
await fs.writeFile(new URL('../public/art/world-v3/animations/dragon-fire-v1.json',import.meta.url),JSON.stringify({columns:4,rows:1,width:512,height:256,mouth:[8,128],source},null,2)+'\n');
