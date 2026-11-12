"use client";
import { LANGUAGES, LANGUAGE_NAMES, setLocale, type Locale, t } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/react";
export function LanguagePicker({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const locale = useLocale();
  return <label className={`language-picker ${compact ? "language-picker--compact" : ""} ${className}`}>
    <span aria-hidden={compact || undefined}>{compact ? locale.toUpperCase() : t("Langue", undefined, locale)}</span>
    <select aria-label={t("Langue", undefined, locale)} value={locale} onChange={event => setLocale(event.target.value as Locale)}>
      {LANGUAGES.map(language => <option key={language} value={language} lang={language}>{LANGUAGE_NAMES[language]}</option>)}
    </select>
  </label>;
}
