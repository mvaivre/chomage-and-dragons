/** Tiny isometric models for the UI. Pure geometry: no texture, WebGL or animation loop. */
export const ICON_NAMES = ['pigeon','refusal','interview','stamp','castle','chest','crown','mug','fire','dragon','papers','frog','letter','key','scroll','compass','crystal','lamp','hammer','ghost','coins','flag','sword','snake','stack','paddle','undo','sound','effects','mute','applause','laugh','hug','book','map','menu','spark','tree','mountain','house'] as const;
export type VoxelIconName = typeof ICON_NAMES[number];
type Box = { x:number; y:number; z:number; w:number; h:number; d:number; color:string };
const C={ivory:'#e5dfbe',paper:'#f4edcf',gold:'#d5a84e',wood:'#8d613d',dark:'#35473e',green:'#63874f',red:'#b9574c',slate:'#729397',skin:'#dab58a',blue:'#608799'};
function model(name:VoxelIconName) {
 const boxes:Box[]=[];
 const box=(color:string,x:number,y:number,z:number,w:number,h=w,d=w)=>boxes.push({color,x,y,z,w,h,d});
 const sheet=(x=0,y=0,z=0)=>{box(C.paper,x,y+.14,z,3.7,.28,2.6);box(C.gold,x+1.5,y+.31,z-.9,.5,.1,.5);};
 const cross=(x:number,y:number,z:number)=>{box(C.red,x,y,z,1.4,.16,.4);box(C.red,x,y,z,.4,.16,1.4);};
 const mug=()=>{box(C.gold,0,1.4,0,2.2,2.8,2);box(C.ivory,0,2.9,0,2.3,.35,2.1);box(C.paper,-.4,3.15,-.2,1.1,.35,1.2);box(C.wood,1.6,1.5,0,.45,1.8,1.2);box(C.gold,1.1,.6,0,.7,.4,1.2);};
 const head=(x:number,z:number,color:string)=>{box(color,x,.95,z,1.2,1.9,1);box(C.skin,x,2.5,z,1.2,1.1,1.1);box(C.dark,x+.22,2.6,z+.57,.16,.16,.08);};
 switch(name){
 case 'pigeon':
  sheet(.3,.1,.7);box(C.slate,0,1.5,0,2.2,1.4,1.4);box('#a7b5aa',.7,2.45,0,1.2,1.2,1.1);box(C.gold,1.5,2.45,.1,.65,.4,.6);box(C.dark,.95,2.7,.58,.2,.2,.12);
  for(const s of[-1,1]){box('#8a9c9c',-.55,2,s*1.2,1.8,.3,1);box('#afb9ad',-.7,2.4,s*1.8,1.4,.3,.5);}break;
 case 'refusal':sheet();cross(0,.4,0);box(C.red,-1,.6,-.6,.4,.5,.4);break;
 case 'interview':
  head(-1.2,-1.5,C.green);head(1.2,1.5,C.red);box(C.wood,0,1.4,0,3.8,.4,1.8);for(const x of[-1.4,1.4])box(C.dark,x,.6,0,.35,1.2,1.5);sheet(0,1.62,0);break;
 case 'stamp':sheet(0,0,.4);cross(0,.42,.4);box(C.red,0,.85,0,3,.7,2.3);box(C.wood,0,1.8,0,.75,1.6,.75);box(C.gold,0,2.65,0,1.8,.45,1.2);break;
 case 'castle':
  box('#aaa78a',0,1.2,0,3.8,2.4,2.5);for(const x of[-1.8,1.8]){box('#c8c2a4',x,1.8,0,1.3,3.6,1.5);for(const dx of[-.4,.4])box(C.ivory,x+dx,3.8,0,.35,.4,1.5);}box(C.wood,0,.8,1.28,1,1.6,.15);box(C.gold,1.8,4.8,0,.13,2,.13);box(C.red,2.4,5.4,0,1.3,.8,.15);break;
 case 'chest':
  box(C.wood,0,1.05,0,4,2.1,2.7);box('#ad7c44',0,2.2,0,4.1,.65,2.8);for(const x of[-1.45,1.45]){box(C.gold,x,1.25,1.4,.3,2.4,.12);box(C.gold,x,2.58,0,.3,.12,2.8);}box(C.gold,0,1.6,1.5,.7,.8,.2);box(C.dark,0,1.55,1.63,.14,.25,.06);break;
 case 'crown':
  box(C.gold,0,.5,0,4,.8,2);for(const x of[-1.5,0,1.5]){box(C.gold,x,1.5,0,.8,1.5,1.8);box('#f0cc70',x,2.35,0,.6,.3,1.4);}box(C.red,0,.85,1.08,.55,.45,.18);break;
 case 'mug':mug();break;
 case 'fire':
  box(C.red,0,.45,0,2.9,.9,1.7);box('#de793b',-.25,1.3,0,2.3,1.1,1.5);box('#e7a54a',.15,2.25,0,1.5,1.1,1.1);box('#f4d57b',.6,3.1,0,.7,.7,.7);box('#f4d57b',-.4,1.4,.65,.8,1.2,.4);break;
 case 'dragon':
  box(C.green,0,1.2,0,2.2,2,2);box('#81a663',.7,2.2,.2,2.5,1.4,1.8);box(C.green,1.7,1.7,.3,1.4,.7,1.6);box(C.gold,.5,3.2,-.5,.45,1.2,.45);box(C.gold,-.3,3.2,.6,.45,1.2,.45);box(C.dark,1.3,2.5,1.14,.25,.25,.12);for(const s of[-1,1]){box('#a88959',-.6,2,s*1.8,2.1,.25,1.5);box('#bdab71',-.8,2.35,s*2.4,1.4,.25,.7);}break;
 case 'papers':case 'scroll':case 'letter':
  if(name==='papers')for(let i=0;i<4;i++)sheet((i%2)*.2,i*.3,(i%3)*.15);else sheet();
  if(name==='scroll')for(const x of[-1.8,1.8])box(C.gold,x,.4,0,.45,.5,2.8);
  if(name==='letter'){box(C.gold,0,.34,0,.65,.15,.65);for(const s of[-1,1])box('#bcb18d',s*.7,.3,s*.4,.9,.07,.12);}
  else for(let i=0;i<3;i++)box('#8e927e',0,(name==='papers'?1.4:.32),-.7+i*.6,2,.08,.15);break;
 case 'frog':
  box(C.green,0,.8,0,2.6,1.4,2.1);for(const s of[-1,1]){box('#84a563',s*1.3,.3,.7,1.2,.45,1.6);box('#94ad70',s*.8,1.8,.5,.75,.75,.75);box(C.dark,s*.8,1.9,.9,.28,.3,.12);}box(C.red,0,.9,1.1,1.2,.15,.1);break;
 case 'key':
  for(const x of[-.8,.8])box(C.gold,x,.25,-1.3,.5,.5,1.5);for(const z of[-2,-.6])box(C.gold,0,.25,z,1.4,.5,.4);box(C.gold,0,.25,1,.5,.5,3);for(const z of[1.3,2.2])box(C.gold,.6,.25,z,1,.5,.4);break;
 case 'compass':box(C.wood,0,.3,0,3.5,.6,3.5);box(C.gold,0,.68,0,3.1,.15,3.1);box(C.ivory,0,.8,0,2.5,.1,2.5);box(C.red,0,.92,-.55,.35,.15,1.3);box(C.blue,0,.92,.55,.35,.15,1.3);break;
 case 'crystal':for(const [x,z,h]of[[-1,.2,2.2],[0,0,3.8],[1,.4,2.8]]){box(C.blue,x,h/2,z,.9,h,.9);box('#b5dbd1',x,h+.15,z,.5,.3,.5);}break;
 case 'lamp':box(C.wood,0,.25,0,2.7,.5,2.5);box(C.gold,0,1.6,0,1.7,2.3,1.6);box('#f2d995',0,1.6,.85,1.2,1.6,.12);box(C.dark,0,3,0,2.2,.4,2);box(C.gold,0,3.5,0,.6,.7,.6);break;
 case 'hammer':box(C.wood,0,1.7,0,.6,3.4,.6);box(C.slate,0,3.3,0,3.1,1.2,1.6);box(C.gold,0,3.3,.85,.6,1.2,.12);break;
 case 'ghost':box(C.ivory,0,1.5,0,2.6,2.5,1.7);box(C.paper,0,3,0,1.7,.6,1.4);for(const x of[-.7,.7]){box(C.dark,x,2.3,.9,.35,.45,.12);box(C.ivory,x,.15,0,.5,.3,1.7);}box(C.dark,0,1.4,.9,.6,.2,.12);break;
 case 'coins':for(let i=0;i<5;i++)box(C.gold,(i%2)*1.5-.7,.2+Math.floor(i/2)*.5,(i%2)*.8,2,.4,1.6);break;
 case 'flag':box(C.wood,-1,2,0,.25,4,.25);for(let x=0;x<4;x++)for(let y=0;y<3;y++)box((x+y)%2?C.ivory:C.dark,-.5+x*.6,3.7-y*.6,0,.6,.6,.18);break;
 case 'sword':box(C.wood,0,.7,0,.5,1.4,.5);box(C.gold,0,1.5,0,2.5,.3,.6);box(C.slate,0,2.9,0,.8,2.5,.35);box(C.ivory,.1,4.3,0,.35,.4,.25);break;
 case 'snake':for(const[x,z]of[[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1]])box(C.green,x,.55,z,1,.9,1);box('#91ae66',-1,.8,-1,1.5,1.2,1.3);box(C.dark,-1,1.1,-.3,.22,.22,.12);break;
 case 'stack':for(let y=0;y<3;y++)for(let x=0;x<3-y;x++)box([C.wood,C.gold,C.green][y],x-1+y*.5,y+.5,0,.95,.95,1.3);break;
 case 'paddle':box(C.wood,0,.7,0,.45,1.4,.4);box(C.red,0,2.4,0,2.4,2.1,.5);box(C.red,0,3.6,0,1.6,.4,.5);box(C.ivory,1.9,1.5,.4,.6,.6,.6);break;
 case 'undo':for(const[x,y,w,h]of[[0,3,3,.55],[1.3,2,.55,2],[-.1,1,3,.55],[-1.5,3.5,.55,1.4],[-2,3,.8,.55],[-1.5,2.5,.55,1.4]])box(C.ivory,x,y,0,w,h,.5);break;
 case 'sound':case 'effects':case 'mute':box(C.gold,-.6,1.5,0,1.2,1.8,1.5);box(C.gold,.45,1.5,0,1,2.8,2);box(C.dark,1.02,1.5,0,.12,1.95,1.45);if(name==='mute'){for(let i=0;i<4;i++)box(C.red,1.4+i*.35,2.7-i*.65,.2,.5,.7,.35);}else for(let i=0;i<(name==='sound'?2:1);i++)box(C.ivory,1.5+i*.9,1.5,0,.3,1.3+i*.8,.3);break;
 case 'applause':case 'hug':for(const s of[-1,1]){box(C.skin,s*.7,1.3,s*.2,.9,2,1.2);box(C.gold,s*1.3,2.3,s*.2,.45,1,.6);}if(name==='hug')box(C.red,0,1.2,1.1,.75,.75,.4);break;
 case 'laugh':box(C.gold,0,1.7,0,3,3,1.3);for(const x of[-.7,.7])box(C.dark,x,2.2,.7,.5,.2,.12);box(C.dark,0,1.3,.7,1.4,.7,.12);box(C.ivory,0,1.5,.8,1.2,.2,.08);break;
 case 'book':case 'map':box(name==='map'?C.green:C.wood,0,.7,0,3.8,1.2,3);box(C.ivory,0,1.35,0,3.5,.16,2.7);box(C.gold,0,1.5,0,.25,.12,2.7);for(const s of[-1,1])for(let i=0;i<3;i++)box(C.dark,s*.9,1.46,-.8+i*.8,1,.08,.12);break;
 case 'menu':for(let i=0;i<3;i++)box(C.ivory,0,.5+i*.9,0,3,.35,.5);break;
 case 'spark':box(C.gold,0,2,0,.6,3.6,.6);box(C.gold,0,2,0,3.6,.6,.6);box(C.ivory,0,2,0,1.4,1.4,.9);break;
 case 'tree':box(C.wood,0,1,0,.7,2,.7);for(let i=0;i<3;i++)box(i===2?'#8a9d62':C.green,0,1.7+i*.8,0,3.7-i*.8,.9,3.7-i*.8);break;
 case 'mountain':for(let i=0;i<4;i++)box(i===3?C.ivory:C.slate,0,.5+i*.8,0,4-i*.9,.9,4-i*.9);break;
 case 'house':box(C.ivory,0,1.3,0,3,2.6,2.6);for(let i=0;i<3;i++)box(C.wood,0,2.8+i*.4,0,3.6-i*.8,.5,3.1-i*.7);box(C.dark,0,.8,1.35,.75,1.6,.15);break;
 }
 return boxes;
}
const project=(x:number,y:number,z:number)=>[.82*(x-z),.4*(x+z)-y];
const shade=(hex:string,k:number)=>'#'+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*k)).toString(16).padStart(2,'0')).join('');
export type IconFace={points:string;fill:string};
export function iconFaces(name:VoxelIconName):IconFace[]{
 const faces:{p:number[][];fill:string}[]=[];
 for(const b of model(name).sort((a,b)=>(a.x+a.z+a.y*.5)-(b.x+b.z+b.y*.5))){
  const x=b.x-b.w/2,X=b.x+b.w/2,y=b.y-b.h/2,Y=b.y+b.h/2,z=b.z-b.d/2,Z=b.z+b.d/2;
  faces.push({p:[[x,Y,Z],[X,Y,Z],[X,y,Z],[x,y,Z]].map(p=>project(...p as [number,number,number])),fill:shade(b.color,.87)},
   {p:[[X,Y,Z],[X,Y,z],[X,y,z],[X,y,Z]].map(p=>project(...p as [number,number,number])),fill:shade(b.color,.69)},
   {p:[[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]].map(p=>project(...p as [number,number,number])),fill:shade(b.color,1.12)});
 }
 const ps=faces.flatMap(f=>f.p),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]),loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys),scale=Math.min(52/(hiX-loX),52/(hiY-loY));
 return faces.map(f=>({fill:f.fill,points:f.p.map(([x,y])=>`${((x-(hiX+loX)/2)*scale+32).toFixed(2)},${((y-(hiY+loY)/2)*scale+32).toFixed(2)}`).join(' ')}));
}
export const VOXEL_ICONS=Object.fromEntries(ICON_NAMES.map(name=>[name,iconFaces(name)])) as Record<VoxelIconName,IconFace[]>;
