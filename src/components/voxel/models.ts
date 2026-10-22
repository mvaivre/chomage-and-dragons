import * as THREE from "three";
import type { Character } from "@/lib/game/characters";

export interface VoxelDetailContext {
  scene: THREE.Scene;
  cube: THREE.BoxGeometry;
  box(
    color: THREE.ColorRepresentation,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotation?: number,
  ): unknown;
  material(
    color: THREE.ColorRepresentation,
    glow?: boolean,
  ): THREE.MeshStandardMaterial;
  geometry<T extends THREE.BufferGeometry>(value: T): T;
  instances: THREE.InstancedMesh[];
  blockers: THREE.Box3[];
  random(): number;
  routeZ(x: number): number;
}

/** Small local voxel models are instanced by material, so a walking hero is not
 * hundreds of independent draw calls. The static world uses the scene's shared batches. */
export function model(ctx: VoxelDetailContext, parent: THREE.Group) {
  const buckets = new Map<
    string,
    { mat: THREE.MeshStandardMaterial; matrices: THREE.Matrix4[] }
  >();
  const transform = new THREE.Object3D();
  function block(
    color: THREE.ColorRepresentation,
    x: number,
    y: number,
    z: number,
    w: number,
    h = w,
    d = w,
    glow = false,
  ) {
    const mat = ctx.material(color, glow);
    const bucket = buckets.get(mat.uuid) ?? { mat, matrices: [] };
    transform.position.set(x, y, z);
    transform.scale.set(w, h, d);
    transform.updateMatrix();
    bucket.matrices.push(transform.matrix.clone());
    buckets.set(mat.uuid, bucket);
  }
  function ellipsoid(
    colors: THREE.ColorRepresentation[],
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    step = 0.12,
  ) {
    const nx = Math.ceil(rx / step),
      ny = Math.ceil(ry / step),
      nz = Math.ceil(rz / step);
    const inside = (i: number, j: number, k: number) =>
      ((i * step) / rx) ** 2 +
        ((j * step) / ry) ** 2 +
        ((k * step) / rz) ** 2 <=
      1;
    for (let i = -nx; i <= nx; i++)
      for (let j = -ny; j <= ny; j++)
        for (let k = -nz; k <= nz; k++) {
          if (!inside(i, j, k)) continue;
          if (
            inside(i + 1, j, k) &&
            inside(i - 1, j, k) &&
            inside(i, j + 1, k) &&
            inside(i, j - 1, k) &&
            inside(i, j, k + 1) &&
            inside(i, j, k - 1)
          )
            continue;
          const index = Math.abs(i * 7 + j * 3 + k * 11) % colors.length;
          block(
            colors[index],
            x + i * step,
            y + j * step,
            z + k * step,
            step * 1.01,
          );
        }
  }
  function finish() {
    for (const { mat, matrices } of buckets.values()) {
      const mesh = new THREE.InstancedMesh(ctx.cube, mat, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      ctx.instances.push(mesh);
    }
  }
  return { block, ellipsoid, finish };
}

export function detailedCharacter(
  ctx: VoxelDetailContext,
  parent: THREE.Group,
  character: Character,
) {
  const torso = new THREE.Group(),
    head = new THREE.Group();
  parent.add(torso, head);
  head.position.y = 1.42;
  torso.name = "torso";
  head.name = "head";
  const bodyModel = model(ctx, torso),
    headModel = model(ctx, head),
    p = character.palette;
  const block: typeof bodyModel.block = (
    color,
    x,
    y,
    z,
    w,
    h = w,
    d = w,
    glow = false,
  ) => {
    if (y > 1.25 && Math.abs(x) < 0.61)
      headModel.block(color, x, y - 1.42, z, w, h, d, glow);
    else bodyModel.block(color, x, y, z, w, h, d, glow);
  };
  const ellipsoid: typeof bodyModel.ellipsoid = (
    colors,
    x,
    y,
    z,
    rx,
    ry,
    rz,
    step = 0.12,
  ) => {
    if (y > 1.25 && Math.abs(x) < 0.61)
      headModel.ellipsoid(colors, x, y - 1.42, z, rx, ry, rz, step);
    else bodyModel.ellipsoid(colors, x, y, z, rx, ry, rz, step);
  };
  const finish = () => {
    bodyModel.finish();
    headModel.finish();
  };
  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.42, 1.18, 0);
    parent.add(arm);
    const a = model(ctx, arm);
    a.ellipsoid([p.robe, p.robeDark], 0, -0.23, 0, 0.17, 0.31, 0.17, 0.09);
    a.block(p.skin, side * 0.05, -0.5, 0.06, 0.19, 0.2, 0.2);
    a.finish();
    limbs.push(arm);
    const foot = new THREE.Group();
    foot.position.set(side * 0.2, 0.22, 0);
    parent.add(foot);
    const f = model(ctx, foot);
    f.block("#403d39", 0, -0.12, 0.12, 0.29, 0.2, 0.43);
    f.finish();
    limbs.push(foot);
  }
  parent.userData.animate = (
    time: number,
    moving = false,
    options: { blend?: number; stride?: number; motion?: string } = {},
  ) => {
    const blend = options.blend ?? (moving ? 1 : 0),
      phase = options.stride ?? time * 9;
    const breath = Math.sin(time * 2) * 0.008,
      step = Math.sin(phase),
      skater = character.id === "skater";
    torso.position.y = breath;
    torso.rotation.set(
      skater ? blend * 0.1 : 0,
      step * blend * 0.045,
      step * blend * 0.025,
    );
    torso.scale.set(1, 1 + breath, 1);
    head.position.y = 1.42 + breath;
    head.rotation.set(
      Math.sin(time * 1.6) * 0.025,
      Math.sin(time * 0.7) * 0.09 * (1 - blend),
      -step * blend * 0.035,
    );
    limbs.forEach((limb, i) => {
      const arm = i % 2 === 0,
        side = i < 2 ? -1 : 1,
        wave = Math.sin(phase + (side > 0 ? Math.PI : 0));
      limb.rotation.set(
        arm
          ? wave * blend * 0.55 + Math.sin(time * 1.7) * 0.035
          : -wave * blend * (skater ? 0.12 : 0.45),
        0,
        arm ? side * (0.05 + blend * (skater ? 0.3 : 0.04)) : 0,
      );
      limb.position.y =
        (arm ? 1.18 : 0.22) +
        (arm ? breath : Math.max(0, wave) * blend * (skater ? 0.015 : 0.11));
    });
    if (blend < 0.3) {
      if (character.id === "barde")
        limbs[0].rotation.z += Math.sin(time * 5) * 0.12;
      if (character.id === "sorciere")
        limbs[2].rotation.x -= 0.12 + Math.sin(time * 1.8) * 0.04;
    }
    const action = options.motion;
    if (action === "send") {
      limbs[2].rotation.x = -1.05;
      limbs[2].rotation.z = 0.16 + Math.sin(time * 8) * 0.16;
      head.rotation.y = 0.15;
    }
    if (action === "hurt") {
      torso.rotation.x = -0.16;
      head.rotation.x = 0.22;
      limbs[0].rotation.x = -0.5;
      limbs[2].rotation.x = -0.6;
    }
    if (action === "celebrate") {
      limbs[0].rotation.z = -2.3;
      limbs[2].rotation.z = 2.3;
      torso.position.y += Math.abs(Math.sin(time * 5)) * 0.06;
      head.rotation.z = Math.sin(time * 4) * 0.1;
    }
  };
  // A solid robe needs only its stepped silhouette and front color panel.
  // The former filled voxel volume drew hundreds of invisible internal cubes.
  for (let tier = 0; tier < 4; tier++) {
    const y = 0.35 + tier * 0.25, radius = 0.48 - (y - 0.25) * 0.19;
    block(p.robeDark, 0, y, 0, radius * 2, 0.26, radius * 2);
    block(tier === 0 ? p.trim : p.robe, 0, y, radius + 0.007,
      Math.min(0.6, radius * 1.6), 0.26, 0.025);
  }
  ellipsoid([p.skin], 0, 1.49, 0, 0.32, 0.33, 0.3, 0.085);
  block(p.skin, 0, 1.44, 0.33, 0.12, 0.1, 0.12);
  for (const side of [-1, 1]) {
    block("#352e35", side * 0.13, 1.54, 0.29, 0.055, 0.075, 0.055);
    block("#d3a284", side * 0.19, 1.44, 0.275, 0.08, 0.045, 0.035);
  }
  block(p.trim, 0, 0.93, 0.38, 0.2, 0.11, 0.05);
  if (!["sorciere", "chevalier", "barde"].includes(character.id)) {
    const hat = character.hat;
    if (hat === "pointu" || hat === "capuche") {
      for (let layer = 0; layer < 8; layer++) {
        const r =
          hat === "pointu"
            ? 0.35 * (1 - layer / 8)
            : 0.38 - Math.max(0, layer - 3) * 0.06;
        for (let x = -r; x <= r; x += 0.1)
          for (let z = -r; z <= r; z += 0.1)
            if (x * x + z * z < r * r && (hat !== "capuche" || z < 0.12))
              block(p.robeDark, x, 1.65 + layer * 0.09, z, 0.11);
      }
    } else if (hat === "couronne") {
      for (let x = -0.3; x <= 0.3; x += 0.1) {
        block(p.trim, x, 1.8, 0.22, 0.11, 0.12, 0.1);
        if (Math.round(x * 10) % 2 === 0)
          block(p.trim, x, 1.96, 0.22, 0.11, 0.24, 0.1);
      }
    } else if (hat === "licorne") {
      ellipsoid([p.skin], 0, 1.7, -0.12, 0.35, 0.32, 0.3, 0.09);
      for (let i = 0; i < 5; i++)
        block(
          p.trim,
          0,
          1.98 + i * 0.08,
          0.17,
          0.15 - i * 0.025,
          0.09,
          0.15 - i * 0.025,
        );
      for (let i = 0; i < 6; i++)
        block(
          ["#cc80c4", "#91ceca", "#e4bf7e"][i % 3],
          -0.32,
          1.75 - i * 0.13,
          -0.1,
          0.16,
          0.16,
          0.14,
        );
    } else if (hat === "peluche") {
      for (const side of [-1, 1])
        ellipsoid([p.robe], side * 0.28, 1.8, 0, 0.16, 0.17, 0.12, 0.075);
      ellipsoid([p.trim], 0, 1.38, 0.26, 0.19, 0.12, 0.13, 0.065);
    } else if (hat === "demon") {
      for (const side of [-1, 1])
        for (let i = 0; i < 4; i++)
          block(
            p.trim,
            side * (0.29 + i * 0.02),
            1.78 + i * 0.09,
            0,
            0.13 - i * 0.025,
            0.1,
            0.12 - i * 0.02,
          );
    } else if (hat === "squelette") {
      for (const side of [-1, 1])
        block("#242732", side * 0.14, 1.53, 0.3, 0.14, 0.14, 0.06);
      for (let i = 0; i < 4; i++)
        block("#242732", -0.15 + i * 0.1, 1.3, 0.28, 0.045, 0.08, 0.05);
    } else if (hat === "casquette") {
      ellipsoid([p.trim], 0, 1.77, -0.03, 0.35, 0.18, 0.31, 0.09);
      block(p.trim, 0.1, 1.76, 0.3, 0.52, 0.08, 0.29);
      for (let i = 0; i < 5; i++)
        block("#b5b4a9", -0.4 + i * 0.2, 0.08, 0.13, 0.2, 0.08, 0.65);
    } else if (hat === "vampire") {
      for (const side of [-1, 1])
        block(p.trim, side * 0.3, 1.3, -0.2, 0.13, 0.6, 0.16);
    } else block(p.trim, 0, 1.76, 0.18, 0.6, 0.1, 0.08);
    if (hat === "fee")
      for (const side of [-1, 1])
        for (let i = 0; i < 5; i++)
          block(
            "#afd9c8",
            side * (0.42 + i * 0.07),
            1.2 + i * 0.1,
            -0.23,
            0.15,
            0.21,
            0.05,
          );
    const prop = character.prop;
    if (["baton", "lance", "faux", "fourche", "baguette"].includes(prop)) {
      for (let y = 0.15; y < 2; y += 0.12)
        block("#99805b", 0.65, y, 0.12, 0.075, 0.13, 0.075);
      if (prop === "faux")
        for (let i = 0; i < 5; i++)
          block(
            "#b8c7ca",
            0.65 - i * 0.11,
            2.03 - i * 0.03,
            0.12,
            0.13,
            0.1,
            0.06,
          );
      else if (prop === "fourche")
        for (const dx of [-0.15, 0, 0.15])
          block(p.trim, 0.65 + dx, 2.08, 0.12, 0.06, 0.33, 0.06);
      else block(p.trim, 0.65, 2.05, 0.12, 0.21, 0.23, 0.21, true);
    } else if (prop === "grimoire") {
      block(p.robeDark, 0.57, 1, 0.25, 0.42, 0.55, 0.15);
      block(p.trim, 0.57, 1, 0.34, 0.25, 0.35, 0.03);
    } else if (prop === "miel") {
      block(p.trim, 0.55, 0.8, 0.2, 0.35, 0.37, 0.35);
      block("#68402e", 0.55, 1.02, 0.2, 0.4, 0.08, 0.4);
    } else if (prop === "ombrelle") {
      for (let i = 0; i < 8; i++)
        block(
          "#64425f",
          0.65 + (i - 4) * 0.15,
          2.07 - Math.abs(i - 4) * 0.04,
          0.1,
          0.16,
          0.1,
          0.65,
        );
      block(p.trim, 0.65, 1.4, 0.1, 0.06, 1.3, 0.06);
    } else if (prop === "arcenciel")
      for (let i = 0; i < 9; i++)
        block(
          ["#e990a9", "#e3c077", "#83cbbe", "#9c9cce"][i % 4],
          0.55 + i * 0.1,
          0.8 + Math.sin((i / 8) * Math.PI) * 0.35,
          0.1,
          0.12,
          0.16,
          0.09,
        );
    else if (prop === "dague" || prop === "epee")
      block("#b9c9c9", 0.56, 1.05, 0.2, 0.08, 0.65, 0.08);
  } else if (character.id === "sorciere") {
    for (let x = -0.6; x <= 0.6; x += 0.1)
      for (let z = -0.5; z <= 0.5; z += 0.1)
        if ((x * x) / 0.36 + (z * z) / 0.25 < 1)
          block(p.robeDark, x, 1.78, z, 0.105, 0.08, 0.105);
    for (let layer = 0; layer < 10; layer++) {
      const radius = 0.37 * (1 - layer / 10),
        y = 1.86 + layer * 0.085;
      for (let x = -radius; x <= radius; x += 0.085)
        for (let z = -radius; z <= radius; z += 0.085)
          if (x * x + z * z <= radius * radius)
            block(
              layer < 2 ? p.robeDark : p.robe,
              x - layer * 0.018,
              y,
              z,
              0.088,
            );
    }
    block(p.trim, 0.17, 1.95, 0.29, 0.13, 0.13, 0.05);
    for (let y = 0.12; y < 2.12; y += 0.12)
      block("#7b5741", 0.67, y, 0.12, 0.09, 0.125, 0.09);
    for (const side of [-1, 1])
      block("#a78a54", 0.67 + side * 0.11, 2.07, 0.12, 0.1, 0.23, 0.09);
    ellipsoid([p.trim], 0.67, 2.24, 0.12, 0.15, 0.17, 0.15, 0.075);
    block("#bcebb1", 0.67, 2.27, 0.12, 0.16, 0.17, 0.16, true);
  } else if (character.id === "chevalier") {
    ellipsoid([p.robe, "#9facb5"], 0, 1.73, -0.035, 0.36, 0.27, 0.32, 0.085);
    block("#3a4852", 0, 1.59, 0.3, 0.47, 0.09, 0.06);
    for (let y = 1.92; y < 2.24; y += 0.08)
      block(p.trim, 0, y, -0.04, 0.12, 0.085, 0.23);
    for (let y = 0.12; y < 1.85; y += 0.12)
      block("#b9c7cc", 0.67, y, 0.12, 0.075, 0.125, 0.075);
    block("#d8bb7b", 0.67, 0.65, 0.12, 0.33, 0.07, 0.1);
    ellipsoid([p.trim, p.robeDark], -0.53, 0.85, 0.18, 0.27, 0.36, 0.12, 0.085);
    block("#e3bc6e", -0.53, 0.87, 0.31, 0.1, 0.35, 0.04);
  } else {
    ellipsoid([p.robeDark], 0, 1.77, 0, 0.46, 0.08, 0.4, 0.09);
    ellipsoid([p.robe], 0.07, 1.88, -0.03, 0.34, 0.17, 0.32, 0.09);
    for (let i = 0; i < 5; i++)
      block(
        "#e9d9ad",
        -0.22 - i * 0.025,
        1.98 + i * 0.08,
        0.02,
        0.09,
        0.09,
        0.07,
      );
    ellipsoid(
      ["#ad7d43", "#c39a58"],
      -0.43,
      0.82,
      0.32,
      0.25,
      0.31,
      0.11,
      0.07,
    );
    block("#78533a", -0.36, 1.17, 0.32, 0.1, 0.54, 0.09);
    block("#e5c58f", -0.43, 0.84, 0.45, 0.11, 0.12, 0.025);
    for (let i = 0; i < 3; i++)
      block("#d9cbb5", -0.48 + i * 0.035, 1.02, 0.45, 0.012, 0.42, 0.01);
  }
  finish();
}

export function detailedDragon(ctx: VoxelDetailContext) {
  const group = new THREE.Group();
  group.position.set(8, 0.2, -3.15);
  group.rotation.y = -0.35;
  ctx.scene.add(group);
  const body = model(ctx, group);
  body.ellipsoid(
    ["#4b8066", "#51886c", "#609476"],
    0,
    0.68,
    0,
    1.3,
    0.72,
    0.82,
    0.145,
  );
  body.ellipsoid(
    ["#a6b87b", "#b6c389"],
    -0.62,
    0.5,
    0.3,
    0.62,
    0.43,
    0.63,
    0.13,
  );
  for (const side of [-1, 1]) {
    body.ellipsoid(
      ["#54866c", "#629378"],
      -0.4,
      0.2,
      side * 0.7,
      0.46,
      0.2,
      0.3,
      0.11,
    );
    for (let toe = 0; toe < 3; toe++)
      body.block(
        "#d9cf9e",
        -0.72 + toe * 0.19,
        0.13,
        side * 0.89,
        0.11,
        0.1,
        0.2,
      );
    for (let i = 0; i < 11; i++)
      for (let j = 0; j < 10 - i * 0.45; j++) {
        body.block(
          j < 1 ? "#b0bd82" : "#49785f",
          0.1 + i * 0.12,
          0.95 + j * 0.12,
          side * (0.4 + i * 0.065 + j * 0.06),
          0.13,
          0.13,
          0.12,
        );
      }
  }
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 3 - (i % 2); j++)
      body.block(
        "#c9bc83",
        -0.55 + i * 0.32,
        1.25 + j * 0.1,
        -0.08,
        0.15 - j * 0.025,
        0.11,
        0.16,
      );
  }
  for (let i = 0; i < 18; i++) {
    const t = i / 17,
      angle = t * Math.PI * 1.25;
    body.block(
      "#51886c",
      0.8 + Math.sin(angle) * 1.15,
      0.3,
      1 - Math.cos(angle),
      0.4 - t * 0.23,
      0.36 - t * 0.2,
      0.37 - t * 0.2,
    );
  }
  body.finish();
  const head = new THREE.Group();
  head.position.set(-1.08, 0.94, 0.25);
  group.add(head);
  const face = model(ctx, head);
  face.ellipsoid(["#6b9d7b", "#76a782"], 0, 0, 0, 0.63, 0.49, 0.56, 0.115);
  face.ellipsoid(
    ["#83ae87", "#8eb98e"],
    -0.43,
    -0.18,
    0.26,
    0.57,
    0.25,
    0.46,
    0.105,
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++)
      face.block(
        "#dfd2a5",
        0.17 + i * 0.035,
        0.44 + i * 0.11,
        side * 0.3,
        0.14 - i * 0.025,
        0.12,
        0.14 - i * 0.025,
      );
    face.block("#e7cb83", -0.2, 0.09, side * 0.49, 0.16, 0.12, 0.09);
    face.block("#283f3b", -0.24, 0.11, side * 0.55, 0.13, 0.04, 0.03);
    face.block("#456c54", -0.78, -0.1, 0.26 + side * 0.2, 0.08, 0.06, 0.08);
  }
  face.finish();
  return head;
}
