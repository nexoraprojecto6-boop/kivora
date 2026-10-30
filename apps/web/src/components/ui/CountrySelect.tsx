import { useMemo } from "react";
import { countryOptions } from "../../data/countries.js";
import { useI18n } from "../../i18n/I18nProvider.js";

interface CountrySelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
  commonLabel: string;
  allLabel: string;
  hint?: string | undefined;
  error?: string | undefined;
}

/** Lista de países com o nome por extenso (o valor enviado continua a ser o código de 2 letras). */
export function CountrySelect({ id, label, value, onChange, placeholder, commonLabel, allLabel, hint, error }: CountrySelectProps) {
  const { language } = useI18n();
  const { common, others } = useMemo(() => countryOptions(language), [language]);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <div className="field__control field__control--select">
        <select
          id={id}
          className={error ? "field__input field__input--error" : "field__input"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          autoComplete="country"
        >
          <option value="">{placeholder}</option>
          <optgroup label={commonLabel}>
            {common.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </optgroup>
          <optgroup label={allLabel}>
            {others.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </optgroup>
        </select>
      </div>
      {hint ? <p id={hintId} className="field__hint">{hint}</p> : null}
      {error ? <p id={errorId} className="field__error"><span aria-hidden="true">⚠ </span>{error}</p> : null}
    </div>
  );
}
