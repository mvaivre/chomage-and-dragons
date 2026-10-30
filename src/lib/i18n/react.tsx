"use client";
import { useEffect, useSyncExternalStore } from "react";
import { getLocale, subscribeLocale } from "./index";
export function useLocale() { return useSyncExternalStore(subscribeLocale, getLocale, () => "fr" as const); }
export function LanguageSession() {
  const locale = useLocale();
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return null;
}
