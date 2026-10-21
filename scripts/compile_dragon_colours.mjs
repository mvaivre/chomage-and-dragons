import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const records=JSON.parse(await fs.readFile(new URL('../docs/DRAGON_COLOURS_ART_PROMPTS.json',import.meta.url)));
for(const {kind,source,output} of records){
 if(kind==='Fire'){execFileSync(process.execPath,['scripts/compile_dragon_fire.mjs',source],{stdio:'inherit'});continue;}
 execFileSync(process.execPath,['scripts/compile_ambient_assets.mjs',source,output,'atlas','--columns=4','--rows=2','--cell-width=512','--cell-height=512','--baseline=476','--islands'],{stdio:'inherit'});
 const path=output.replace(/\.webp$/,'.json'),meta=JSON.parse(await fs.readFile(path));
 await fs.writeFile(path,JSON.stringify({...meta,referenceHeight:455,nativeFacing:'left',colour:kind.toLowerCase(),mouth:[122,207]},null,2)+'\n');
}
