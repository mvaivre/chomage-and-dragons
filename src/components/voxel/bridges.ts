import * as THREE from "three";
import { lantern } from "./scenery";
import { VoxelResources } from "./resources";
import { routeHeight, routeZ, terrainHeight, riverProfile, type RiverSite } from "./world";

/** A raised plank deck with clear air and flowing water underneath; rails stay off the route. */
export function riverBridge(r: VoxelResources, site: RiverSite) {
  const root = new THREE.Group(), b = r.batch(root, false, 0, true);
  root.name = site.id;
  for (let i = -8; i <= 8; i++) {
    const x = site.x + i * 0.5, y = routeHeight(x), z = routeZ(x);
    b.box(i % 3 ? 0xa78653 : 0xc4a36b, x, y + 0.07, z, 0.48, 0.2, 4.85);
    for (const side of [-1, 1]) {
      b.box(0x7b6240, x, y + 0.86, z + side * 2.55, 0.53, 0.12, 0.1);
      if (i % 4 === 0) b.box(0x6e573d, x, y + 0.56, z + side * 2.55, 0.14, 1.12, 0.14);
    }
    if (i % 6 === 0) for (const side of [-1, 1]) {
      const zz = z + side * 2, ground = terrainHeight(x, zz);
      b.box(0x68563c, x, (y + ground) / 2, zz, 0.24, y - ground + 0.05, 0.24);
    }
  }
  b.finish(); root.userData.bridge = site;
  for (const side of [-1, 1]) {
    const x = site.x + side * 4.8, z = routeZ(x) + 2.8, lamp = lantern(r, 2.1, 10);
    lamp.position.set(x, routeHeight(x) + .15, z); root.add(lamp);
  }
  const flow = new THREE.Group(), glints = r.batch(flow);
  for (let i = 0; i < 16; i++) glints.box(0xa4d1c6, 0, 0, 0, .55, .025, .09);
  glints.finish(); root.add(flow);
  const mesh = flow.children[0] as THREE.InstancedMesh, pose = new THREE.Object3D();
  pose.scale.set(.55, .025, .09);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = false;
  root.userData.animate = (time: number) => {
    for (let i = 0; i < mesh.count; i++) {
      const z = -14.5 + ((i * 1.7 + time * .55) % 26), profile = riverProfile(site, z), x = profile.center + Math.sin(i * 3) * profile.width * .65;
      pose.position.set(x, site.y + .025, z); pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  root.userData.animate(0);
  return root;
}
