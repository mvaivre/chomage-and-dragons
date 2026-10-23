import type { Group } from "three";

/** Structural revision invalidates interaction discovery only when scenery changes. */
export class SceneObjects extends Map<string, Group> {
  revision = 0;
  override set(id: string, object: Group) {
    if (this.get(id) !== object) this.revision++;
    return super.set(id, object);
  }
  override delete(id: string) {
    const removed = super.delete(id);
    if (removed) this.revision++;
    return removed;
  }
  override clear() { if (this.size) this.revision++; super.clear(); }
}
