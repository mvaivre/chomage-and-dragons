import * as THREE from "three";
import { VoxelResources } from "./resources";
import type { LandscapePlot } from "./layout";
import { terrainSurface as terrainHeight } from "./world";

/** Small authored grammars on deterministic, reserved plots. No bitmap assets. */
export function landscapeModel(r: VoxelResources, plot: LandscapePlot) {
  const root = new THREE.Group(), b = r.batch(root, true, 0, true), box = b.box;
  const ground = (x: number, z: number) => terrainHeight(plot.x + x, plot.z + z);
  const base = ground(0, 0), yAt = (x: number, z: number) => ground(x, z) - base;
  root.position.set(plot.x, base, plot.z); root.name = plot.id;
  root.userData.landscape = { kind: plot.kind, biome: plot.biome };
  const animations: ((t: number) => void)[] = [];
  const house = (x: number, z: number, roof: number, snow = false, stilt = false) => {
    const corners = [-1.4, 1.4].flatMap(dx => [-1.15, 1.15].map(dz => yAt(x + dx, z + dz)));
    const floor = Math.max(...[-1.4, 1.4].flatMap(dx => [-1.15, 1.15].map(dz => yAt(x + dx, z + dz)))) + (stilt ? 0.7 : 0.12);
    if (stilt) for (const dx of [-1.3, 1.3]) for (const dz of [-1.05, 1.05]) {
      const g = yAt(x + dx, z + dz), h = floor - g + .25;
      box(0x705a42, x + dx, g + h / 2, z + dz, .27, h, .27);
    } else {
      const low = Math.min(...[-1.4, 1.4].flatMap(dx => [-1.15, 1.15].map(dz => yAt(x + dx, z + dz)))) - .12;
      box(0x899181, x, (low + floor) / 2, z, 2.95, floor - low, 2.4);
    }
    (root.userData.houses ??= []).push({ x: plot.x + x, z: plot.z + z, floor: base + floor, groundRange: Math.max(...corners) - Math.min(...corners), stilt });
    if (!stilt) for (let i = 0; i < 2; i++) box(0x989781, x, floor - .04 - i * .05, z + 1.45 + i * .27, .95, .1, .4);
    box(stilt ? 0x7c7562 : 0xccbd92, x, floor + 1, z, 2.9, 2, 2.35);
    box(0x6f533d, x, floor + .05, z, 3.15, .15, 2.6);
    box(0x765d45, x, floor + .75, z + 1.19, .65, 1.5, .08);
    for (const side of [-1, 1]) {
      box(0x745b43, x + side * .92, floor + 1.17, z + 1.2, .61, .79, .08);
      box(0xffd989, x + side * .92, floor + 1.17, z + 1.25, .45, .58, .035, 0, true);
      box(0x77865b, x + side * .92, floor + .69, z + 1.34, .7, .17, .25);
    }
    for (let i = 0; i < 5; i++) box(snow && i % 2 === 0 ? 0xe4e7d8 : roof, x, floor + 2.05 + i * .23, z, 3.45 - i * .61, .25, 2.85);
    box(0x958d75, x + .85, floor + 2.9, z - .45, .36, 1.1, .39);
    box(0x4d5248, x + .85, floor + 3.48, z - .45, .46, .12, .49);
  };
  const pen = (goats: boolean) => {
    for (let i = -3; i <= 3; i++) for (const side of [-1, 1]) {
      const x = i, z = side * 1.65, y = yAt(x, z);
      box(0x928064, x, y + .55, z, .12, 1.1, .12);
      if (i < 3) for (const h of [.35, .8]) box(0xad9772, x + .5, y + h, z, .98, .09, .1);
    }
    for (const side of [-1, 1]) for (const h of [.35, .8]) box(0xad9772, side * 3, yAt(side * 3, 0) + h, 0, .1, .09, 3.3);
    box(0xa99155, 2.35, yAt(2.35, .7) + .3, .7, .7, .6, .6);
    for (let i = 0; i < 3; i++) {
      const animal = new THREE.Group(), body = r.batch(animal, false, 0, true);
      body.box(goats ? 0xd8d1bc : 0xe9dcae, 0, .54, 0, .7, .55, .43);
      body.box(goats ? 0xd7c5a2 : 0xb88652, .4, .74, 0, .36, .4, .34);
      body.box(0x303e35, .59, .79, .1, .035, .05, .035);
      body.box(0x303e35, .59, .79, -.1, .035, .05, .035);
      for (const dx of [-.24, .24]) for (const dz of [-.14, .14]) body.box(0x7b725c, dx, .2, dz, .12, .4, .12);
      for (const s of [-1, 1]) body.box(goats ? 0x908d77 : 0xd8bb8b, .36, 1.02, s * .16, .08, goats ? .35 : .15, .08, s * .2);
      body.finish(); root.add(animal);
      animations.push(t => { const x = -1.8 + i * 1.5 + Math.sin(t * .35 + i) * .22, z = Math.sin(t * .3 + i * 2) * .65; animal.position.set(x, yAt(x, z), z); animal.rotation.y = Math.sin(t * .35 + i) * .35; });
    }
  };
  const mushroom = (x: number, z: number, s: number, color: number) => {
    const y = yAt(x, z);
    box(0x9bbfbc, x, y + s * .75, z, .32 * s, 1.5 * s, .32 * s);
    box(color, x, y + s * 1.5, z, 1.7 * s, .4 * s, 1.5 * s);
    box(color, x, y + s * 1.85, z, 1.05 * s, .3 * s, .95 * s);
    for (const side of [-1, 1]) box(0xd2e6cd, x + side * s * .4, y + s * 1.74, z + s * .42, .22 * s, .08 * s, .23 * s);
  };
  switch (plot.kind) {
    case "paddock": pen(false); break;
    case "goat-pen": pen(true); break;
    case "cabin": house(0, 0, 0x6b8d7f); box(0x947951, 2.3, yAt(2.3, .5) + .3, .5, .65, .6, 1.1); break;
    case "hamlet": case "alpine-hamlet": {
      const snow = plot.kind === "alpine-hamlet";
      house(-3.65, -.35, snow ? 0x718b9b : 0x9c665b, snow);
      house(3.65, -.35, snow ? 0x7992a3 : 0xa4814e, snow);
      const y = Math.max(yAt(-1.5, 0), yAt(1.5, 0), yAt(0, 1)) + .05;
      box(0xa3a58b, 0, y, .2, 3.3, .1, 3.8);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; box(0x8d9888, Math.sin(a) * .65, y + .3, .3 + Math.cos(a) * .65, i % 2 ? .2 : 1.5, .6, i % 2 ? 1.5 : .2); }
      box(0x7bbcb9, 0, y + .18, .3, 1.1, .08, 1.1); box(0x9aa294, 0, y + .8, .3, .26, 1.4, .26);
      for (let i = -3; i <= 3; i++) box([0xc98576, 0xe1bb69, 0x739fa0][(i + 3) % 3], i * .62, y + 3 - Math.abs(i) * .08, 1.8, .3, .42, .035);
      break;
    }
    case "stilt-house": house(0, 0, 0x586c71, false, true); break;
    case "fishing-huts": house(-2.5, -.5, 0x6d879c, false, true); house(2.5, .5, 0xa5808e, false, true); break;
    case "harbour": {
      for (let i = -5; i <= 5; i++) box(0x9d865f, i * .65, .4, .3, .61, .13, 2.5);
      for (const x of [-3.3, 3.3]) for (const z of [-.7, 1.3]) { const g = yAt(x, z); box(0x766145, x, (g + .7) / 2, z, .18, .7 - g, .18); }
      for (let i = 0; i < 4; i++) box(0x6d654c, -1 + i * .63, .15 - Math.abs(i - 1.5) * .1, -1.8, .62, .25, .7 + (i === 0 || i === 3 ? -.25 : .15));
      box(0x8f7950, 2.4, .7, .4, .65, .6, .65); break;
    }
    case "mangrove": {
      for (const [x, z] of [[-2, -.7], [1.7, .5], [0, -1.7]]) {
        const y = yAt(x, z); box(0x567369, x, y + 1.6, z, .42, 3.2, .42);
        for (const s of [-1, 1]) { box(0x6d8c77, x + s * .5, y + .45, z, 1.4, .24, .2, s * .65); box(0x7dba9b, x + s * .8, y + 2.4, z, .12, 2, .17); }
        box(0x548783, x, y + 3, z, 2.3, .8, 2); box(0x719991, x, y + 3.65, z, 1.3, .5, 1.4);
      }
      mushroom(2.5, -1, .5, 0x9e7bb3); break;
    }
    case "mushrooms": [-2.4, 0, 2.3].forEach((x, i) => mushroom(x, (i % 2 - .5) * 2, 1 + i * .25, [0x9972ad, 0x6da4ad, 0xb887a1][i])); break;
    case "ruins": {
      const color = plot.biome === "desert" ? 0xbca375 : 0x8a9f92;
      for (const x of [-2.8, 0, 2.8]) { const y = yAt(x, -.5), h = x === 2.8 ? 1.6 : 3.4; box(color, x, y + .2, -.5, 1.2, .4, 1.25); box(color, x, y + h / 2 + .35, -.5, .65, h, .65); box(color, x, y + h + .45, -.5, 1.1, .3, 1); }
      box(color, -1.4, Math.max(yAt(-2.8, -.5), yAt(0, -.5)) + 3.9, -.5, 3.85, .45, 1);
      for (let i = 0; i < 6; i++) box(color, -3 + i * 1.1, yAt(-3 + i * 1.1, 1.5) + .2, 1.5, .75, .4, .7, i * .14); break;
    }
    case "oasis": {
      const level = Math.max(yAt(-3, -1), yAt(3, 1), yAt(0, 2));
      box(0xb9a47b, 0, level + .1, 0, 6, .5, 3.3); box(0x64b2b3, 0, level + .37, 0, 5.5, .04, 2.8);
      for (const x of [-3.5, 3.5]) { const y = yAt(x, 0); box(0xa58d61, x, y + 1.8, 0, .3, 3.6, .3); for (let i = 0; i < 3; i++) box(0x799f6c, x, y + 3.6 + i * .15, 0, 1.6 - i * .5, .15, i % 2 ? 2 : .4); } break;
    }
    case "forge": {
      house(0, -.5, 0x735b66); const y = yAt(2.2, 1.5); box(0x5a5260, 2.2, y + .65, 1.5, 1.2, 1.3, 1.1); box(0xffaa51, 2.2, y + .7, 2.06, .7, .55, .04, 0, true); break;
    }
    case "obsidian": {
      for (let i = 0; i < 7; i++) { const x = -2.4 + i * .8, z = Math.sin(i * 2) * 1.2, y = yAt(x, z), h = 1.5 + i % 3 * 1.1; box(i % 2 ? 0x68566e : 0x444451, x, y + h / 2, z, .65, h, .75, Math.sin(i) * .12); box(0xda9989, x, y + .07, z + .6, .7, .07, .18, 0, true); } break;
    }
    case "vineyard": {
      for (let row = -1; row <= 1; row++) for (let i = -3; i <= 3; i++) { const x = i, z = row * 1.2, y = yAt(x, z); box(0x92744c, x, y + .65, z, .1, 1.3, .1); box(0x718852, x, y + 1.05, z, .9, .45, .5); box(0x967698, x + .2, y + .74, z + .24, .18, .32, .18); } break;
    }
  }
  b.finish();
  // A single feathered, low opacity ribbon instead of volumetric raymarching.
  if (["mangrove", "mushrooms", "stilt-house"].includes(plot.kind)) {
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { tint: { value: new THREE.Color(0x9bbfb4) } },
      vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: "varying vec2 vUv; uniform vec3 tint; void main(){float a=1.0-smoothstep(0.2,1.0,length((vUv-.5)*2.0));gl_FragColor=vec4(tint,a*.13);}",
    });
    const geometry = r.geometry(new THREE.PlaneGeometry(plot.rx * 1.8, 1.6)), mist = new THREE.Mesh(geometry, material);
    r.ownedMaterials.add(material); mist.userData.ownedMaterial = material; mist.userData.ownedGeometry = geometry;
    mist.position.set(0, 1.1, .7); root.add(mist); animations.push(t => { mist.position.x = Math.sin(t * .15) * .25; });
  }
  if (animations.length) { root.userData.camp = true; root.userData.animate = (t: number) => animations.forEach(a => a(t)); root.userData.animate(0); }
  return root;
}
