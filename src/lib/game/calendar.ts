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

/**
 * Les mois de la saison déjà commencés, du plus récent au plus ancien, mois en cours
 * compris dès le 1er. Tout est compté en clés de Zurich : la saison commence à minuit
 * le 1er janvier à Zurich, soit le 31 décembre en UTC.
 */
export function seasonMonthKeys(current: string = currentMonthKey()): string[] {
  const first = monthKey(new Date(SEASON.start));
  const last = monthKey(new Date(Date.parse(SEASON.end) - 1));
  const keys: string[] = [];
  let [year, month] = first.split("-").map(Number);
  for (let key = first; key <= last && key <= current;) {
    keys.push(key);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    key = `${year}-${String(month).padStart(2, "0")}`;
  }
  return keys.reverse();
}
