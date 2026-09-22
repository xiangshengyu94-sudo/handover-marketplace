export const SUPPORTED_LOCALES = ["en", "pl", "it", "de", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "handover-locale";

export const LOCALE_OPTIONS: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "pl", label: "Polski" },
  { value: "it", label: "Italiano" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
];

export const FORMAT_LOCALES: Record<Locale, string> = {
  en: "en-GB",
  pl: "pl-PL",
  it: "it-IT",
  de: "de-DE",
  es: "es-ES",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
