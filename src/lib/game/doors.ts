import { INTERIORS, interiorAt, interiorsInRange } from "@/lib/game/decor";
import { WORLD_LENGTH } from "@/lib/game/world";

export type RoomLocation = NonNullable<ReturnType<typeof interiorAt>>;
/** A room's absolute bounds identify it across repeated laps. */
export function roomAt(x: number): RoomLocation | null {
  const room = interiorAt(x);
  if (!room) return null;
  const lap = Math.floor(x / WORLD_LENGTH) * WORLD_LENGTH;
  return { ...room, from: room.from + lap, to: room.to + lap };
}
export function sameRoom(a: RoomLocation | null, b: RoomLocation | null) {
  return a?.from === b?.from;
}
/** Whether x lies in `room` (null: outdoors), without building a location every frame. */
export function inRoom(x: number, room: RoomLocation | null): boolean {
  if (x < 0) return room === null;
  const lap = Math.floor(x / WORLD_LENGTH) * WORLD_LENGTH, local = x - lap;
  for (let i = 0; i < INTERIORS.length; i++) {
    const inside = INTERIORS[i];
    if (local >= inside.from && local <= inside.to) return room?.from === inside.from + lap;
  }
  return room === null;
}
/** Split a walk at each door, including reverse travel and long trips to the tavern. */
export function nextDoor(from: number, to: number): { x: number; destination: RoomLocation | null } | null {
  const direction = Math.sign(to - from);
  if (!direction) return null;
  const doors = interiorsInRange(Math.min(from, to) - 1, Math.max(from, to) + 1)
    .flatMap(room => [room.from, room.to])
    .filter(x => direction > 0 ? x > from + 0.01 && x <= to : x < from - 0.01 && x >= to)
    .sort((a, b) => direction * (a - b));
  if (!doors.length) return null;
  const x = doors[0];
  return { x, destination: roomAt(x + direction * 0.1) };
}
