/** A patrol has two walks and two pauses; a turnaround only happens while stopped. */
export function trollPatrol(time: number) {
  const phase = ((time % 20) + 20) % 20;
  const reverse = phase >= 10, leg = phase % 10;
  const moving = leg < 7;
  const progress = Math.min(1, leg / 7);
  const travel = (1 - Math.cos(progress * Math.PI)) * 60;
  return { offset: reverse ? 60 - travel : -60 + travel, direction: reverse ? -1 : 1, moving, distance: travel };
}

/** Pose cadence follows ground covered, so slowing and stopping never moonwalk. */
export function trollWalkFrame(distance: number) {
  return Math.floor(Math.max(0, distance) / 10) % 4;
}
