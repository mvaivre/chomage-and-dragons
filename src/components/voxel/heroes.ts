import * as THREE from "three";
import type { Character } from "@/lib/game/characters";
import { VoxelResources } from "./resources";

/** Shared by the road, character selection, portraits and training. Large color
 * masses carry the class identity; no filled micro-voxel volumes or textures. */
export function compactHero(r: VoxelResources, root: THREE.Group, c: Character) {
  const p = c.palette, id = c.id;
  const armor = ["chevalier", "paladin"].includes(id), bones = id === "squelette";
  const bear = id === "teddy", fairy = id === "fee", skate = id === "skater";
  const torso = new THREE.Group(), head = new THREE.Group();
  torso.name = "torso"; head.name = "head";
  const headY = fairy ? 1.31 : bear ? 1.4 : 1.49;
  head.position.y = headY;
  root.add(torso, head);
  const body = r.batch(torso), face = r.batch(head);
  const b = body.box, f = face.box;
  const dark = 0x242831, ivory = 0xf3e7c8;
  const headW = bear ? 0.75 : armor ? 0.68 : 0.64;
  f(p.skin, 0, 0, 0, headW, 0.59, 0.55);
  if (bones) {
    for (const side of [-1, 1]) f(dark, side * 0.16, 0.055, 0.282, 0.16, 0.17, 0.025);
    f(dark, 0, -0.08, 0.29, 0.07, 0.09, 0.025);
    f(dark, 0, -0.2, 0.285, 0.34, 0.08, 0.03);
    for (let k = -1; k <= 1; k++) f(p.skin, k * 0.1, -0.2, 0.31, 0.05, 0.07, 0.03);
  } else {
    for (const side of [-1, 1]) {
      f(dark, side * 0.145, 0.055, 0.285, bear ? 0.075 : 0.065, 0.085, 0.035);
      f(id === "necromancien" ? p.trim : ivory, side * 0.135, 0.08, 0.307, 0.023, 0.026, 0.012);
    }
    f(bear ? 0xecd0a0 : p.skin, 0, -0.08, 0.31, bear ? 0.38 : 0.12, bear ? 0.23 : 0.1, bear ? 0.2 : 0.12);
    f(dark, 0, bear ? -0.04 : -0.205, bear ? 0.42 : 0.291, bear ? 0.13 : 0.13, 0.045, 0.035);
  }
  const trouser = armor || skate || ["voleur", "demon", "squelette"].includes(id);
  if (bones) {
    b(p.skin, 0, 0.88, 0, 0.09, 0.64, 0.12);
    for (let row = 0; row < 3; row++) b(p.skin, 0, 0.75 + row * 0.13, 0.12, 0.45 - row * 0.05, 0.065, 0.12);
    b(p.robeDark, 0, 0.51, 0, 0.44, 0.16, 0.24);
  } else if (bear) {
    b(p.robe, 0, 0.82, 0, 0.69, 0.83, 0.45);
    b(p.trim, 0, 0.78, 0.24, 0.43, 0.48, 0.045);
  } else if (trouser) {
    b(p.robe, 0, 0.94, 0, armor ? 0.68 : 0.53, 0.62, 0.36);
    b(p.robeDark, 0, 0.53, 0, 0.49, 0.22, 0.33);
    b(p.trim, 0, 0.66, 0.19, 0.56, 0.09, 0.045);
  } else {
    for (let tier = 0; tier < 3; tier++)
      b(tier === 0 ? p.robeDark : p.robe, 0, 0.4 + tier * 0.29, 0,
        (fairy ? 0.56 : 0.72) - tier * 0.1, 0.3, 0.39 - tier * 0.045);
    b(p.trim, 0, 0.83, 0.205, 0.13, 0.13, 0.045);
  }
  const limbs: THREE.Group[] = [];
  const armY = fairy ? 1.05 : 1.19, footY = skate ? 0.28 : 0.23;
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(), foot = new THREE.Group();
    arm.position.set(side * (bear ? 0.47 : armor ? 0.45 : 0.37), armY, 0);
    foot.position.set(side * 0.17, footY, 0);
    root.add(arm, foot);
    const a = r.batch(arm), shoe = r.batch(foot);
    a.box(bones ? p.skin : p.robe, 0, -0.18, 0, bones ? 0.09 : bear ? 0.25 : 0.19, 0.37, bear ? 0.27 : 0.2);
    a.box(armor ? p.robeDark : p.skin, 0, -0.41, 0.035, bear ? 0.25 : 0.18, 0.18, 0.22);
    if (armor) a.box(p.trim, 0, -0.035, 0, 0.29, 0.18, 0.29);
    if (trouser) shoe.box(bones ? p.skin : p.robeDark, 0, 0.11, 0, bones ? 0.09 : 0.18, 0.4, 0.19);
    shoe.box(bones ? p.skin : bear ? p.robeDark : dark, 0, -0.12, 0.07, bear ? 0.31 : 0.24, 0.22, bear ? 0.4 : 0.34);
    a.finish(); shoe.finish(); limbs.push(arm, foot);
  }
  const staff = (color = 0x89613f, height = 1.75) => b(color, 0.64, height / 2 + 0.08, 0.12, 0.075, height, 0.075);
  const hood = (color: number) => {
    f(color, 0, 0.32, -0.02, 0.78, 0.18, 0.65);
    for (const side of [-1, 1]) f(color, side * 0.34, 0.05, -0.03, 0.12, 0.56, 0.61);
    f(color, 0, 0.03, -0.28, 0.72, 0.6, 0.13);
  };
  const pointedHat = (color: number, count = 4, lean = 0) => {
    f(p.robeDark, 0, 0.32, 0, 1.02, 0.12, 0.76);
    for (let k = 0; k < count; k++) {
      const w = 0.65 * (1 - k / count);
      f(color, k * lean, 0.47 + k * 0.17, 0, w, 0.18, w * 0.9);
    }
    f(p.trim, 0.16, 0.46, 0.3, 0.15, 0.13, 0.04);
  };
  switch (id) {
    case "barde":
      f(p.robeDark, 0, 0.32, 0, 0.94, 0.11, 0.72);
      f(p.robe, -0.07, 0.45, -0.03, 0.72, 0.22, 0.54);
      f(p.trim, -0.35, 0.68, 0, 0.1, 0.4, 0.08, -0.35);
      f(ivory, -0.41, 0.85, 0, 0.13, 0.18, 0.07, -0.35);
      for (const side of [-1, 1]) f(0x65452f, side * 0.09, -0.13, 0.34, 0.17, 0.045, 0.035, side * 0.16);
      b(0x6b3d2a, -0.38, 0.76, 0.37, 0.42, 0.34, 0.15);
      b(0xc79857, -0.38, 0.82, 0.455, 0.34, 0.34, 0.04);
      b(dark, -0.38, 0.86, 0.484, 0.11, 0.11, 0.025);
      b(0x9f7143, -0.34, 1.16, 0.4, 0.09, 0.5, 0.1, -0.15);
      b(ivory, -0.36, 1.04, 0.49, 0.025, 0.61, 0.016, -0.1);
      break;
    case "sorciere":
      pointedHat(p.robe, 5, -0.045);
      for (const side of [-1, 1]) f(0x4d334c, side * 0.29, -0.15, -0.1, 0.14, 0.6, 0.35);
      staff(); b(p.trim, 0.64, 2.02, 0.12, 0.22, 0.28, 0.22, 0, true);
      b(0x5d7e3c, 0.64, 1.85, 0.12, 0.34, 0.1, 0.3);
      break;
    case "chevalier":
      f(p.robe, 0, 0.16, -0.035, 0.79, 0.53, 0.65);
      f(dark, 0, 0.005, 0.3, 0.5, 0.09, 0.06);
      for (let k = 0; k < 3; k++) f(p.trim, 0, 0.51 + k * 0.12, -0.06 - k * 0.06, 0.15, 0.15, 0.25);
      b(0x64768b, -0.55, 0.88, 0.27, 0.45, 0.61, 0.11);
      b(0xa8b4be, -0.55, 0.56, 0.27, 0.26, 0.14, 0.11);
      b(p.trim, -0.55, 0.88, 0.34, 0.07, 0.39, 0.035);
      b(p.trim, -0.55, 0.91, 0.34, 0.3, 0.07, 0.035);
      b(0xd7dfdd, 0.61, 1.05, 0.13, 0.09, 0.91, 0.08);
      b(0xc9a75a, 0.61, 0.68, 0.13, 0.33, 0.08, 0.14);
      break;
    case "voleur":
      hood(p.robeDark); f(0x1b302b, 0, -0.16, 0.3, 0.52, 0.2, 0.05);
      b(p.trim, 0.02, 0.94, 0.205, 0.07, 0.64, 0.04, -0.5);
      b(0x957249, -0.39, 0.62, -0.16, 0.29, 0.32, 0.26);
      b(0xc1d4ce, 0.56, 0.9, 0.13, 0.075, 0.48, 0.07, -0.2);
      break;
    case "archimage":
      pointedHat(p.robe, 5, 0.018);
      f(ivory, 0, -0.34, 0.3, 0.29, 0.3, 0.18);
      f(ivory, 0, -0.51, 0.3, 0.13, 0.12, 0.13);
      b(p.trim, -0.48, 1.06, 0.26, 0.4, 0.52, 0.14);
      b(p.robeDark, -0.48, 1.06, 0.34, 0.3, 0.39, 0.035);
      for (let k = 0; k < 3; k++) b(p.trim, -0.48, 0.96 + k * 0.1, 0.365, 0.25, 0.025, 0.02);
      break;
    case "druidesse":
      for (let k = 0; k < 5; k++) f(k % 2 ? p.robe : 0x759652, (k - 2) * 0.16, 0.33 + (k % 2) * 0.07, -0.04, 0.23, 0.22, 0.6);
      for (const side of [-1, 1]) f(0x385136, side * 0.3, -0.03, -0.11, 0.15, 0.5, 0.38);
      staff(); b(0x8faa50, 0.73, 1.91, 0.12, 0.35, 0.15, 0.18, 0.5);
      b(0xc3c575, 0.56, 2.03, 0.12, 0.27, 0.12, 0.17, -0.5);
      break;
    case "paladin":
      f(p.trim, 0, 0.34, 0, 0.76, 0.15, 0.62);
      for (let k = -1; k <= 1; k++) f(p.trim, k * 0.25, 0.5 + (k === 0 ? 0.06 : 0), 0.22, 0.12, 0.25, 0.15);
      b(ivory, 0, 0.83, -0.26, 0.7, 0.9, 0.09);
      b(p.trim, 0, 1.03, 0.2, 0.09, 0.46, 0.04);
      staff(0x907145, 2.04); b(p.trim, 0.64, 2.25, 0.12, 0.13, 0.3, 0.13);
      b(ivory, 0.81, 1.92, 0.12, 0.31, 0.38, 0.035); b(0x688c64, 0.81, 1.94, 0.145, 0.13, 0.13, 0.02);
      break;
    case "necromancien":
      hood(p.robeDark); f(p.trim, 0, -0.31, 0.1, 0.09, 0.08, 0.09);
      b(ivory, 0, 0.98, 0.22, 0.06, 0.2, 0.04); b(ivory, 0, 1.02, 0.22, 0.18, 0.06, 0.04);
      staff(0x5d5661); b(0xd4dfba, 0.64, 1.99, 0.12, 0.27, 0.28, 0.25);
      for (const side of [-1, 1]) b(p.robeDark, 0.64 + side * 0.065, 2.02, 0.252, 0.06, 0.07, 0.02);
      b(p.trim, 0.64, 2.19, 0.12, 0.13, 0.1, 0.13, 0, true);
      break;
    case "licorne":
      f(p.skin, 0, -0.1, 0.38, 0.48, 0.29, 0.32);
      for (const side of [-1, 1]) f(p.skin, side * 0.23, 0.37, 0, 0.15, 0.25, 0.2);
      for (let k = 0; k < 3; k++) f(k % 2 ? ivory : p.trim, 0, 0.44 + k * 0.14, 0.16, 0.18 - k * 0.05, 0.15, 0.18 - k * 0.05);
      for (let k = 0; k < 5; k++) f([0xd989bb, 0xb39bd5, p.trim][k % 3], -0.3, 0.29 - k * 0.17, -0.1, 0.16, 0.22, 0.43);
      for (let k = 0; k < 4; k++) b([0xe291ae, p.trim, 0xdabf69, 0xa59bce][k], 0.48 + k * 0.1, 0.85 + Math.sin(k) * 0.23, 0.1, 0.13, 0.17, 0.1);
      break;
    case "squelette":
      staff(0x7b6245, 1.86); b(0xc6d9cc, 0.46, 1.96, 0.12, 0.49, 0.1, 0.09, 0.25);
      b(0xc6d9cc, 0.2, 1.83, 0.12, 0.2, 0.09, 0.08, 0.6);
      break;
    case "fee":
      f(0xbfa150, 0, 0.3, -0.05, 0.67, 0.14, 0.58);
      f(p.trim, 0, 0.44, -0.03, 0.28, 0.18, 0.25);
      for (const side of [-1, 1]) {
        b(0xb9e3bd, side * 0.5, 1.05, -0.2, 0.35, 0.6, 0.075, side * -0.35);
        b(0x81b9ad, side * 0.47, 0.69, -0.2, 0.32, 0.28, 0.075, side * 0.3);
      }
      b(0x96754a, 0.56, 1.08, 0.13, 0.055, 0.76, 0.055);
      b(p.trim, 0.56, 1.56, 0.13, 0.27, 0.07, 0.08, 0, true);
      b(p.trim, 0.56, 1.56, 0.13, 0.07, 0.27, 0.08, 0, true);
      break;
    case "demon":
      for (const side of [-1, 1]) for (let k = 0; k < 2; k++) f(p.trim, side * (0.28 + k * 0.06), 0.36 + k * 0.16, -0.02, 0.15 - k * 0.05, 0.2, 0.16);
      b(p.robeDark, 0, 0.96, 0.21, 0.13, 0.5, 0.045);
      b(p.skin, 0.3, 0.45, -0.3, 0.55, 0.09, 0.09, -0.35);
      b(p.trim, 0.57, 0.42, -0.3, 0.13, 0.2, 0.12, -0.3);
      staff(0x714a37); b(p.trim, 0.64, 1.88, 0.12, 0.42, 0.08, 0.08);
      for (const dx of [-0.17, 0, 0.17]) b(p.trim, 0.64 + dx, 2.02, 0.12, 0.065, 0.31, 0.075);
      break;
    case "vampire":
      f(0x25202d, 0, 0.3, -0.06, 0.72, 0.17, 0.56);
      for (const side of [-1, 1]) {
        f(0x25202d, side * 0.3, 0.14, -0.07, 0.12, 0.28, 0.5);
        f(ivory, side * 0.07, -0.24, 0.32, 0.035, 0.08, 0.035);
        b(p.trim, side * 0.28, 1.23, -0.13, 0.2, 0.45, 0.13, side * 0.45);
      }
      b(p.robeDark, 0, 0.78, -0.25, 0.77, 1.04, 0.1);
      staff(0x8e7360, 1.85);
      for (let k = -2; k <= 2; k++) b(0x352439, 0.64 + k * 0.2, 2.19 - Math.abs(k) * 0.09, 0.12, 0.22, 0.15, 0.74);
      break;
    case "teddy":
      for (const side of [-1, 1]) { f(p.robe, side * 0.3, 0.34, -0.02, 0.24, 0.25, 0.22); f(p.trim, side * 0.3, 0.36, 0.095, 0.13, 0.13, 0.03); }
      b(0xc79043, 0.5, 0.72, 0.25, 0.34, 0.35, 0.3);
      b(0x6b442f, 0.5, 0.93, 0.25, 0.4, 0.09, 0.34);
      for (const dx of [-0.06, 0.06]) b(ivory, 0.5 + dx, 0.74, 0.408, 0.035, 0.14, 0.025);
      b(ivory, 0.5, 0.74, 0.408, 0.13, 0.03, 0.025);
      break;
    case "skater":
      f(0x614631, 0, 0.27, -0.05, 0.68, 0.16, 0.55);
      f(p.trim, 0, 0.39, -0.02, 0.74, 0.19, 0.6);
      f(p.trim, 0.03, 0.32, -0.38, 0.54, 0.08, 0.33);
      f(0x614631, 0.21, 0.05, -0.35, 0.19, 0.43, 0.2);
      for (const side of [-1, 1]) f(dark, side * 0.15, 0.06, 0.31, 0.23, 0.12, 0.035);
      for (const side of [-1, 1]) f(0xadc4c2, side * 0.15, 0.065, 0.335, 0.15, 0.06, 0.018);
      b(ivory, 0, 1.09, 0.2, 0.16, 0.2, 0.035);
      b(0xc49c67, 0, 0.08, 0.03, 0.99, 0.055, 0.4);
      for (const x of [-0.35, 0.35]) for (const z of [-0.16, 0.22]) b(dark, x, 0.025, z, 0.12, 0.05, 0.09);
      break;
  }
  body.finish(); face.finish();
  root.userData.characterId = id;
  root.userData.animate = (time: number, moving = false,
    options: { blend?: number; stride?: number; motion?: string } = {}) => {
    const blend = options.blend ?? Number(moving), phase = options.stride ?? time * 8;
    const breath = Math.sin(time * 2) * 0.008;
    torso.position.y = breath; torso.scale.set(1, 1 + breath, 1);
    torso.rotation.set(skate ? blend * 0.08 : 0, Math.sin(phase) * blend * 0.035, Math.sin(phase) * blend * 0.025);
    head.position.y = headY + breath;
    head.rotation.set(Math.sin(time * 1.6) * 0.02, Math.sin(time * 0.8) * 0.09 * (1 - blend), -Math.sin(phase) * blend * 0.03);
    limbs.forEach((limb, i) => {
      const arm = i % 2 === 0, side = i < 2 ? -1 : 1;
      const wave = Math.sin(phase + (side > 0 ? Math.PI : 0));
      limb.rotation.set(arm ? wave * blend * 0.55 + Math.sin(time * 1.7) * 0.025 : -wave * blend * (skate ? 0.12 : 0.42), 0, arm ? side * (0.05 + blend * 0.05) : 0);
      limb.position.y = (arm ? armY : footY) + (arm ? breath : Math.max(0, wave) * blend * (skate ? 0.015 : 0.1));
    });
    if (id === "barde" && blend < 0.3) limbs[0].rotation.z += Math.sin(time * 6) * 0.12;
    if (options.motion === "send") { limbs[2].rotation.x = -1.05; head.rotation.y = 0.15; }
    if (options.motion === "hurt") { torso.rotation.x = -0.16; head.rotation.x = 0.22; limbs[0].rotation.x = -0.5; limbs[2].rotation.x = -0.6; }
    if (options.motion === "celebrate") { limbs[0].rotation.z = -2.3; limbs[2].rotation.z = 2.3; torso.position.y += Math.abs(Math.sin(time * 5)) * 0.06; head.rotation.z = Math.sin(time * 4) * 0.1; }
  };
  return root;
}
