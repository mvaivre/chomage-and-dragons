import { APPLICATIONS_TARGET, LEVEL_TARGET, RACE_WEIGHTS } from "@/lib/config";
import { levelFromApplications } from "./scoring";
import { seasonProgress } from "./season";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Position sur le chemin, dans [0, 1].
 *
 * Volontairement découplée du score : c'est ce qui évite qu'un leader se retrouve
 * seul à l'arrivée dès le mois de mars. Le facteur temps tire toute la caravane vers
 * la ligne d'arrivée au fil de la saison.
 */
export function racePosition(applications: number, now: Date = new Date()): number {
  const byApplications = clamp01(applications / APPLICATIONS_TARGET);
  const byTime = seasonProgress(now);
  const byLevel = clamp01(levelFromApplications(applications) / LEVEL_TARGET);

  return clamp01(
    byApplications * RACE_WEIGHTS.applications +
      byTime * RACE_WEIGHTS.time +
      byLevel * RACE_WEIGHTS.level,
  );
}
