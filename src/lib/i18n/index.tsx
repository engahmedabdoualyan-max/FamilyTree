"use client";

import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import en, { type Dict } from "./en";
import ar from "./ar";

export type Locale = "en" | "ar";

const dictionaries: Record<Locale, Dict> = { en, ar };

function subscribe(callback: () => void) {
  window.addEventListener("locale-change", callback);
  return () => window.removeEventListener("locale-change", callback);
}

function getSnapshot(): Locale {
  return window.localStorage.getItem("locale") === "ar" ? "ar" : "en";
}

function getServerSnapshot(): Locale {
  return "en";
}

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.documentElement.classList.toggle("font-arabic", locale === "ar");
}

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (key: keyof Dict) => string;
  setLocale: (l: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Apply stored preference to <html> on first load (no state updates needed)
  useEffect(() => {
    applyDocumentLocale(getSnapshot());
    const onChange = () => applyDocumentLocale(getSnapshot());
    window.addEventListener("locale-change", onChange);
    return () => window.removeEventListener("locale-change", onChange);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    window.localStorage.setItem("locale", l);
    applyDocumentLocale(l);
    window.dispatchEvent(new Event("locale-change"));
  }, []);

  const t = useCallback(
    (key: keyof Dict) => dictionaries[locale][key] ?? String(key),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, dir: locale === "ar" ? "rtl" : "ltr", t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
