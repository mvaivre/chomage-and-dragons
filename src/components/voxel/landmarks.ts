import * as THREE from "three";
import { characterModel, dragonModel, propModel } from "./objects";
import { VoxelResources } from "./resources";

/** Narrative landmarks are modelled independently of terrain chunks. */
export function landmarkModel(resources: VoxelResources, kind: string) {
  const root = new THREE.Group(),
    { box, finish } = resources.batch(root);
  const add = (kind: string, x: number, y: number, z: number, scale = 1) => {
    const p = propModel(resources, kind);
    p.position.set(x, y, z);
    p.scale.setScalar(scale);
    root.add(p);
    return p;
  };
  switch (kind) {
    case "windmill": {
      box(0xbca980, 0, 0.14, 0, 2.2, 0.28, 1.9);
      box(0xd4c49e, 0, 1.5, 0, 1.6, 2.8, 1.5);
      box(0xc6b48d, 0, 1.5, 0, 1.9, 2.8, 1.1);
      for (let i = 0; i < 7; i++)
        box(
          0x806044,
          0,
          2.9 + i * 0.12,
          0,
          2.3 - i * 0.3,
          0.14,
          1.9 - i * 0.25,
        );
      box(0x564c3d, 0, 0.65, 0.8, 0.5, 1.3, 0.12);
      box(0xe9c987, 0.5, 1.9, 0.81, 0.35, 0.5, 0.08, 0, true);
      const sails = new THREE.Group(),
        b = resources.batch(sails);
      sails.position.set(0, 2.75, 1.05);
      for (let arm = 0; arm < 4; arm++) {
        const a = (arm * Math.PI) / 2;
        for (let j = 1; j < 12; j++) {
          const d = j * 0.2;
          b.box(
            0x9c845f,
            Math.cos(a) * d,
            Math.sin(a) * d,
            0,
            0.15,
            0.15,
            0.15,
          );
          for (let k = 0; k < 3; k++)
            b.box(
              0xd9c99c,
              Math.cos(a) * d - Math.sin(a) * k * 0.13,
              Math.sin(a) * d + Math.cos(a) * k * 0.13,
              0.02,
              0.13,
              0.13,
              0.07,
            );
        }
      }
      b.finish();
      root.add(sails);
      root.userData.sails = sails;
      break;
    }
    case "plaine":
      box(0x8c6d45, 0, 1.5, 0, 0.2, 3, 0.2);
      box(0x997347, 0, 2, 0, 2, 0.16, 0.16);
      add("letter", 0, 1.4, 0.13, 1.1);
      add("gnome", 0, 2.2, 0, 0.7);
      break;
    case "foret":
      box(0x697f70, 0, 0.8, 0, 2.5, 1.6, 1.3);
      box(0x314c40, 0, 1.65, 0, 2.3, 0.18, 1.2);
      for (let i = 0; i < 6; i++)
        box(0xd0c097, -0.8 + i * 0.32, 1.7, 0, 0.08, 0.06, 1);
      for (let i = 0; i < 8; i++) {
        const letter = add(
          "letter",
          Math.sin(i * 31),
          0.1 + i * 0.09,
          1.2,
          0.4,
        );
        letter.rotation.z = i * 0.7;
      }
      box(0xb39b67, 1.5, 1.2, 0, 0.7, 0.15, 0.15);
      box(0xb39b67, 1.8, 1.5, 0, 0.15, 0.7, 0.15);
      break;
    case "marais":
      for (let i = 0; i < 7; i++) {
        add(
          "cup",
          Math.sin(i * 13) * 1.5,
          0.2,
          Math.cos(i * 7) * 0.8,
          0.6 + (i % 3) * 0.3,
        );
        box(
          0x689184,
          Math.sin(i * 13) * 1.5,
          0.6,
          Math.cos(i * 7) * 0.8,
          0.2,
          0.6,
          0.2,
        );
      }
      break;
    case "lac":
      for (let x = -3; x <= 3; x += 0.3)
        box(0xab8d60, x, 0.2, 0, 0.29, 0.15, 2);
      for (const z of [-1, 1]) {
        box(0x927c54, 0, 0.8, z, 6.4, 0.12, 0.12);
        for (let x = -3; x <= 3; x++) box(0x8c7954, x, 0.5, z, 0.1, 0.8, 0.1);
      }
      add("recruiter", 0, 0.3, 0.5);
      add("letter", 1, 0.8, 0);
      break;
    case "tears": {
      // Two streams leave the stone face and reach the same stepped basin.
      box(0x708984, 0, 0.1, 0, 4, 0.3, 3);
      box(0x829a94, 0, 1.1, 0, 2.3, 2, 1.7);
      box(0x9eafa2, 0, 3, 0, 1.9, 2, 1.6);
      for (const x of [-0.45, 0.45]) {
        box(0x354e48, x, 3.25, 0.83, 0.32, 0.18, 0.08);
        for (let i = 0; i < 14; i++)
          box(
            i % 3 ? 0x7cbcc2 : 0xa2d6d0,
            x + Math.sin(i * 0.3) * 0.08,
            3.2 - i * 0.21,
            0.92 + i * 0.035,
            0.09 + i * 0.009,
            0.25,
            0.09,
            0,
            i % 4 === 0,
          );
      }
      for (let x = -6; x <= 6; x++)
        for (let z = 0; z < 6; z++)
          if ((x * x) / 40 + (z - 2) ** 2 / 10 < 1)
            box(0x609b9f, x * 0.25, 0.3, 1 + z * 0.25, 0.25, 0.08, 0.25);
      break;
    }
    case "cascade":
      for (let x = -6; x <= 6; x++) {
        const h = 5 - Math.abs(x) * 0.25;
        box(0x789387, x * 0.38, h / 2, -0.7, 0.38, h, 1.6);
        if (Math.abs(x) < 3)
          for (let j = 0; j < 17; j++)
            box(
              j % 4 ? 0x6faeb9 : 0xa9d2ce,
              x * 0.38,
              h - j * 0.28,
              0.2,
              0.38,
              0.31,
              0.2,
              0,
              j % 6 === 0,
            );
      }
      break;
    case "montagne":
      for (const x of [-0.4, 0.4]) box(0x967d5b, x, 2.7, 0, 0.12, 5.4, 0.12);
      for (let y = 0.2; y < 5.4; y += 0.4)
        box(0xbba47b, 0, y, 0, 0.9, 0.08, 0.12);
      add("letter", 0.8, 3.6, 0);
      break;
    case "desert":
      box(0xb8a37a, 0, 0.2, 0, 3, 0.4, 2);
      for (const x of [-1, 1]) box(0xc6b587, x, 1.3, 0, 0.4, 2.5, 0.4);
      box(0xdcc697, 0, 2.7, 0, 2.8, 0.4, 0.9);
      add("cup", 0, 1.2, 0, 2);
      break;
    case "taverne":
      for (let x = -2; x <= 2; x += 0.5) box(0x93774f, x, 0.15, 0, 0.5, 0.3, 3);
      box(0xa68a5b, 0, 1, 0, 2.5, 0.2, 1.4);
      add("gnome", -1, 0.3, -1);
      add("innkeeper", 1, 0.3, -1);
      add("cup", 0, 1.15, 0);
      break;
  }
  finish();
  return root;
}

/** Same eight tavern jokes as the original party, rebuilt as little voxel scenes. */
export function tavernGuest(resources: VoxelResources, id: string) {
  const root = new THREE.Group(),
    { box, finish } = resources.batch(root);
  const hero = (id: string, x = 0, y = 0, z = 0) => {
    const p = characterModel(resources, id);
    p.position.set(x, y, z);
    p.scale.setScalar(0.65);
    root.add(p);
    return p;
  };
  const cup = (x: number, y: number, z: number) => {
    const p = propModel(resources, "cup");
    p.position.set(x, y, z);
    p.scale.setScalar(0.5);
    root.add(p);
  };
  switch (id) {
    case "wizard":
      box(0x8e7450, 0, 0.3, 0, 1.5, 0.6, 1.2);
      hero("archimage", 0, 0.1);
      for (let i = 0; i < 5; i++)
        cup(Math.sin(i) * 0.7, 0.6, Math.cos(i) * 0.5);
      break;
    case "dancers":
      box(0x8d7353, 0, 0.7, 0, 2.1, 0.2, 1.3);
      hero("barde", -0.5, 0.8);
      hero("fee", 0.5, 0.8);
      break;
    case "bard":
      hero("barde");
      hero("demon", 0, 1.1, -0.15);
      break;
    case "band":
      hero("squelette", -0.8);
      hero("necromancien", 0.8);
      box(0xb5905c, 0, 0.4, 0.2, 0.7, 0.8, 0.7);
      break;
    case "chandelier": {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        box(
          0xd4b97c,
          Math.cos(a) * 0.8,
          2.8,
          Math.sin(a) * 0.8,
          0.25,
          0.15,
          0.25,
        );
        box(
          0xffd38a,
          Math.cos(a) * 0.8,
          3,
          Math.sin(a) * 0.8,
          0.08,
          0.25,
          0.08,
          0,
          true,
        );
      }
      box(0x8d7956, 0, 3.3, 0, 0.08, 1, 0.08);
      hero("chevalier", 0, 2.7);
      break;
    }
    case "dragon": {
      const dragon = dragonModel(resources, "gold");
      dragon.scale.setScalar(0.65);
      root.add(dragon);
      cup(-1, 0.8, 1);
      break;
    }
    case "handstand": {
      const p = hero("voleur", 0, 1.4);
      p.rotation.z = Math.PI;
      break;
    }
    case "kiss": {
      const ogre = propModel(resources, "troll");
      ogre.scale.setScalar(0.8);
      root.add(ogre);
      const p = hero("licorne", 0.8);
      p.rotation.z = 0.25;
      cup(0.6, 1, 0);
      break;
    }
  }
  finish();
  return root;
}
