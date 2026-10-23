import languages from "./config/languages.json";
import ptCommon from "./pt/common.json";
import ptAuth from "./pt/auth.json";
import ptDashboard from "./pt/dashboard.json";
import ptAccount from "./pt/account.json";
import ptDash from "./pt/dash.json";
import enCommon from "./en/common.json";
import enAuth from "./en/auth.json";
import enDashboard from "./en/dashboard.json";
import enAccount from "./en/account.json";
import enDash from "./en/dash.json";
import frCommon from "./fr/common.json";
import frAuth from "./fr/auth.json";
import frDashboard from "./fr/dashboard.json";
import frAccount from "./fr/account.json";
import frDash from "./fr/dash.json";
import esCommon from "./es/common.json";
import esAuth from "./es/auth.json";
import esDashboard from "./es/dashboard.json";
import esAccount from "./es/account.json";
import esDash from "./es/dash.json";

export type LanguageCode = "pt" | "en" | "fr" | "es";

export const DEFAULT_LANGUAGE: LanguageCode = languages.defaultLanguage as LanguageCode;
export const SUPPORTED_LANGUAGES = languages.supportedLanguages as ReadonlyArray<{
  code: LanguageCode;
  name: string;
}>;

type Namespaces = { common: unknown; auth: unknown; dashboard: unknown; account: unknown; dash: unknown };

export const RESOURCES: Record<LanguageCode, Namespaces> = {
  pt: { common: ptCommon, auth: ptAuth, dashboard: ptDashboard, account: ptAccount, dash: ptDash },
  en: { common: enCommon, auth: enAuth, dashboard: enDashboard, account: enAccount, dash: enDash },
  fr: { common: frCommon, auth: frAuth, dashboard: frDashboard, account: frAccount, dash: frDash },
  es: { common: esCommon, auth: esAuth, dashboard: esDashboard, account: esAccount, dash: esDash },
};

export function isLanguageCode(value: unknown): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === value);
}
