import { JOURNEY_STEPS } from "../config";

/** The seen marker stays compatible; only unfinished training progress is versioned. */
export const INITIATION_KEY = "chomage:welcome:rites-v2";
export const INITIATION_EXAMPLE_STEPS = JOURNEY_STEPS.candidature;
export interface InitiationProgress {
  version: 3;
  stage: 0 | 1 | 2;
  journeyDone: boolean;
  chestOpen: boolean;
  powerCast: boolean;
}
export function createInitiationProgress(): InitiationProgress {
  return { version: 3, stage: 0, journeyDone: false, chestOpen: false, powerCast: false };
}
export function initiationStorageKey(scope?: string): string {
  return scope ? `${INITIATION_KEY}:${encodeURIComponent(scope)}` : INITIATION_KEY;
}
export function parseInitiationProgress(raw: string | null): InitiationProgress {
  const fresh = createInitiationProgress();
  if (!raw) return fresh;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 3) return fresh;
    const journeyDone = value.journeyDone === true;
    const stage = !journeyDone ? 0 : value.stage === 1 || value.stage === 2 ? value.stage : 0;
    const chestOpen = stage > 0 && value.chestOpen === true;
    const powerCast = chestOpen && value.powerCast === true;
    return { version: 3, stage: stage === 2 && !powerCast ? 1 : stage, journeyDone, chestOpen, powerCast };
  } catch { return fresh; }
}
/** Six deliberate taps, no quiz, failure, flight timer or real journal writes. */
export function advanceInitiation(value: InitiationProgress): InitiationProgress {
  if (value.stage === 0) return value.journeyDone ? { ...value, stage: 1 } : { ...value, journeyDone: true };
  if (value.stage === 1) {
    if (!value.chestOpen) return { ...value, chestOpen: true };
    if (!value.powerCast) return { ...value, powerCast: true };
    return { ...value, stage: 2 };
  }
  return value;
}
