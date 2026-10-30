import messages from "./messages.json" with { type: "json" };
import overrides from "./overrides.json" with { type: "json" };

export const LANGUAGES = ["fr", "de", "en", "es", "it"] as const;
export type Locale = typeof LANGUAGES[number];
export const LANGUAGE_KEY = "louchomage:language:v1";
export const LANGUAGE_NAMES: Record<Locale, string> = { fr: "Français", de: "Deutsch", en: "English", es: "Español", it: "Italiano" };
const indexes = { en: 0, de: 1, es: 2, it: 3 } as const;
const catalog = { ...messages, ...overrides } as Record<string, readonly string[]>;
let current: Locale = "fr";
let loaded = false;
const listeners = new Set<() => void>();
export function isLocale(value: unknown): value is Locale { return LANGUAGES.includes(value as Locale); }
export function getLocale(): Locale {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try { const saved = window.localStorage.getItem(LANGUAGE_KEY); if (isLocale(saved)) current = saved; } catch { /* The visit still works. */ }
  }
  return current;
}
export function hasChosenLanguage() {
  if (typeof window === "undefined") return false;
  try { return isLocale(window.localStorage.getItem(LANGUAGE_KEY)); } catch { return false; }
}
export function setLocale(locale: Locale) {
  current = locale; loaded = true;
  try { window.localStorage.setItem(LANGUAGE_KEY, locale); } catch { /* Keep the selection in memory. */ }
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  listeners.forEach(listener => listener());
}
export function subscribeLocale(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const localeTag = (locale = getLocale()) => ({ fr: "fr-CH", de: "de-CH", en: "en-GB", es: "es-ES", it: "it-CH" })[locale];
const templates = Object.keys(catalog).filter(key => /\{\d+\}/.test(key)).sort((a, b) => b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length).map(key => {
  const order: number[] = [];
  const pattern = key.split(/(\{\d+\})/).map(part => {
    if (/^\{\d+\}$/.test(part)) { order.push(Number(part.slice(1, -1))); return "([\\s\\S]*?)"; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { key, order, pattern: new RegExp(`^${pattern}$`) };
});
// Plurals are presentation only; legacy French suffix parameters stay out of saves.
const plurals: Record<string, readonly (readonly [string, string])[]> = {
  "{0} pas": [["{0} step", "{0} steps"], ["{0} Schritt", "{0} Schritte"], ["{0} paso", "{0} pasos"], ["{0} passo", "{0} passi"]],
  "+{0} pas": [["+{0} step", "+{0} steps"], ["+{0} Schritt", "+{0} Schritte"], ["+{0} paso", "+{0} pasos"], ["+{0} passo", "+{0} passi"]],
  "Encore {0} mot{1}": [["{0} word left", "{0} words left"], ["Noch {0} Wort", "Noch {0} Wörter"], ["Queda {0} palabra", "Quedan {0} palabras"], ["Resta {0} parola", "Restano {0} parole"]],
  "Encore {0} tour{1}": [["{0} tower left", "{0} towers left"], ["Noch {0} Turm", "Noch {0} Türme"], ["Queda {0} torre", "Quedan {0} torres"], ["Resta {0} torre", "Restano {0} torri"]],
  "{0} shot{1} à boire": [["{0} shot to drink", "{0} shots to drink"], ["{0} Shot noch zu trinken", "{0} Shots noch zu trinken"], ["{0} chupito por beber", "{0} chupitos por beber"], ["{0} shottino da bere", "{0} shottini da bere"]],
};
const rendered = new Map<string, string>();
/** Pass user names as parameters; translate presentation, never saved data or rule IDs. */
export function t<T>(source: T, values?: readonly unknown[], locale = getLocale()): T {
  if (typeof source !== "string") return source;
  let key = source.trim().replace(/\s+/g, " ");
  let entry = catalog[key];
  let parameters = values;
  if (locale !== "fr" && !entry && !values) {
    const cached = rendered.get(`${locale}:${key}`);
    if (cached !== undefined) return (source.slice(0, source.length - source.trimStart().length) + cached + source.slice(source.trimEnd().length)) as T;
    for (const template of templates) {
      const match = template.pattern.exec(key);
      if (!match) continue;
      const captured: string[] = [];
      template.order.forEach((index, offset) => { captured[index] = match[offset + 1]; });
      key = template.key; entry = catalog[key]; parameters = captured; break;
    }
  }
  let result = locale !== "fr" && entry ? entry[indexes[locale]] : key;
  if (locale !== "fr" && plurals[key] && parameters) result = plurals[key][indexes[locale]][Number(parameters[0]) === 1 ? 0 : 1];
  if (parameters) result = result.replace(/\{(\d+)\}/g, (_, index) => String(parameters[Number(index)] ?? ""));
  if (!values && locale !== "fr") { if (rendered.size > 512) rendered.clear(); rendered.set(`${locale}:${source.trim().replace(/\s+/g, " ")}`, result); }
  return (source.slice(0, source.length - source.trimStart().length) + result + source.slice(source.trimEnd().length)) as T;
}
