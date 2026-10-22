/** Stable budgets: phones skip postprocessing before their first frame. */
export const QUALITY = [
  { name: "high", bloom: true, dpr: 1.5, pixels: 1_400_000, shadowSize: 1024, shadowHz: 8, lights: 4 },
  { name: "balanced", bloom: false, dpr: 1, pixels: 700_000, shadowSize: 0, shadowHz: 0, lights: 2 },
  { name: "low", bloom: false, dpr: 0.85, pixels: 450_000, shadowSize: 0, shadowHz: 0, lights: 2 },
] as const;
export function deviceQuality(width: number, coarse: boolean, cores: number, memory = 8) {
  return width <= 760 || coarse || cores <= 4 || memory <= 4 ? 1 : 0;
}
/** Hysteresis: ignore loading spikes; only sustained slow rendering lowers quality. */
export class QualityGovernor {
  level = 0;
  private slow = 0;
  sample(milliseconds: number, eligible: boolean) {
    if (!eligible) return false;
    this.slow = milliseconds > 48 ? this.slow + Math.min(milliseconds, 250) : Math.max(0, this.slow - milliseconds * 2);
    if (this.slow < 2000 || this.level >= 2) return false;
    this.level++;
    this.slow = 0;
    return true;
  }
}
