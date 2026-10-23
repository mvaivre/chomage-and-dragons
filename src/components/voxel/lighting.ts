import * as THREE from "three";

type Candidate = { source: THREE.PointLight | null; position: THREE.Vector3; distance: number };
/** Fixed shader light count, bounded nearest-source selection and reusable scratch.
 * Offscreen/interior sources consume no GPU lighting. */
export class LocalLightPool {
  readonly lights: THREE.PointLight[];
  private candidates: Candidate[];
  private position = new THREE.Vector3();
  active = 0;
  constructor(world: THREE.Scene, count: number) {
    this.candidates = Array.from({ length: count }, () => ({ source: null, position: new THREE.Vector3(), distance: Infinity }));
    this.lights = Array.from({ length: count }, () => {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      world.add(light);
      return light;
    });
  }
  update(sources: Iterable<THREE.PointLight>, focus: THREE.Vector3, budget: number, matricesCurrent = false) {
    const limit = Math.min(budget, this.lights.length);
    let count = 0;
    if (limit) for (const source of sources) {
      if (source.intensity <= 0) continue;
      let parent = source.parent;
      while (parent?.visible) parent = parent.parent;
      if (parent) continue;
      if (matricesCurrent) this.position.setFromMatrixPosition(source.matrixWorld);
      else source.getWorldPosition(this.position);
      const distance = this.position.distanceToSquared(focus);
      if (distance > 30 * 30 || (count === limit && distance >= this.candidates[limit - 1].distance)) continue;
      let index = Math.min(count, limit - 1);
      const slot = this.candidates[index];
      while (index > 0 && distance < this.candidates[index - 1].distance) {
        this.candidates[index] = this.candidates[index - 1]; index--;
      }
      this.candidates[index] = slot;
      slot.source = source; slot.position.copy(this.position); slot.distance = distance;
      count = Math.min(count + 1, limit);
    }
    this.active = count;
    this.lights.forEach((light, i) => {
      const candidate = i < count ? this.candidates[i] : undefined;
      light.intensity = candidate?.source?.intensity ?? 0;
      if (!candidate) return;
      light.position.copy(candidate.position);
      light.color.copy(candidate.source!.color);
      light.distance = candidate.source!.distance;
      light.decay = candidate.source!.decay;
      light.updateMatrixWorld();
    });
    // Evicted light sources must not retain released chunk hierarchies.
    for (const slot of this.candidates) slot.source = null;
  }
}
