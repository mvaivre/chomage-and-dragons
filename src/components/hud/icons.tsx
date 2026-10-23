import { VoxelIcon } from "./VoxelIcon";
interface IconProps { className?: string }
export function UndoIcon({className}:IconProps){return <VoxelIcon name="undo" className={className}/>;}
export function ScrollIcon({className}:IconProps){return <VoxelIcon name="map" className={className}/>;}
