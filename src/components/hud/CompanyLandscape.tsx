import { VOXEL_ICONS, type VoxelIconName } from "@/lib/game/voxel-icons";
import { BIOMES } from "@/lib/game/world";
const COLORS=['#708a50','#426848','#627458','#799c8d','#6e9590','#b7c6ba','#c6a66b','#665550','#657d46'];
const SCENES:VoxelIconName[][]=[['house','tree'],['tree','tree'],['frog','tree'],['house','compass'],['mountain','crystal'],['mountain','mountain'],['lamp','coins'],['mountain','dragon'],['house','mug']];
/** A lightweight voxel atlas. Pin positions still use the real saved journey. */
export function CompanyLandscape({route}:{route:string}){
 return <svg className="journey-map__landscape" viewBox="0 0 600 400" aria-hidden="true">
  <rect width="600" height="400" fill="#122d29" />
  {COLORS.map((color,i)=>{const x=60+i*53.34;return <g key={i}>
   <path d={`M${x} 330h54v23h-54z`} fill={i===7?'#3d3638':'#485344'} />
   <path d={`M${x} 125h54v205h-54z`} fill={color} />
   {Array.from({length:14},(_,k)=><rect key={k} x={x+((k*17+i*7)%48)} y={142+(k*31+i*11)%173} width={3+k%3} height={2+k%2} fill={k%3?'#e6dfb6':'#203c2b'} opacity=".19" />)}
   <title>{BIOMES[i].name}</title>
  </g>;})}
  <path d="M230 124l-5 45 10 30-8 44 8 44-5 44M330 124l8 30-4 39 10 37-4 40 7 61" fill="none" stroke="#67a5a3" strokeWidth="12" />
  <polyline points={route} fill="none" stroke="#ac9769" strokeWidth="22" strokeLinejoin="bevel" />
  <polyline points={route} fill="none" stroke="#e0cf96" strokeWidth="16" strokeLinejoin="bevel" />
  <polyline points={route} fill="none" stroke="#bba77b" strokeWidth="1" strokeDasharray="3 8" />
  {SCENES.flatMap((names,i)=>names.map((name,j)=><g key={`${i}:${j}`} transform={`translate(${65+i*53+j*9},${j?204:151}) scale(${j?.46:.6})`}>
   {VOXEL_ICONS[name].map((f,k)=><polygon key={k} points={f.points} fill={f.fill} stroke={f.fill} strokeWidth=".12"/>)}
  </g>))}
  <text x="60" y="104" fill="#d8ca9a" fontSize="13" fontFamily="Georgia">Du premier pas…</text>
  <text x="540" y="380" textAnchor="end" fill="#d8ca9a" fontSize="13" fontFamily="Georgia">…à la taverne</text>
 </svg>;
}
