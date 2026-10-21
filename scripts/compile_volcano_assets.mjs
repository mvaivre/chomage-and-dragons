import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', {paths:[require.resolve('next/package.json')]}));
const records = JSON.parse(await fs.readFile(new URL('../docs/VOLCANO_ART_PROMPTS.json', import.meta.url)));
const runtime = new URL('../public/art/world-v3/runtime/', import.meta.url);
for (const {kind,source} of records) {
  if (!source) throw new Error(`Missing ${kind} source`);
  if (kind === 'Ground') {
    const meta = await sharp(source).metadata();
    const sourceCrop = {left:0,top:156,width:meta.width,height:meta.height-156};
    const strip = await sharp(source).extract(sourceCrop).resize(2048,488).flatten({background:'#29202b'}).png().toBuffer();
    await sharp({create:{width:2048,height:512,channels:4,background:'#00000000'}})
      .composite([{input:strip,left:0,top:24}]).webp({quality:91,alphaQuality:100}).toFile(new URL('ground-volcan-v2.webp',runtime).pathname);
    await fs.writeFile(new URL('ground-volcan-v2.json',runtime),JSON.stringify({width:2048,height:512,worldWidth:1024,topMargin:24,contactY:24,baseColor:0x29202b,sourceCrop},null,2)+'\n');
  } else {
    const output = kind === 'Hammer' ? new URL('../public/art/world-v3/collectibles/hammer.webp',import.meta.url) : new URL(`volcan-${kind.toLowerCase()}.webp`,runtime);
    const image = sharp(source);
    if (kind === 'Hammer') image.resize(256,256,{fit:'inside'});
    await image.webp({quality:91,alphaQuality:100}).toFile(output.pathname);
  }
}
