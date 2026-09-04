"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { dictionaries, type TranslationKey } from "@/lib/i18n/dictionaries"

export type Lang = "th" | "en"

const STORAGE_KEY = "lang"
const DEFAULT_LANG: Lang = "th"

type Interp = Record<string, string | number>

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  toggle: () => void
  /** Translate a UI-chrome key. Falls back to the Thai string, then the key itself. */
  t: (key: TranslationKey, vars?: Interp) => string
  /** Choose a backend bilingual field: EN mode prefers the English value, TH mode the Thai. */
  pick: (thValue?: string | null, enValue?: string | null) => string
  /** BCP-47 locale for Intl formatters (dates, currency). */
  locale: "th-TH" | "en-US"
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function isLang(v: unknown): v is Lang {
  return v === "th" || v === "en"
}

function applyVars(str: string, vars?: Interp): string {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)

  // Hydrate from localStorage after mount (server render is always DEFAULT_LANG,
  // so first client paint matches — see the "first-paint flash" note in the plan).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isLang(saved) && saved !== lang) setLangState(saved)
    } catch (err) {
      console.error("Failed to read stored language:", err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist + reflect on <html lang>.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch (err) {
      console.error("Failed to persist language:", err)
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggle = useCallback(
    () => setLangState((prev) => (prev === "th" ? "en" : "th")),
    []
  )

  const t = useCallback(
    (key: TranslationKey, vars?: Interp) => {
      const table = dictionaries[lang] as Record<string, string>
      const value = table[key] ?? dictionaries.th[key] ?? key
      return applyVars(value, vars)
    },
    [lang]
  )

  const pick = useCallback(
    (thValue?: string | null, enValue?: string | null) => {
      const th = thValue ?? ""
      const en = enValue ?? ""
      return lang === "en" ? en || th : th || en
    },
    [lang]
  )

  const locale = lang === "th" ? "th-TH" : "en-US"

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t, pick, locale }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLang must be used within LanguageProvider")
  return ctx
}
