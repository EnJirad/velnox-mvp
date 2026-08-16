import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  isLanguage,
  languageLabel,
  type Language,
} from "./config";
import { translations } from "./locales";

export type TranslateVars = Record<string, string | number>;

export interface TranslateFn {
  (key: string, vars?: TranslateVars): string;
}

export interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // storage unavailable — fall through to default
  }
  return DEFAULT_LANGUAGE;
}

/** Dot-path lookup with safe traversal. */
function resolvePath(
  dict: Record<string, unknown> | undefined,
  path: string,
): string | undefined {
  if (!dict) return undefined;
  let node: unknown = dict;
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(raw: string, vars?: TranslateVars): string {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Build a t() for a language. Missing keys fall back to Thai, then to the key
 * itself (never "undefined", never a crash). Missing keys are logged once in
 * development so gaps are caught early.
 */
function makeT(lang: Language): TranslateFn {
  const warned = new Set<string>();
  return (key, vars) => {
    const raw =
      resolvePath(translations[lang], key) ??
      resolvePath(translations[DEFAULT_LANGUAGE], key) ??
      key;
    if (raw === key && !warned.has(key)) {
      warned.add(key);
      if (import.meta.env.DEV) {
        console.warn(`[i18n] missing translation key: ${key}`);
      }
    }
    return interpolate(raw, vars);
  };
}

const fallbackT: TranslateFn = makeT(DEFAULT_LANGUAGE);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStoredLanguage);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // storage unavailable — in-memory only
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {
      // non-browser environment
    }
  }, [lang]);

  const t = useMemo(() => makeT(lang), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Access the active language + t(). Safe outside a provider (e.g. shared
 * components rendered by other apps): falls back to Thai with a no-op setter.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: DEFAULT_LANGUAGE, setLang: () => {}, t: fallbackT };
  return ctx;
}

export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, languageLabel };
export type { Language };
