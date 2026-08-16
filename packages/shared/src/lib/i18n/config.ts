/**
 * VelShop language configuration — the single source of truth for supported
 * languages. Add a new language here (plus a locale file in ./locales) and
 * the whole app picks it up; nothing else hardcodes language codes.
 */
export const SUPPORTED_LANGUAGES = [
  { code: "th", label: "ภาษาไทย" },
  { code: "en", label: "English" },
  { code: "my", label: "မြန်မာ" },
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number]["code"];

/** Thai is the default VelShop language (browser locale is NOT auto-detected). */
export const DEFAULT_LANGUAGE: Language = "th";

export const LANGUAGE_STORAGE_KEY = "velnox.shop.language";

export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.some((l) => l.code === value);
}

/** Human-readable label for a language code (native name). */
export function languageLabel(lang: Language): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.label ?? DEFAULT_LANGUAGE;
}
