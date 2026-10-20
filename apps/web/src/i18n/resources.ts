import languages from "./config/languages.json";
import ptCommon from "./pt/common.json";
import ptAuth from "./pt/auth.json";
import ptDashboard from "./pt/dashboard.json";
import enCommon from "./en/common.json";
import enAuth from "./en/auth.json";
import enDashboard from "./en/dashboard.json";
import frCommon from "./fr/common.json";
import frAuth from "./fr/auth.json";
import frDashboard from "./fr/dashboard.json";
import esCommon from "./es/common.json";
import esAuth from "./es/auth.json";
import esDashboard from "./es/dashboard.json";

export type LanguageCode = "pt" | "en" | "fr" | "es";

export const DEFAULT_LANGUAGE: LanguageCode = languages.defaultLanguage as LanguageCode;
export const SUPPORTED_LANGUAGES = languages.supportedLanguages as ReadonlyArray<{
  code: LanguageCode;
  name: string;
}>;

type Namespaces = { common: unknown; auth: unknown; dashboard: unknown };

export const RESOURCES: Record<LanguageCode, Namespaces> = {
  pt: { common: ptCommon, auth: ptAuth, dashboard: ptDashboard },
  en: { common: enCommon, auth: enAuth, dashboard: enDashboard },
  fr: { common: frCommon, auth: frAuth, dashboard: frDashboard },
  es: { common: esCommon, auth: esAuth, dashboard: esDashboard },
};

export function isLanguageCode(value: unknown): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === value);
}
