import { SEASON } from "@/lib/config";

/**
 * Découpage du temps en mois, calculé dans le fuseau de référence et non dans celui
 * du navigateur. Sans ça, la Couronne du mois pourrait différer selon l'appareil qui
 * affiche le classement — le genre de bug qui ruine une soirée de remise de prix.
 */

const KEY_FORMAT = new Intl.DateTimeFormat("fr-CH", {
  timeZone: SEASON.timeZone,
  year: "numeric",
  month: "2-digit",
});

const LABEL_FORMAT = new Intl.DateTimeFormat("fr-CH", {
  timeZone: SEASON.timeZone,
  year: "numeric",
  month: "long",
});

/** Clé triable, par exemple « 2026-08 ». */
export function monthKey(date: Date): string {
  const parts = KEY_FORMAT.formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  // Milieu de mois en UTC : évite qu'un décalage de fuseau ne fasse basculer le libellé.
  return LABEL_FORMAT.format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

/** Les mois de la saison déjà commencés, du plus récent au plus ancien. */
export function seasonMonthKeys(now: Date = new Date()): string[] {
  const start = new Date(SEASON.start);
  const end = new Date(SEASON.end);
  const keys: string[] = [];

  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 15, 12),
  );

  while (cursor < end && cursor <= now) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys.reverse();
}
