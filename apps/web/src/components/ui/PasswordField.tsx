import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider.js";
import { TextField } from "./TextField.js";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string | undefined;
  error?: string | undefined;
}

/** Campo de palavra-passe com botão de mostrar/esconder. */
export function PasswordField({ id, label, value, onChange, autoComplete, hint, error }: PasswordFieldProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      id={id}
      label={label}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      hint={hint}
      error={error}
      trailing={
        <button type="button" className="field__toggle" aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
          {visible ? t("common.actions.hidePassword") : t("common.actions.showPassword")}
        </button>
      }
    />
  );
}
