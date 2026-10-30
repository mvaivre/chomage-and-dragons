import { VOXEL_ICONS, type VoxelIconName } from "@/lib/game/voxel-icons";

/** Flat-shaded isometric blocks, with the same 64px optical frame in every UI. */
export function VoxelIcon({ name, className = "" }: { name: VoxelIconName; className?: string }) {
  return <svg viewBox="0 0 64 64" width="64" height="64" className={`voxel-icon ${className}`} data-voxel-icon={name} aria-hidden="true" focusable="false">
    {VOXEL_ICONS[name].map((face, i) => <polygon key={i} points={face.points} fill={face.fill} stroke={face.fill} strokeWidth=".12" strokeLinejoin="miter" />)}
  </svg>;
}
