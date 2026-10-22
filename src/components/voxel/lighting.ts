import * as THREE from "three";

/** Fixed shader light count. Offscreen/interior sources consume no GPU lighting. */
export class LocalLightPool {
  readonly lights: THREE.PointLight[];
  active = 0;
  constructor(world: THREE.Scene, count: number) {
    this.lights = Array.from({ length: count }, () => {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      world.add(light);
      return light;
    });
  }
  update(sources: Iterable<THREE.PointLight>, focus: THREE.Vector3, budget: number) {
    const candidates: { source: THREE.PointLight; position: THREE.Vector3; distance: number }[] = [];
    for (const source of sources) {
      if (source.intensity <= 0) continue;
      let parent = source.parent;
      while (parent?.visible) parent = parent.parent;
      if (parent) continue;
      const position = source.getWorldPosition(new THREE.Vector3());
      const distance = position.distanceToSquared(focus);
      if (distance > 30 * 30) continue;
      candidates.push({ source, position, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    this.active = Math.min(budget, candidates.length, this.lights.length);
    this.lights.forEach((light, i) => {
      const candidate = i < this.active ? candidates[i] : undefined;
      light.intensity = candidate?.source.intensity ?? 0;
      if (!candidate) return;
      light.position.copy(candidate.position);
      light.color.copy(candidate.source.color);
      light.distance = candidate.source.distance;
      light.decay = candidate.source.decay;
    });
  }
}
