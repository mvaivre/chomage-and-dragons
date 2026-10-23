import type { ActionKind, PowerKind, MiniGameKind, CheerEmoji } from "@/lib/data/types";
import { ACTION_ICONS, POWER_ICONS, GAME_ICONS } from "@/lib/game/art";
import { VoxelIcon } from "./VoxelIcon";
import type { VoxelIconName } from "@/lib/game/voxel-icons";

interface ArtworkProps { className?: string; priority?: boolean }
export const CHEER_ICONS:Record<CheerEmoji,{name:VoxelIconName;label:string}>={'👏':{name:'applause',label:'Bravo'},'🍺':{name:'mug',label:'À ta santé'},'🔥':{name:'fire',label:'Bien joué'},'😂':{name:'laugh',label:'Ça me fait rire'},'🫂':{name:'hug',label:'Courage'}};
export function ActionArtwork({kind,className}:ArtworkProps&{kind:ActionKind}){return <VoxelIcon name={ACTION_ICONS[kind]} className={className}/>;}
export function PowerArtwork({kind,className}:ArtworkProps&{kind:PowerKind}){return <VoxelIcon name={POWER_ICONS[kind]} className={className}/>;}
export function ChestArtwork({className}:ArtworkProps){return <VoxelIcon name="chest" className={className}/>;}
export function CrownArtwork({className}:ArtworkProps){return <VoxelIcon name="crown" className={className}/>;}
export function GameArtwork({kind,className}:ArtworkProps&{kind:MiniGameKind}){return <VoxelIcon name={GAME_ICONS[kind]} className={className}/>;}
export function RelicArtwork({model,className}:{model:string;className?:string}){return <VoxelIcon name={({letter:'letter',key:'key',scroll:'scroll',tankard:'mug',compass:'compass',crystal:'crystal',lamp:'lamp',hammer:'hammer',crown:'crown'} as Record<string,VoxelIconName>)[model]??'spark'} className={className}/>;}
export function CheerArtwork({emoji,className}:{emoji:CheerEmoji;className?:string}){return <VoxelIcon name={CHEER_ICONS[emoji].name} className={className}/>;}
