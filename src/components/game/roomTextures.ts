import { Texture, type Container, type Sprite, type TextureSource } from "pixi.js";

/** Snapshot shared texture sources, never display objects that may unmount during a fade. */
export function roomTextures(roots: readonly Container[]): TextureSource[] {
  const sources = new Set<TextureSource>();
  const visit = (node: Container) => {
    if (node.destroyed) return;
    const texture = (node as Sprite).texture;
    if (texture instanceof Texture && !texture.destroyed && !texture.source.destroyed) sources.add(texture.source);
    for (const child of node.children) visit(child);
  };
  for (const root of roots) visit(root);
  return [...sources];
}
