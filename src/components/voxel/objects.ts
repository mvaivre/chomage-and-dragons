import * as THREE from "three";
import { chestModel } from "./chest";
import { characterById } from "@/lib/game/characters";
import {
  detailedCharacter,
  detailedDragon,
  type VoxelDetailContext,
} from "./models";
import { animalModel } from "./fauna";
import { VoxelResources } from "./resources";

export function characterModel(
  resources: VoxelResources,
  id: string,
  occlusion = false,
) {
  const root = new THREE.Group(),
    instances: THREE.InstancedMesh[] = [];
  const ctx = {
    cube: resources.cube,
    material: resources.material,
    geometry: resources.geometry,
    instances,
  } as VoxelDetailContext;
  detailedCharacter(ctx, root, characterById(id));
  instances.forEach((mesh) => resources.instances.add(mesh));
  if (occlusion) {
    const matrices: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    root.updateMatrixWorld(true);
    for (const mesh of instances) {
      // Write a stencil only for visible character fragments, after the scenery.
      // The silhouette can then cover hidden fragments without accumulating over
      // the many self-occluding cubes of the character itself.
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.stencilWrite = true;
      mat.stencilRef = 1;
      mat.stencilFunc = THREE.AlwaysStencilFunc;
      mat.stencilZPass = THREE.ReplaceStencilOp;
      resources.addFog(mat);
      resources.ownedMaterials.add(mat);
      mesh.material = mat;
      mesh.userData.ownedMaterial = mat;
      mesh.renderOrder = 1;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m);
        matrices.push(m.clone().premultiply(mesh.matrixWorld));
      }
    }
    const proxy = new THREE.InstancedMesh(
      resources.cube,
      resources.silhouette,
      matrices.length,
    );
    matrices.forEach((m, i) => proxy.setMatrixAt(i, m));
    proxy.renderOrder = 5;
    root.add(proxy);
    resources.instances.add(proxy);
  }
  return root;
}
export function dragonModel(resources: VoxelResources, variant = "green") {
  const scene = new THREE.Scene(),
    instances: THREE.InstancedMesh[] = [];
  const hues: Record<string, number> = {
    green: 0.39,
    red: 0.015,
    blue: 0.58,
    black: 0.75,
    gold: 0.12,
  };
  const material = (color: THREE.ColorRepresentation, glow = false) => {
    const c = new THREE.Color(color);
    if (variant === "black" && c.getHex() === 0xe7cb83) c.set(0xd4484d);
    if (c.g > c.r * 0.95 && c.g > c.b * 0.8) {
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      c.setHSL(
        hues[variant] ?? 0.39,
        variant === "black" ? 0.22 : variant === "gold" ? 0.65 : hsl.s,
        variant === "black" ? hsl.l * 0.4 : hsl.l,
      );
    }
    return resources.material(c, glow);
  };
  const ctx = {
    scene,
    cube: resources.cube,
    material,
    geometry: resources.geometry,
    instances,
  } as VoxelDetailContext;
  const head = detailedDragon(ctx),
    root = head.parent! as THREE.Group;
  root.position.set(0, 0, 0);
  root.rotation.y = 0;
  instances.forEach((mesh) => resources.instances.add(mesh));
  root.userData.head = head;
  return root;
}
export function propModel(resources: VoxelResources, kind: string) {
  if (kind === "chest") return chestModel(resources);
  const animal = animalModel(resources, kind);
  if (animal) {
    animal.userData.resident = true;
    animal.userData.animal = true;
    animal.userData.kind = kind;
    return animal;
  }
  const people: Record<string, string> = {
    gnome: "barde",
    recruiter: "vampire",
    ghost: "necromancien",
    yeti: "teddy",
    skeleton: "squelette",
    innkeeper: "barde",
    coach: "archimage",
    clerk: "sorciere",
    worker: "chevalier",
    traveller: "voleur",
    spirit: "fee",
  };
  if (people[kind]) {
    const person = characterModel(resources, people[kind]);
    person.scale.setScalar(0.82);
    person.userData.resident = true;
    person.userData.kind = kind;
    return person;
  }

  const root = new THREE.Group(),
    { box, finish } = resources.batch(root);
  const cube = (
    color: THREE.ColorRepresentation,
    x: number,
    y: number,
    z: number,
    w: number,
    h = w,
    d = w,
    glow = false,
  ) => box(color, x, y, z, w, h, d, 0, glow);
  if (kind === "dragon") return dragonModel(resources);
  if (kind === "pigeon" || kind === "crow") {
    for (let x = -3; x <= 3; x++)
      for (let y = -2; y <= 2; y++)
        for (let z = -2; z <= 2; z++)
          if ((x * x) / 10 + (y * y) / 5 + (z * z) / 5 < 1)
            cube(
              kind === "crow" ? 0x45494d : 0xa3adae,
              x * 0.1,
              0.35 + y * 0.1,
              z * 0.1,
              0.105,
            );
    cube(0xc8d3ce, -0.25, 0.55, 0, 0.24);
    cube(0xdda95e, -0.43, 0.53, 0, 0.15, 0.08, 0.1);
    cube(0x323a3c, -0.32, 0.6, 0.13, 0.045);
    for (const side of [-1, 1]) {
      cube(0x7b8d92, 0, 0.38, side * 0.24, 0.45, 0.07, 0.24);
      cube(0xd7ac6a, side * 0.1, 0.12, 0.03, 0.045, 0.2, 0.045);
    }
  } else if (kind === "stamp") {
    cube(0x745447, 0, 0.1, 0, 0.9, 0.2, 0.6);
    cube(0xa24e4e, 0, 0.23, 0, 0.8, 0.06, 0.54);
    cube(0x7e644c, 0, 0.55, 0, 0.22, 0.6, 0.22);
    cube(0xb18c58, 0, 0.88, 0, 0.45, 0.16, 0.4);
  } else if (kind === "non") {
    const letters = [
      ["111", "101", "101", "101", "101"],
      ["111", "101", "101", "101", "111"],
      ["111", "101", "101", "101", "101"],
    ];
    letters.forEach((rows, k) =>
      rows.forEach((row, y) =>
        [...row].forEach((v, x) => {
          if (v === "1")
            cube(
              0xc87166,
              (k * 4 + x - 5) * 0.13,
              (4 - y) * 0.13,
              0,
              0.135,
              0.135,
              0.14,
            );
        }),
      ),
    );
  } else if (kind === "cloud") {
    for (let i = 0; i < 7; i++)
      cube(
        i % 2 ? 0x909ea2 : 0xa8b5b7,
        (i - 3) * 0.25,
        Math.sin(i * 13) * 0.15,
        0,
        0.6,
        0.4,
        0.55,
      );
  } else if (kind === "poop") {
    for (let i = 0; i < 4; i++)
      cube(
        0x806645,
        0,
        0.1 + i * 0.14,
        0,
        0.7 - i * 0.14,
        0.16,
        0.7 - i * 0.14,
      );
  } else if (kind === "sign") {
    cube(0x816d48, 0, 0.65, 0, 0.12, 1.3, 0.12);
    for (let i = 0; i < 3; i++)
      cube(
        i % 2 ? 0xa78b5e : 0xb19869,
        0,
        1.15 + i * 0.2,
        0.08,
        1.5,
        0.19,
        0.12,
      );
    for (const x of [-0.6, 0.6]) cube(0xd5bc83, x, 1.35, 0.16, 0.055);
  } else if (kind === "grave") {
    cube(0x8b9990, 0, 0.4, 0, 0.7, 0.8, 0.3);
    cube(0x9daa9c, 0, 0.85, 0, 0.55, 0.2, 0.3);
    for (let i = 0; i < 3; i++)
      cube(0x53665f, 0, 0.65 - i * 0.14, 0.16, 0.4, 0.03, 0.03);
  } else if (kind === "chest" || kind === "slots") {
    for (let x = -3; x <= 3; x++)
      for (let y = 0; y < 5; y++)
        cube(
          (x + y) % 3 ? 0x987044 : 0xad8652,
          x * 0.13,
          y * 0.13,
          0,
          0.13,
          0.13,
          0.7,
        );
    for (const x of [-0.3, 0.3])
      cube(0xd7b56c, x, 0.32, 0.37, 0.09, 0.65, 0.05);
    cube(0xe9c874, 0, 0.3, 0.4, 0.15, 0.2, 0.06);
  } else if (kind === "crown" || kind === "trophy") {
    for (let x = -4; x <= 4; x++) {
      cube(0xdcb566, x * 0.1, 0.1, 0, 0.105, 0.2, 0.38);
      if (x % 2 === 0) cube(0xf0cd79, x * 0.1, 0.31, 0, 0.105, 0.32, 0.38);
    }
    cube(0xa3484e, 0, 0.2, 0.21, 0.12, 0.12, 0.04);
  } else if (kind === "lightning" || kind === "fire" || kind === "meteor") {
    for (let i = 0; i < 13; i++)
      cube(
        kind === "lightning" ? 0xa9dfe5 : 0xffb558,
        Math.sin(i * 0.7) * 0.15,
        0.1 + i * 0.1,
        0,
        0.16,
        0.14,
        0.12,
        true,
      );
  } else if (kind === "cup" || kind === "tankard" || kind === "shot") {
    for (let y = 0; y < 6; y++)
      cube(y === 5 ? 0xf0dba5 : 0xc19351, 0, y * 0.1, 0, 0.4, 0.1, 0.4);
    cube(0xc19351, 0.28, 0.28, 0, 0.16, 0.3, 0.13);
  } else if (kind === "frog" || kind === "crapaud") {
    cube(0x72994f, 0, 0.18, 0, 0.6, 0.3, 0.4);
    for (const side of [-1, 1]) {
      cube(0x8bab62, side * 0.23, 0.4, 0.11, 0.18);
      cube(0xe8e1b7, side * 0.23, 0.43, 0.22, 0.1);
      cube(0x293c32, side * 0.23, 0.43, 0.28, 0.05);
      cube(0x72994f, side * 0.34, 0.08, 0, 0.3, 0.15, 0.3);
    }
  } else if (kind === "door") {
    for (let x = -3; x <= 3; x++)
      cube(x % 2 ? 0x886946 : 0x9e7c50, x * 0.13, 0.8, 0, 0.125, 1.6, 0.17);
    cube(0xe4bd6c, 0.25, 0.8, 0.11, 0.1);
  } else if (kind === "anvil") {
    cube(0x627078, 0, 0.2, 0, 0.65, 0.15, 0.4);
    cube(0x7a878b, 0, 0.45, 0, 0.25, 0.5, 0.25);
    cube(0x8c999b, 0, 0.72, 0, 0.8, 0.22, 0.35);
  } else if (
    [
      "gnome",
      "recruiter",
      "ghost",
      "yeti",
      "skeleton",
      "innkeeper",
      "coach",
      "clerk",
      "worker",
      "traveller",
      "spirit",
      "troll",
    ].includes(kind)
  ) {
    cube(
      kind === "ghost" ? 0xbdc7c5 : kind === "yeti" ? 0xc9d8d4 : 0x71806b,
      0,
      0.45,
      0,
      0.45,
      0.7,
      0.35,
    );
    cube(0xe3c2a0, 0, 0.97, 0, 0.4, 0.36, 0.35);
    for (const side of [-1, 1]) cube(0x30403d, side * 0.1, 1.02, 0.19, 0.05);
    if (kind === "gnome")
      for (let i = 0; i < 5; i++)
        cube(
          0xb66e55,
          0,
          1.2 + i * 0.09,
          0,
          0.4 - i * 0.07,
          0.1,
          0.4 - i * 0.07,
        );
    if (kind === "troll") {
      root.scale.setScalar(1.8);
      cube(0x73845b, 0, 1.04, 0.1, 0.55, 0.38, 0.48);
      cube(0x73845b, -0.45, 0.54, 0, 0.3, 0.7, 0.3);
      cube(0x73845b, 0.45, 0.54, 0, 0.3, 0.7, 0.3);
      cube(0xb9b694, 0, 1.03, 0.35, 0.4, 0.07, 0.07);
    }
    if (kind === "innkeeper") {
      cube(0xe3d6b0, 0, 0.45, 0.2, 0.32, 0.56, 0.05);
      cube(0x735c43, 0.4, 0.58, 0.2, 0.25, 0.3, 0.25);
    }
    if (kind === "skeleton")
      for (let i = 0; i < 4; i++)
        cube(0xd8d5bf, 0, 0.3 + i * 0.12, 0.2, 0.4, 0.04, 0.04);
    if (kind === "worker") cube(0xe7b962, 0, 1.19, 0, 0.52, 0.14, 0.46);
    if (kind === "yeti") {
      root.scale.setScalar(1.5);
      cube(0xe0e7db, 0, 0.87, 0.2, 0.5, 0.3, 0.15);
    }
    if (kind === "ghost" || kind === "spirit")
      for (let i = 0; i < 4; i++)
        cube(0xd0ded2, -0.24 + i * 0.16, 0.05, 0, 0.12, 0.2, 0.3);
  } else if (kind === "tree") {
    cube(0x806649, 0, 1.1, 0, 0.55, 2.2, 0.55);
    for (let i = 0; i < 5; i++)
      cube(
        0x49734d,
        Math.sin(i * 17) * 0.6,
        2.3 + Math.sin(i * 7) * 0.3,
        Math.cos(i * 13) * 0.5,
        1.1,
        0.9,
        1.1,
      );
    for (const side of [-1, 1])
      cube(0xe1c897, side * 0.13, 1.32, 0.3, 0.08, 0.1, 0.05);
  } else if (
    [
      "fox",
      "hedgehog",
      "otter",
      "goat",
      "scarab",
      "hen",
      "toad",
      "mushroom",
      "heron",
      "troll",
      "squirrel",
    ].includes(kind)
  ) {
    const color =
      kind === "fox"
        ? 0xb47a48
        : kind === "mushroom"
          ? 0xbb7667
          : kind === "toad"
            ? 0x7a9658
            : 0x9a9980;
    cube(color, 0, 0.3, 0, 0.7, 0.4, 0.35);
    cube(color, -0.35, 0.48, 0, 0.3, 0.3, 0.33);
    cube(0x273b36, -0.44, 0.54, 0.18, 0.05);
    for (const x of [-0.2, 0.2])
      for (const z of [-0.14, 0.14]) cube(color, x, 0.1, z, 0.1, 0.25, 0.1);
    if (kind === "mushroom") cube(0xd5b0a0, 0, 0.66, 0, 1, 0.2, 0.7);
    if (kind === "heron") cube(0xd1d6c9, -0.25, 1, 0, 0.13, 1, 0.13);
  } else if (kind === "hammer") {
    cube(0x9a754a, 0, 0.45, 0, 0.12, 0.9, 0.12);
    cube(0x80938d, 0, 0.95, 0, 0.75, 0.35, 0.35);
    cube(0xc5b27c, -0.3, 0.95, 0, 0.08, 0.38, 0.38);
  } else if (kind === "key") {
    for (const x of [-0.15, 0.15]) cube(0xd3b774, x, 0.75, 0, 0.1, 0.35, 0.1);
    for (const y of [0.6, 0.9]) cube(0xd3b774, 0, y, 0, 0.35, 0.1, 0.1);
    cube(0xd3b774, 0, 0.32, 0, 0.1, 0.65, 0.1);
    cube(0xd3b774, 0.15, 0.08, 0, 0.3, 0.1, 0.1);
    cube(0xd3b774, 0.1, 0.23, 0, 0.2, 0.1, 0.1);
  } else if (kind === "lamp") {
    cube(0xc79a57, 0, 0.15, 0, 0.45, 0.15, 0.45);
    cube(0xd8b371, 0, 0.4, 0, 0.65, 0.35, 0.4);
    cube(0xe2c483, 0, 0.61, 0, 0.35, 0.12, 0.3);
    cube(0xd8b371, -0.5, 0.48, 0, 0.5, 0.13, 0.15);
    for (const y of [0.25, 0.6]) cube(0xc79a57, 0.45, y, 0, 0.3, 0.08, 0.1);
    cube(0xc79a57, 0.6, 0.42, 0, 0.08, 0.35, 0.1);
  } else if (kind === "compass") {
    for (let row = -2; row <= 2; row++)
      cube(
        0xc8ad73,
        0,
        0.1 + row * 0.1,
        0,
        Math.abs(row) === 2 ? 0.35 : 0.55,
        0.11,
        0.12,
      );
    cube(0xdcd8b7, 0, 0.1, 0.08, 0.4, 0.4, 0.05);
    box(0xb9675d, -0.07, 0.18, 0.12, 0.08, 0.27, 0.06, -0.6);
    box(0x6c9293, 0.07, 0.02, 0.12, 0.08, 0.27, 0.06, -0.6);
  } else if (kind === "scroll") {
    cube(0xe3d5ac, 0, 0.5, 0, 0.65, 0.65, 0.08);
    for (const y of [0.15, 0.85]) cube(0xc8ad7a, 0, y, 0, 0.85, 0.16, 0.2);
    for (let i = 0; i < 4; i++)
      cube(0x9a937a, 0, 0.68 - i * 0.12, 0.06, 0.42, 0.025, 0.02);
  } else if (kind === "crystal") {
    for (let i = 0; i < 6; i++)
      cube(
        0x85d5cd,
        Math.sin(i) * 0.16,
        0.1 + i * 0.13,
        0,
        0.2,
        0.15,
        0.2,
        true,
      );
  } else {
    cube(0xe2d6b1, 0, 0.5, 0, 0.68, 0.9, 0.07);
    for (let i = 0; i < 4; i++)
      cube(
        0x99896b,
        0,
        0.67 - i * 0.12,
        0.045,
        0.45 - (i % 2) * 0.1,
        0.025,
        0.025,
      );
    cube(0xb26f60, 0.15, 0.25, 0.05, 0.15, 0.15, 0.03);
  }
  finish();
  return root;
}
