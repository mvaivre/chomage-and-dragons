import { SEASON } from "@/lib/config";

const START = new Date(SEASON.start).getTime();
const END = new Date(SEASON.end).getTime();

/** Avancement de la saison, borné à [0, 1]. */
export function seasonProgress(now: Date = new Date()): number {
  const ratio = (now.getTime() - START) / (END - START);
  return Math.min(1, Math.max(0, ratio));
}

export function daysUntilDeadline(now: Date = new Date()): number {
  return Math.max(0, Math.ceil((END - now.getTime()) / 86_400_000));
}

export type Season = "printemps" | "ete" | "automne" | "hiver";

/**
 * Saison météo pour l'ambiance du décor, calculée dans le fuseau de référence
 * et non celui du navigateur.
 */
export function weatherSeason(now: Date = new Date()): Season {
  const month = Number(
    new Intl.DateTimeFormat("fr-CH", {
      timeZone: SEASON.timeZone,
      month: "numeric",
    }).format(now),
  );
  if (month >= 3 && month <= 5) return "printemps";
  if (month >= 6 && month <= 8) return "ete";
  if (month >= 9 && month <= 11) return "automne";
  return "hiver";
}
