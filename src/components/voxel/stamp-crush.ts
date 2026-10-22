import { reactionTiming, type Effect } from "./reactions";

export const STAMP_RELEASE = 2.75;
export function hasStampCrush(effect: Pick<Effect, "kind" | "stampCrush">) {
  return effect.kind === "legendary" || effect.stampCrush === true;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
/** Shared clock for the stamp's underside and the hero's squash; feet are the pivot. */
export function stampCrushPose(elapsed: number, reducedMotion = false) {
  const impact = reactionTiming("legendary").impact / 1000;
  if (reducedMotion || elapsed >= reactionTiming("legendary").duration / 1000)
    return {
      x: 1,
      y: 1,
      z: 1,
      hop: 0,
      wobble: 0,
      stampLift: 8,
      stampVisible: false,
      pressed: false,
    };
  if (elapsed <= STAMP_RELEASE) {
    const squash = smooth((elapsed - impact + 0.14) / 0.14);
    const descent = clamp(elapsed / impact);
    return {
      x: 1 + squash * 2.2,
      y: 1 - squash * 0.925,
      z: 1 + squash * 2.1,
      hop: 0,
      wobble: 0,
      stampLift: 7 * (1 - descent * descent),
      stampVisible: true,
      pressed: elapsed >= impact,
    };
  }
  const t = elapsed - STAMP_RELEASE;
  // Brief anticipation, an over-stretched pop, then two diminishing jelly wobbles.
  const rise = clamp((t - 0.09) / 0.24);
  const back = rise - 1;
  const spring = 1 + 5 * back ** 3 + 4 * back ** 2;
  const settle = Math.max(0, t - 0.33);
  const ringing =
    rise >= 1 ? Math.sin(settle * 21) * Math.exp(-settle * 8) * 0.2 : 0;
  const y = rise < 1 ? 0.075 + spring * 0.925 : 1 + ringing;
  const spread = y < 1 ? (1 - y) / 0.925 : (1 - y) * 0.3;
  return {
    x: 1 + spread * 2.2,
    y,
    z: 1 + spread * 2.1,
    hop: 0.2 * Math.sin(clamp((t - 0.12) / 0.45) * Math.PI),
    wobble: Math.sin(t * 24) * Math.exp(-t * 5) * 0.13,
    stampLift: smooth(t / 0.28) * 8,
    stampVisible: t < 0.32,
    pressed: false,
  };
}
