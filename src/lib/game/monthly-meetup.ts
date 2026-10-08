import { monthKey } from "@/lib/game/calendar";

/** All rendez-vous use the same calendar as the monthly crown. */
export const MEETUP_TIME_ZONE = "Europe/Zurich";
const LOCAL_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: MEETUP_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const DATE_FORMAT = new Intl.DateTimeFormat("fr-CH", {
  timeZone: MEETUP_TIME_ZONE,
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const MONTH_PATTERN = /^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isMeetupMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

export function shiftMeetupMonth(key: string, shift: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + shift, 15, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A datetime-local value in Zurich, independent of the device's timezone. */
export function zurichDateTimeInput(date: Date): string {
  const parts = LOCAL_FORMAT.formatToParts(date);
  const get = (kind: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === kind)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Convert wall-clock time to an instant. Offset candidates are taken on either
 * side of the date so both sides of a DST switch are checked. Nonexistent and
 * ambiguous clock times are refused: an appointment must have one meaning.
 */
export function zurichInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const guess = Date.parse(`${value}:00.000Z`);
  if (!Number.isFinite(guess) || new Date(guess).toISOString().slice(0, 16) !== value) return null;
  const offsets = new Set<number>();
  for (const delta of [-36, 0, 36]) {
    const sample = guess + delta * 3_600_000;
    const wall = Date.parse(`${zurichDateTimeInput(new Date(sample))}:00.000Z`);
    offsets.add(wall - sample);
  }
  const candidates = [...offsets].map((offset) => new Date(guess - offset))
    .filter((date) => zurichDateTimeInput(date) === value);
  return candidates.length === 1 ? candidates[0].toISOString() : null;
}

/** The month closes at Zurich midnight, even when its DST offset changed. */
export function monthClosesAt(key: string): number {
  return Date.parse(zurichInputToIso(`${shiftMeetupMonth(key, 1)}-01T00:00`)!);
}

/** A month's drink may happen during the first fortnight of the next month. */
export function meetupLatestInput(key: string): string {
  return `${shiftMeetupMonth(key, 1)}-14T23:59`;
}

export function editableMeetupMonths(now: Date): string[] {
  const current = monthKey(now);
  return Number(zurichDateTimeInput(now).slice(8, 10)) <= 14
    ? [current, shiftMeetupMonth(current, -1)]
    : [current];
}

/** Shared by the optimistic reducer and the authoritative server reducer. */
export function validateMeetupInput(key: unknown, at: unknown, place: unknown, now: Date): string | null {
  if (!Number.isFinite(now.getTime()) || !isMeetupMonth(key) || !editableMeetupMonths(now).includes(key)) {
    return "Ce verre doit concerner le mois en cours ou le mois précédent jusqu’au 14.";
  }
  if (typeof at !== "string" || !ISO_PATTERN.test(at)) return "Choisis une date et une heure valides.";
  const instant = new Date(at);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== at) return "Choisis une date et une heure valides.";
  if (instant.getTime() <= now.getTime()) return "Le verre doit avoir lieu dans le futur.";
  const local = zurichDateTimeInput(instant);
  if (local < `${key}-01T00:00` || local > meetupLatestInput(key)) return "Choisis une date dans ce mois ou avant le 15 du mois suivant.";
  if (typeof place !== "string" || place.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(place)) return "Le lieu fait au maximum 80 caractères.";
  return null;
}

export function meetupDateLabel(at: string): string {
  return DATE_FORMAT.format(new Date(at));
}

export function monthCountdown(key: string, now: Date): string {
  const minutes = Math.max(0, Math.ceil((monthClosesAt(key) - now.getTime()) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  return days ? `${days} j ${hours} h` : hours ? `${hours} h ${rest} min` : `${rest} min`;
}
