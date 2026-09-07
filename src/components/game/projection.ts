/** Project a world point around the viewport centre, consistently for drawing and culling. */
export function parallaxX(worldX: number, cameraX: number, viewWidth: number, factor: number): number {
  return (worldX - cameraX - viewWidth / 2) * factor + viewWidth / 2;
}

/** A repeated strip needs only its visible tiles and one spare tile at each end. */
export function visibleTiles(cameraX: number, viewWidth: number, tileWidth: number, origin: number): [number, number] {
  return [
    Math.floor((cameraX - origin) / tileWidth) - 1,
    Math.floor((cameraX + viewWidth - origin) / tileWidth) + 1,
  ];
}

/** Bound the framebuffer independently of CSS size on retina and ultrawide displays. */
export function renderResolution(width: number, height: number, deviceRatio: number): number {
  const deviceCap = width <= 760 ? 1.5 : 2;
  return Math.min(deviceRatio, deviceCap, Math.sqrt(3_000_000 / Math.max(1, width * height)));
}

/** Every chest uses this position, including rewards earned after the finish. */
export function chestXForStep(step: number, worldLength: number, journeyTarget: number): number {
  return Math.max(0, step) / journeyTarget * worldLength + 110;
}

/** Keep the hero inside the clear window between the HUD and the action dock. */
export function frameComposition(width: number, height: number, topInset: number, bottomInset: number, groundY: number) {
  const aspect = width / height;
  const compositionWidth = aspect < 0.75 ? 520 : aspect < 1.35 ? 960 : 1280;
  const dockTop = height - bottomInset;
  const available = Math.max(0, dockTop - topInset);
  const scale = Math.min(width / compositionWidth, height / 640, Math.max(0.15, (available - 24) / 320));
  // Lane depth (48), name plate (38) and a physical gutter all remain visible.
  const clearance = 104 * scale + 12;
  const groundScreenY = Math.min(dockTop - clearance, topInset + available * 0.80);
  return { scale, screenOffsetY: groundScreenY - groundY * scale };
}
