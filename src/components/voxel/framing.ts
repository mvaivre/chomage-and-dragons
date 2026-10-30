/** Keep the look-at point at the centre of the usable game area, at every zoom.
 * Orthographic extents are divided by zoom, including their off-centre shift. */
export function roadFrustum(width: number, height: number, zoom: number, topInset: number, bottomInset: number) {
  const aspect = width / height, halfW = aspect < .8 ? 8.5 : Math.max(13, 9.4 * aspect), halfH = halfW / aspect;
  const offset = (topInset - bottomInset) / height * halfH / zoom;
  return { left: -halfW, right: halfW, top: halfH + offset, bottom: -halfH + offset };
}

export const MINIATURE_CAMERA_DISTANCE = 64;
/** Free exploration retains the visible framing until the player is followed again.
 * Explicit wheel, pinch and button zoom remain relative to that captured scale. */
export class ExplorationZoom {
  private scale: number | null = null;
  resolve(exploring: boolean, manualZoom: number, currentZoom: number, automaticZoom: number) {
    if (!exploring) { this.scale = null; return automaticZoom; }
    this.scale ??= currentZoom / manualZoom;
    return manualZoom * this.scale;
  }
}
/** Telephoto perspective keeps the miniature composition, with a real vanishing
 * point. A view offset places the focus at the usable screen centre at any zoom. */
export function frameRoadPerspective(camera: import("three").PerspectiveCamera, width: number, height: number, zoom: number, topInset: number, bottomInset: number) {
  const frame = roadFrustum(width, height, zoom, topInset, bottomInset);
  const halfH = (frame.top - frame.bottom) / 2;
  camera.aspect = width / height;
  camera.fov = Math.atan(halfH / MINIATURE_CAMERA_DISTANCE) * 360 / Math.PI;
  camera.zoom = zoom;
  camera.setViewOffset(width, height, 0, (bottomInset - topInset) / 2, width, height);
}
