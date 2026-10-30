import * as THREE from "three";

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
