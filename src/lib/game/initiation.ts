import { JOURNEY_STEPS, STEPS_PER_LEVEL } from "../config";
import type { ActionKind } from "../data/types";

/** Training lives entirely outside the real journal and never grants rewards. */
export const INITIATION_KEY = "chomage:welcome:rites-v2";
export const DRAGON_RITE_LANES = [0, 2, 1, 0] as const;
export const DRAGON_RITE = { heroX: 23, startX: 105, speed: 26 } as const;
export interface DragonLessonRun {
  lane: number;
  ringX: number;
  collected: number;
  misses: number;
  status: "ready" | "flying" | "done";
}
export function createDragonLesson(): DragonLessonRun {
  return { lane: 1, ringX: DRAGON_RITE.startX, collected: 0, misses: 0, status: "ready" };
}
export function steerDragonLesson(run: DragonLessonRun, direction: number): void {
  if (run.status !== "flying" || !Number.isFinite(direction)) return;
  run.lane = Math.max(0, Math.min(2, run.lane + Math.sign(direction)));
}
export function advanceDragonLesson(run: DragonLessonRun, elapsed: number): void {
  if (run.status !== "flying" || !Number.isFinite(elapsed)) return;
  const before = run.ringX;
  run.ringX -= Math.max(0, Math.min(0.1, elapsed)) * DRAGON_RITE.speed;
  if (before > DRAGON_RITE.heroX && run.ringX <= DRAGON_RITE.heroX) {
    if (run.lane === DRAGON_RITE_LANES[run.collected]) run.collected++;
    else run.misses++;
    // A missed ring returns. No timer, lives, score or way to lose this rite.
    run.ringX = DRAGON_RITE.startX;
    if (run.collected >= DRAGON_RITE_LANES.length) run.status = "done";
  }
}

export const INITIATION_ENCOUNTERS = [
  { kind: "candidature", title: "Le parchemin du destin", prompt: "Ton CV part chez Gobelin & Fils. Que déclares-tu ?", response: "Une candidature. Le voyage commence !" },
  { kind: "refus", title: "Le hibou du refus", prompt: "« Votre profil ne convient pas. » Le hibou repart, très fier de lui.", response: "Un refus fait avancer. Même une porte fermée nourrit ta légende." },
  { kind: "entretien", title: "Face au dragon RH", prompt: "On te convoque à un entretien. Le dragon a même réservé une chaise.", response: "Tu recules de trois pas : tu te rapproches de l’emploi !" },
  { kind: "rejetApresEntretien", title: "Le retour de la poisse", prompt: "Après l’entretien : « Nous avons retenu un autre aventurier. »", response: "Un rejet après entretien vaut six pas. La poisse mérite du panache." },
] as const;
export const INITIATION_ACTIONS = [
  { kind: "candidature", label: "Candidature" },
  { kind: "refus", label: "Refus" },
  { kind: "entretien", label: "Entretien" },
  { kind: "rejetApresEntretien", label: "Rejet après entretien" },
] as const;
export const INITIATION_START_STEPS = STEPS_PER_LEVEL - INITIATION_ENCOUNTERS.reduce((sum, encounter) => sum + JOURNEY_STEPS[encounter.kind], 0);
export function initiationSteps(encounters: number): number {
  return INITIATION_ENCOUNTERS.slice(0, Math.max(0, Math.min(INITIATION_ENCOUNTERS.length, Math.floor(encounters))))
    .reduce((sum, encounter) => sum + JOURNEY_STEPS[encounter.kind], INITIATION_START_STEPS);
}
export function answerInitiation(encounter: number, kind: ActionKind): boolean {
  return INITIATION_ENCOUNTERS[encounter]?.kind === kind;
}

export interface InitiationProgress {
  stage: 0 | 1 | 2;
  dragonDone: boolean;
  encounters: number;
  chestOpen: boolean;
  powerCast: boolean;
  crownDone: boolean;
}
export function createInitiationProgress(): InitiationProgress {
  return { stage: 0, dragonDone: false, encounters: 0, chestOpen: false, powerCast: false, crownDone: false };
}
export function initiationStorageKey(scope?: string): string {
  return scope ? `${INITIATION_KEY}:${encodeURIComponent(scope)}` : INITIATION_KEY;
}
/** Storage can be stale or manually edited. Do not skip an unfinished rite. */
export function parseInitiationProgress(raw: string | null): InitiationProgress {
  const fresh = createInitiationProgress();
  if (!raw) return fresh;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return fresh;
    const candidate = value as Record<string, unknown>;
    const dragonDone = candidate.dragonDone === true;
    const encounters = typeof candidate.encounters === "number" && Number.isFinite(candidate.encounters)
      ? Math.max(0, Math.min(INITIATION_ENCOUNTERS.length, Math.floor(candidate.encounters))) : 0;
    const stage = !dragonDone ? 0 : candidate.stage === 2 && encounters === INITIATION_ENCOUNTERS.length ? 2 : candidate.stage === 1 || candidate.stage === 2 ? 1 : 0;
    const chestOpen = stage === 2 && candidate.chestOpen === true;
    const powerCast = chestOpen && candidate.powerCast === true;
    return { stage, dragonDone, encounters, chestOpen, powerCast, crownDone: powerCast && candidate.crownDone === true };
  } catch { return fresh; }
}
