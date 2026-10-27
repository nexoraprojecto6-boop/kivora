import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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

/** Campo de palavra-passe com um pequeno olho dentro do campo (mostrar/esconder). */
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
        <button
          type="button"
          className="field__eye"
          aria-label={visible ? t("common.actions.hidePassword") : t("common.actions.showPassword")}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
    />
  );
}
