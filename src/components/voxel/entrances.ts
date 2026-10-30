import * as THREE from "three";
import type { RoomLocation } from "@/lib/game/doors";
import { VoxelResources } from "./resources";
import { letterBoard, lantern } from "./scenery";

/** Recognisable public buildings, with a real door opening, rather than cottages.
 * Shared bounds are reserved by portalFootprint before any trees are planted. */
export function entranceBuilding(r: VoxelResources, room: RoomLocation, exit = false) {
  const root = new THREE.Group(), b = r.batch(root, true, 0, true);
  const factory = room.id === "factory", tavern = room.id === "tavern";
  const plaster = factory ? 0x9b7358 : tavern ? 0xd3b286 : 0xc8c2aa;
  const trim = factory ? 0x4b625e : tavern ? 0x62432c : 0x788077;
  const roof = factory ? 0x506b69 : tavern ? 0x975b43 : 0x6b7f76;
  b.box(0x858876, 0, -.15, 0, 9, .95, 6.3);
  // Front wall split around a two-metre-wide, three-metre-high opening.
  for (const side of [-1, 1]) {
    b.box(plaster, side * 2.8, 2.65, 2.95, 3.4, 4.7, .25);
    b.box(plaster, side * 4.35, 2.65, 0, .3, 4.7, 6.1);
    b.box(trim, side * 1.13, 1.85, 3.13, .2, 3.1, .4);
    for (const x of [-3.25, -2, 2, 3.25]) {
      b.box(trim, x, 2.2, side * 3.1, .98, 1.7, .2);
      b.box(0xffd79b, x, 2.2, side * 3.23, .75, 1.42, .05, 0, true);
      b.box(trim, x, 2.2, side * 3.28, .06, 1.45, .06);
      b.box(trim, x, 2.2, side * 3.28, .78, .08, .06);
    }
  }
  b.box(plaster, 0, 2.65, -2.95, 8.8, 4.7, .3);
  b.box(plaster, 0, 4.35, 2.95, 2.2, 1.3, .25);
  b.box(trim, 0, 3.4, 3.15, 2.5, .22, .45);
  b.box(trim, 0, .45, 3.15, 2.35, .2, .6);
  // Dark vestibule is visible when the door swings inward. No solid slab in it.
  b.box(0x302d29, 0, 1.85, 1.5, 2.1, 3, .1);
  if (factory) {
    b.box(roof, 0, 5.05, 0, 9.4, .35, 6.7);
    for (const x of [-3, 0, 3]) b.box(0x78918b, x, 5.5, -.6, 2.4, .7, 2.3);
    for (const x of [-3.4, 3.4]) {
      b.box(0x775b49, x, 6, -1.8, .8, 3.2, .9);
      b.box(0x3e4b47, x, 7.7, -1.8, 1.1, .3, 1.2);
    }
    // Oversized sheets identify the CV press, even on a narrow screen.
    b.box(0xe3dbc0, -3.2, 4.6, 3.21, .9, 1.2, .12);
    for (let i = 0; i < 3; i++) b.box(0x707969, -3.2, 4.9 - i * .22, 3.29, .55, .07, .03);
  } else {
    for (const side of [-1, 1]) for (let row = 0; row < 10; row++)
      b.box(new THREE.Color(roof).multiplyScalar(.92 + row % 3 * .05), 0, 6.7 - row * .16, side * row * .35, 9.5, .24, .38);
    b.box(trim, 0, 6.85, 0, 9.6, .2, .4);
    if (tavern) {
      for (const x of [-4.25, -2.25, 2.25, 4.25]) b.box(trim, x, 2.7, 3.14, .18, 4.8, .22);
      for (const y of [.5, 3.15, 4.9]) b.box(trim, 0, y, 3.15, 8.8, .18, .2);
      b.box(0x8e806c, -3, 6.4, -1.4, .8, 2.4, .9);
      b.box(trim, -3, 7.65, -1.4, 1.1, .2, 1.15);
    } else {
      for (const x of [-4, -1.45, 1.45, 4]) {
        b.box(0xb6b7a1, x, 2.5, 3.2, .32, 4.3, .5);
        b.box(trim, x, .5, 3.2, .55, .25, .7);
        b.box(trim, x, 4.7, 3.2, .55, .25, .7);
      }
      b.box(0xb8aa72, 0, 5.8, 3, 1, .95, .14);
      b.box(0x364e49, 0, 5.8, 3.09, .12, .65, .06);
      b.box(0x364e49, .18, 5.8, 3.09, .4, .1, .06);
    }
  }
  const door = new THREE.Group(), d = r.batch(door, false, 0, true);
  door.position.set(-1, .36, 3.04);
  d.box(factory ? 0x4f706b : 0x805733, 1, 1.45, 0, 1.94, 2.9, .16);
  for (const y of [.35, 2.5]) d.box(trim, 1, y, .11, 1.85, .13, .08);
  d.box(0xe7bf6a, 1.75, 1.4, .14, .12, .22, .1);
  d.finish(); root.add(door); root.userData.door = door;
  const title = exit ? `${room.name} · Sortie` : room.id === "orp" ? "CENTRE ORP" : factory ? "L’USINE À CV" : "LA TAVERNE";
  const board = letterBoard(r, title, 5.8, .9, "wall", true);
  board.position.set(0, 2.45, 3.39); root.add(board);
  for (const x of [-1.6, 1.6]) {
    const lamp = lantern(r, 2.8, 12); lamp.position.set(x, .1, 3.4); root.add(lamp);
  }
  b.finish(); root.name = `entrance-${room.id}`;
  root.userData.contactFootprint = { rx: 4.8, rz: 3.6 };
  return root;
}
