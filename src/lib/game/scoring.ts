import { APPLICATIONS_PER_LEVEL, POINTS } from "@/lib/config";
import type { ActionKind } from "@/lib/data/types";

export function pointsFor(kind: ActionKind): number {
  return POINTS[kind];
}

/** Niveau 1 = 0–9 candidatures, niveau 2 = 10–19, etc. */
export function levelFromApplications(applications: number): number {
  return Math.floor(applications / APPLICATIONS_PER_LEVEL) + 1;
}

/** Candidatures restantes avant le prochain coffre. */
export function untilNextChest(applications: number): number {
  return APPLICATIONS_PER_LEVEL - (applications % APPLICATIONS_PER_LEVEL);
}
