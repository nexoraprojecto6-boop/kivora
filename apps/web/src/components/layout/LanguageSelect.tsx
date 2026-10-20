import { useI18n } from "../../i18n/I18nProvider.js";
import { SUPPORTED_LANGUAGES, isLanguageCode } from "../../i18n/resources.js";

export function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="language-select">
      <label htmlFor="language-select" className="visually-hidden">{t("common.language.select")}</label>
      <select
        id="language-select"
        value={language}
        onChange={(e) => {
          if (isLanguageCode(e.target.value)) setLanguage(e.target.value);
        }}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
