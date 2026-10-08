import { seedFrom } from "@/lib/game/random";

/** The same joke follows an attempt on every device. No personal data in the draw. */
export const PUNCHLINES = [
  "Tu as l’aura d’un vieux mégot mouillé.",
  "Même une chaise aurait mieux géré ça.",
  "Tu es la preuve que l’évolution a ses limites.",
  "Ton cerveau est actuellement en erreur 404.",
  "Tu as le charisme d’une déclaration d’impôt.",
  "Tu es remarquablement mauvais·e à cette activité.",
  "On dirait que tu as été dessiné·e avec la main gauche.",
  "Ton potentiel est actuellement porté disparu.",
  "Tu es un échec avec des jambes.",
  "J’ai rencontré des cailloux plus dynamiques.",
  "Ton aura vient de démissionner.",
  "Tu as exactement l’énergie d’un lundi à 7 h 12.",
  "Même ton ombre veut changer de groupe.",
  "Ton plan avait besoin d’un plan.",
  "Tu es le brouillon d’un personnage secondaire.",
  "J’ai vu des pommes de terre avec plus d’ambition.",
  "Tu as perdu une bataille contre ton propre réveil.",
  "Ton existence manque cruellement de mise en page.",
  "Tu es le genre de personne qui rate un tutoriel.",
  "Tu as été béni·e par les dieux de la médiocrité.",
  "Quelle énergie de figurant.",
  "Tu es une side quest qui dure depuis trois ans.",
  "Même ton personnage n’a pas confiance en toi.",
  "Tu as l’air d’avoir été invoqué·e par erreur.",
] as const;

export function punchlineFor(seed: string): string {
  return PUNCHLINES[seedFrom(`punchline:${seed}`) % PUNCHLINES.length];
}

/** Rotates the whole bank without repeats for one resident. */
export function residentPunchline(kind: string, visit: number): string {
  return PUNCHLINES[(seedFrom(kind) + Math.max(0, Math.floor(visit))) % PUNCHLINES.length];
}
