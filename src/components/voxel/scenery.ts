import * as THREE from "three";
import type { ContactPatch } from "./contact-shadows";
import { VoxelResources } from "./resources";
import { routeHeight, routeZ } from "./world";
import { factoryLine, factoryStations, FACTORY_AISLE } from "./factory";

/** Text belongs to the board, on both faces, and follows perspective/occlusion. */
export function letterBoard(
  r: VoxelResources,
  text: string,
  width = 2.8,
  height = 1.05,
  mount: "post" | "wall" = "post",
) {
  const root = new THREE.Group(),
    b = r.batch(root, false, 0, true);
  root.userData.text = text;
  root.userData.sign = true;
  if (mount === "post") b.box(0x65452c, 0, 0.9, 0, 0.14, 1.8, 0.14);
  b.box(0x62442e, 0, 1.75, 0, width + 0.14, height + 0.15, 0.16);
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round(canvas.width * height / width);
  const c = canvas.getContext("2d")!, w = canvas.width, h = canvas.height;
  c.fillStyle = "#dbc598"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "#775a36"; c.lineWidth = Math.max(4, h * 0.025);
  const pad = Math.min(w, h) * 0.06;
  c.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
  c.fillStyle = "#392a20"; c.textAlign = "center"; c.textBaseline = "middle";
  const maxWidth = w - pad * 4;
  let fontSize = Math.min(64, h * 0.28), lines: string[] = [];
  for (;;) {
    c.font = `bold ${fontSize}px Georgia`;
    lines = []; let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (c.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    if (fontSize <= 20 || (lines.length * fontSize * 1.15 < h - pad * 3 && lines.every(l => c.measureText(l).width <= maxWidth))) break;
    fontSize -= 2;
  }
  lines.forEach((line, i) => c.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.15));
  root.userData.textLayout = { width, height, textureWidth: w, textureHeight: h, fontSize, lines };
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  r.addFog(mat, true);
  r.ownedMaterials.add(mat);
  for (const side of [-1, 1]) {
    const face = new THREE.Mesh(
      r.geometry(new THREE.PlaneGeometry(width, height)),
      mat,
    );
    face.userData.ownedMaterial = mat;
    face.userData.ownedGeometry = face.geometry;
    face.position.set(0, 1.75, side * 0.086);
    face.rotation.y = side < 0 ? Math.PI : 0;
    root.add(face);
  }
  root.userData.disposeTexture = () => texture.dispose();
  b.finish();
  return root;
}

export function lantern(r: VoxelResources, height = 2.5, power = 12) {
  const root = new THREE.Group(),
    b = r.batch(root);
  b.box(0x544331, 0, height / 2, 0, 0.11, height, 0.11);
  b.box(0x745b38, 0.18, height, 0, 0.55, 0.09, 0.12);
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      b.box(
        0x4c4232,
        0.32 + x * 0.13,
        height - 0.27,
        z * 0.13,
        0.035,
        0.42,
        0.035,
      );
  b.box(0xffc66d, 0.32, height - 0.27, 0, 0.2, 0.29, 0.2, 0, true);
  for (const y of [-0.5, 0])
    b.box(0x6b5132, 0.32, height + y, 0, 0.38, 0.08, 0.38);
  const light = r.pointLight(0xffb85e, power, 6.5, 2);
  light.position.set(0.32, height - 0.27, 0);
  root.add(light);
  root.userData.lamp = light;
  root.userData.power = power;
  b.finish();
  return root;
}

/** Small timber buildings retain the scale and craftsmanship of the approved tile. */
export function cottage(
  r: VoxelResources,
  title: string,
  roofColor = 0x9a633f,
) {
  const root = new THREE.Group(),
    b = r.batch(root, false, 0, true);
  const surface = r.batch(root, true, 0, true);
  const stone = [0x7a8070, 0x8c8d79, 0x676e61];
  const pick = (a: number[], i: number) => a[Math.abs(i) % a.length];
  // The solid foundation and plaster panels do not need filled volumes of cubes.
  surface.box(stone[0], 0, 0.15, 0, 4.6, 0.3, 3.4);
  for (const side of [-1, 1]) {
    if (side < 0) surface.box(0xc7b998, 0, 1.6, side * 1.6, 4.6, 2.6, 0.22);
    else {
      for (const x of [-1.4, 1.4])
        surface.box(0xc7b998, x, 1.6, 1.6, 1.8, 2.6, 0.22);
      surface.box(0xd6c5a1, 0, 2.6, 1.6, 1, 0.6, 0.22);
    }
    surface.box(0xb9ac8b, side * 2.2, 1.6, 0, 0.22, 2.6, 3.4);
    for (const x of [-2.2, 0, 2.2])
      b.box(0x59402d, x, 1.65, side * 1.74, 0.15, 2.65, 0.15);
    for (const y of [0.4, 2.9])
      b.box(0x6c4d31, 0, y, side * 1.73, 4.6, 0.17, 0.16);
    for (const x of [-1.35, 1.35]) {
      b.box(0x4e3a2b, x, 1.8, side * 1.75, 0.93, 1.08, 0.15);
      b.box(0xffca73, x, 1.8, side * 1.84, 0.72, 0.86, 0.04, 0, true);
      for (const dx of [-0.23, 0, 0.23])
        b.box(0x725033, x + dx, 1.8, side * 1.88, 0.035, 0.92, 0.04);
      b.box(0x957041, x, 1.19, side * 1.9, 1.1, 0.21, 0.35);
      for (let k = 0; k < 8; k++) {
        b.box(0x547640, x - 0.4 + k * 0.11, 1.35, side * 1.92, 0.13, 0.2, 0.22);
        if (k % 2 === 0)
          b.box(
            0xd38ca1,
            x - 0.4 + k * 0.11,
            1.5,
            side * 1.92,
            0.12,
            0.09,
            0.12,
          );
      }
    }
  }
  for (const side of [-1, 1])
    for (let d = 0; d < 12; d++) {
      surface.box(new THREE.Color(roofColor).multiplyScalar(0.9 + (d % 3) * 0.08),
        0, 4.35 - d * 0.13, side * d * 0.18, 5, 0.2, 0.19);
      // Sparse moss stays modelled; roof tile color variation is shaded.
      for (let x = -12; x <= 12; x++)
        if ((x * 7 + d * 13) % 37 === 0)
          b.box(0x627c43, x * 0.2, 4.49 - d * 0.13, side * d * 0.18, 0.18, 0.07, 0.16);
    }
  surface.box(0xbe945d, 0, 4.45, 0, 5, 0.16, 0.26);
  for (let y = 0; y < 3; y++)
    surface.box(stone[y], -1.35, 3.77 + y * 0.72, -0.7, 0.55, 0.72, 0.55);
  b.box(0xbaa486, -1.35, 5.65, -0.7, 0.78, 0.17, 0.78);
  const door = new THREE.Group(), doorBatch = r.batch(door, false, 0, true);
  door.position.set(-0.48, 0.35, 1.68);
  for (let x = 0; x < 9; x++) doorBatch.box(x % 2 ? 0x92663d : 0x7d5737, 0.08 + x * 0.1, 0.9, 0, 0.095, 1.8, 0.17);
  doorBatch.box(0xdec07e, 0.75, 0.9, 0.12, 0.08, 0.12, 0.08);
  doorBatch.finish(); root.add(door); root.userData.door = door;
  for (let i = 0; i < 3; i++)
    b.box(
      pick(stone, i),
      0,
      0.3 - i * 0.1,
      1.95 + i * 0.25,
      1.4 + i * 0.25,
      0.17,
      0.27,
    );
  for (let i = 0; i < 13; i++)
    b.box(
      0xffd99a,
      -2.2 + i * 0.37,
      3.05 - Math.sin((i / 12) * Math.PI) * 0.25,
      1.85,
      0.075,
      0.1,
      0.075,
      0,
      true,
    );
  const board = letterBoard(r, title, 3.4, 0.5, "wall");
  board.position.set(0, 0.84, 1.9);
  root.add(board);
  for (const x of [-2.5, 2.3]) {
    const lamp = lantern(r, 2.5, 14);
    lamp.position.set(x, 0, 2.3);
    root.add(lamp);
  }
  b.finish();
  surface.finish();
  root.userData.contactFootprint = { rx: 2.7, rz: 2.2 };
  return root;
}

export function interiorDetails(
  r: VoxelResources,
  room: string,
  from: number,
  to: number,
) {
  const root = new THREE.Group(),
    walls = new THREE.Group(),
    b = r.batch(root, false, 0, true),
    wb = r.batch(walls, false, 0, true),
    cx = (from + to) / 2,
    z = routeZ(cx),
    base = routeHeight(cx);
  root.position.set(cx, base, z);
  root.userData.interior = true;
  root.userData.backwall = walls;
  root.add(walls);
  const factory = room === "factory",
    tavern = room === "tavern";
  const timber = 0x5e402c;
  const floorSurface = r.batch(root, true), wallSurface = r.batch(walls, true, 0, true);
  const contacts: ContactPatch[] = [];
  root.userData.contactPatches = contacts;
  for (let x = from; x < to; x += 0.5) {
    const h = routeHeight(x) - base;
    if (tavern || factory) floorSurface.box(factory ? 0x817e69 : 0xa27b4f, x - cx, h + 0.045, -0.2, 0.49, 0.25, 10.245);
    else for (let d = -5.2; d <= 4.8; d += 0.25) {
      const c = factory
        ? 0x817e69
        : (Math.round(x * 2) + Math.round(d * 4)) % 3
          ? 0xa27b4f
          : 0x92673e;
      b.box(c, x - cx, h + 0.045, d, 0.49, 0.25, 0.245);
    }
    if (tavern || factory) wallSurface.box(factory ? 0x78867b : 0xb7a586, x - cx, h + 2.075, -5.3, 0.505, 4, 0.3);
    else for (let y = 0.2; y < 4.2; y += 0.25)
      wb.box(
        factory
          ? 0x78867b
          : (Math.round(x * 2) + Math.round(y * 4)) % 3
            ? 0xb7a586
            : 0xc8b38d,
        x - cx,
        h + y,
        -5.3,
        0.505,
        0.25,
        0.3,
      );
    if (Math.abs((x - from) % 4) < 0.5) {
      wb.box(timber, x - cx, h + 2.1, -5.04, 0.17, 4.2, 0.18);
      wb.box(timber, x - cx, h + 4.25, -4.6, 0.2, 0.23, 1.5);
    }
  }
  // Shallow open front and a rear wall that cuts away when the camera moves behind it.
  for (let x = from; x < to; x += 0.5)
    b.box(timber, x - cx, routeHeight(x) - base - 0.25, 5, 0.5, 0.3, 0.2);
  const furnishings = factory ? factoryStations(from, to).map(s => s.x) : Array.from({ length: Math.ceil((to - from - 4) / 6) }, (_, i) => from + 3 + i * 6);
  for (const [n, x] of furnishings.entries()) {
    const xx = x - cx,
      y = routeHeight(x) - base;
    const lamp = lantern(r, 2.7, factory ? 10 : 15);
    lamp.position.set(factory ? xx - 2.05 : xx + 2, factory ? routeHeight(x - 2.05) - base : y, factory ? -4.2 : -3.9);
    root.add(lamp);
    if (!tavern) {
      wb.box(0x463c32, xx, y + 2.35, -5.02, 1.8, 1.75, 0.12);
      wb.box(
        factory ? 0x96ccc1 : 0xabc4c4,
        xx,
        y + 2.35,
        -4.94,
        1.55,
        1.5,
        0.06,
        0,
        true,
      );
      for (const dx of [-0.5, 0, 0.5])
        wb.box(timber, xx + dx, y + 2.35, -4.88, 0.06, 1.6, 0.05);
      wb.box(timber, xx, y + 2.35, -4.88, 1.65, 0.06, 0.05);
    }
    if (!factory && !tavern) {
      // Public service counters, paperwork, quills, numbered notices and waiting chairs.
      b.box(0x785336, xx, y + 0.55, -2.6, 3.2, 1.1, 1.4);
      b.box(0xba9159, xx, y + 1.15, -2.6, 3.5, 0.18, 1.6);
      for (let k = 0; k < 7; k++)
        b.box(
          k % 2 ? 0xd0c09d : 0xe8ddbb,
          xx - 0.9,
          y + 1.3 + k * 0.055,
          -2.6,
          0.7,
          0.05,
          0.55,
        );
      b.box(0x634237, xx + 0.8, y + 1.33, -2.4, 0.35, 0.2, 0.3);
      b.box(0x332d33, xx + 0.8, y + 1.55, -2.4, 0.1, 0.3, 0.1);
      b.box(0xddd3ad, xx + 0.4, y + 1.7, -2.4, 0.06, 0.6, 0.1, 0.3);
      const number = letterBoard(
        r,
        `GUICHET ${n + 1} · Pause réglementaire`,
        2.6,
        0.6,
        "wall",
      );
      number.name = `counter-sign:${n}`;
      number.position.set(xx, y + 2, -4.7);
      walls.add(number);
      for (let k = 0; k < 3; k++) {
        const sx = xx - 0.85 + k * 0.8;
        b.box(0x5d725b, sx, y + 0.48, 3, 0.65, 0.12, 0.62);
        b.box(0x5d725b, sx, y + 0.8, 3.3, 0.65, 0.6, 0.09);
        for (const side of [-1, 1])
          b.box(timber, sx + side * 0.23, y + 0.23, 3, 0.07, 0.46, 0.5);
      }
    } else if (tavern) {
      contacts.push(
        { x, y: routeHeight(x) + 0.195, z: z - 3.1, rx: 2.4, rz: 0.9, opacity: 0.8 },
        { x, y: routeHeight(x) + 0.195, z: z + 2.8, rx: 1.25, rz: 0.85, opacity: 0.8 },
      );
      // A real bar, bottles, mugs and individual tables rather than office furniture.
      wb.box(timber, xx, y + 0.9, -4.8, 4.1, 0.12, 0.5);
      wb.box(timber, xx, y + 2, -4.8, 4.1, 0.12, 0.5);
      wb.box(timber, xx, y + 3.1, -4.8, 4.1, 0.12, 0.5);
      for (let shelf = 0; shelf < 3; shelf++)
        for (let k = 0; k < 11; k++) {
          const c = [0x507d5b, 0xb27744, 0x82485f, 0x9bab70][k % 4];
          wb.box(
            c,
            xx - 1.65 + k * 0.33,
            y + 1.2 + shelf * 1.1,
            -4.7,
            0.14,
            0.4,
            0.16,
          );
          wb.box(
            c,
            xx - 1.65 + k * 0.33,
            y + 1.46 + shelf * 1.1,
            -4.7,
            0.07,
            0.16,
            0.08,
          );
        }
      b.box(0x775035, xx, y + 0.65, -3.1, 4.3, 1.3, 1.4);
      b.box(0xc19456, xx, y + 1.35, -3.1, 4.6, 0.18, 1.6);
      for (let k = 0; k < 4; k++) {
        b.box(0xd2ac63, xx - 1.2 + k * 0.7, y + 1.6, -2.9, 0.26, 0.35, 0.28);
        b.box(0xe4d6a7, xx - 1.2 + k * 0.7, y + 1.8, -2.9, 0.28, 0.05, 0.3);
      }
      b.box(0x9d6e3b, xx, y + 0.9, 2.8, 2.2, 0.2, 1.4);
      for (const dx of [-0.8, 0.8]) {
        b.box(timber, xx + dx, y + 0.45, 2.8, 0.13, 0.9, 1);
        b.box(0x805b35, xx + dx, y + 0.45, 1.9, 0.5, 0.14, 0.5);
      }
      b.box(0xf7c36a, xx, y + 1.23, 2.8, 0.09, 0.38, 0.09, 0, true);
      b.box(0x725634, xx, y + 1.02, 2.8, 0.4, 0.08, 0.4);
    }
  }
  if (factory) {
    const line = factoryLine(r, from, to, z);
    root.add(line); root.userData.productionLine = line;
    contacts.push(...line.userData.contactPatches);
    // Quiet brass lane edges make the continuous, unobstructed route visible.
    for (let x = from + 0.5; x < to; x += 1.25) for (const side of [-1, 1])
      b.box(0xb6a473, x - cx, routeHeight(x) - base + 0.181, side * FACTORY_AISLE, 0.48, 0.018, 0.055);
  }
  const sign = letterBoard(
    r,
    tavern
      ? "LA TAVERNE · L’heure des possibles"
      : factory
        ? "L’USINE À CV · On broie vos ambitions"
        : "CENTRE ORP · Votre attente est importante",
    4.8,
    0.9,
    "wall",
  );
  sign.name = "room-title-sign";
  sign.position.set(0, 3.25, -4.9);
  for (const x of [-1.8, 1.8]) wb.box(timber, x, 4.65, -5, 0.1, 1, 0.1);
  walls.add(sign);
  if (tavern) {
    const x = to - cx - 3,
      y = routeHeight(to - 3) - base;
    for (let i = 0; i < 7; i++)
      b.box(
        0x857b68,
        x + ((i % 3) - 1) * 0.5,
        y + 0.3 + Math.floor(i / 3) * 0.45,
        -3.8,
        0.5,
        0.45,
        0.45,
      );
    b.box(0xffa03b, x, y + 0.6, -3.5, 0.65, 0.9, 0.3, 0, true);
    const light = r.pointLight(0xff883b, 30, 9, 2);
    light.position.set(x, y + 1, -3);
    root.add(light);
  }
  for (const edge of [from + 0.25, to - 0.25]) {
    const y = routeHeight(edge) - base;
    for (const side of [-1, 1]) b.box(timber, edge - cx, y + 1.6, side * 1.9, 0.23, 3.2, 0.23);
    b.box(timber, edge - cx, y + 3.2, 0, 0.24, 0.25, 4.05);
  }
  root.userData.animate = (time: number) => { root.userData.productionLine?.userData.animate(time); };
  root.userData.camp = true;
  b.finish();
  wb.finish();
  floorSurface.finish();
  wallSurface.finish();
  return root;
}

export function waysideCamp(r: VoxelResources) {
  const root = new THREE.Group(),
    b = r.batch(root);
  const stone = [0x708478, 0x8f9b86, 0x61786d];
  // A recessed pool with mossy banks and a small arched plank bridge.
  b.box(0x294e58, 1, -0.12, -1.3, 5.6, 0.25, 3.1);
  for (let i = 0; i < 24; i++) {
    const x = -1.7 + i * 0.24;
    for (const z of [-2.85, 0.25]) {
      b.box(stone[i % 3], x, 0.04, z, 0.23, 0.3, 0.27);
      if (i % 3 === 0) b.box(0x61864c, x, 0.22, z, 0.22, 0.08, 0.24);
    }
    for (let j = 0; j < 11; j++)
      b.box(
        (i + j) % 4 === 0 ? 0x6daaa9 : 0x47838d,
        x,
        0.01,
        -2.6 + j * 0.25,
        0.245,
        0.04,
        0.25,
      );
  }
  for (let i = 0; i < 10; i++) {
    const z = -2.8 + i * 0.32,
      y = 0.3 + Math.sin((i / 9) * Math.PI) * 0.2;
    b.box(i % 3 === 0 ? 0xc19b61 : 0x9c7748, -0.7, y, z, 1.25, 0.12, 0.3);
    for (const side of [-1, 1])
      if (i === 0 || i === 9)
        b.box(0x6a5137, -0.7 + side * 0.69, 0.55, z, 0.13, 1.1, 0.13);
  }
  for (const side of [-1, 1])
    b.box(0xa78b54, -0.7 + side * 0.69, 0.92, -1.35, 0.1, 0.1, 3);
  for (let i = 0; i < 15; i++) {
    const x = 1 + Math.sin(i * 17) * 1.7,
      z = -1.3 + Math.cos(i * 13) * 1.1;
    b.box(0x78a362, x, 0.08, z, 0.3, 0.04, 0.23);
    if (i % 3 === 0) {
      b.box(0x588248, x, 0.28, z, 0.04, 0.4, 0.04);
      b.box(0xd9b36a, x, 0.48, z, 0.07, 0.18, 0.07);
    }
  }
  // Benches, barrel and a stack of dossiers, all grounded next to the route.
  for (const x of [-3.4, -1.8]) b.box(0x654b32, x, 0.23, 1.1, 0.12, 0.45, 0.55);
  b.box(0xa17c49, -2.6, 0.51, 1.1, 2.1, 0.13, 0.6);
  for (let y = 0.1; y < 0.9; y += 0.1)
    b.box(
      y < 0.2 || y > 0.7 ? 0x4b4c3e : 0x99713e,
      -3.9,
      y,
      -0.7,
      0.5 - Math.abs(y - 0.45) * 0.2,
      0.1,
      0.5 - Math.abs(y - 0.45) * 0.2,
    );
  for (let i = 0; i < 5; i++)
    b.box(
      i % 2 ? 0xd0bb91 : 0xe6d6af,
      -4.4,
      0.1 + i * 0.06,
      0.5,
      0.65,
      0.055,
      0.45,
    );
  const fx = 3.4,
    fz = 1;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.box(
      stone[i % 3],
      fx + Math.cos(a) * 0.44,
      0.13,
      fz + Math.sin(a) * 0.44,
      0.23,
      0.22,
      0.23,
    );
  }
  b.box(0x64442c, fx, 0.2, fz, 0.7, 0.14, 0.15, 0.5);
  b.box(0x64442c, fx, 0.2, fz, 0.7, 0.14, 0.15, -0.5);
  for (let i = 0; i < 8; i++)
    b.box(
      i % 2 ? 0xffc55e : 0xf68536,
      fx + Math.sin(i * 3) * 0.2,
      0.3 + i * 0.07,
      fz,
      0.12,
      0.25,
      0.14,
      0,
      true,
    );
  const fire = r.pointLight(0xffa54a, 12, 7, 2);
  fire.position.set(fx, 0.8, fz);
  root.add(fire);
  const particles = new THREE.InstancedMesh(
    r.cube,
    r.material(0xffda8c, true),
    28,
  );
  root.add(particles);
  r.instances.add(particles);
  const o = new THREE.Object3D();
  root.userData.animate = (time: number) => {
    fire.intensity = 12 + Math.sin(time * 9) * 1.1;
    for (let i = 0; i < 28; i++) {
      const ember = i < 12,
        y = (i * 0.173 + time * (ember ? 0.45 : 0.07)) % 2;
      o.position.set(
        (ember ? fx : Math.sin(i * 17) * 4) + Math.sin(time + i) * 0.13,
        0.3 + y,
        ember ? fz : Math.cos(i * 13) * 2,
      );
      o.scale.setScalar(ember ? 0.026 : 0.035);
      o.updateMatrix();
      particles.setMatrixAt(i, o.matrix);
    }
    particles.instanceMatrix.needsUpdate = true;
  };
  root.userData.camp = true;
  root.userData.animate(0);
  b.finish();
  return root;
}
