"use client";
import type { VoxelPainter } from "./arena";
import { useArenaCanvas, type ArenaView } from "./useArena";

export function VoxelDisplay({
  draw,
  width = 360,
  height = 240,
  className = "",
}: {
  draw: (painter: VoxelPainter, view: ArenaView) => void;
  width?: number;
  height?: number;
  className?: string;
}) {
  const { arena, canvas } = useArenaCanvas<HTMLDivElement>(
    { width, height },
    (painter, view) => draw(painter, view),
  );
  return (
    <div ref={arena} className={`voxel-display ${className}`}>
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}
