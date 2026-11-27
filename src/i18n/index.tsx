"use client";

import React, { createContext, useContext, useState } from "react";
import { en } from "./en";
import { id } from "./id";

export type Locale = "en" | "id";

const dictionaries = { en, id } as const;

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: typeof en | typeof id;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

/**
 * Bilingual locale provider persisting selection via SSR cookie.
 */
export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: dictionaries[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
