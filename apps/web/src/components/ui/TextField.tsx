import type { InputHTMLAttributes, ReactNode } from "react";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  trailing?: ReactNode;
}

export function TextField({ id, label, error, hint, trailing, ...input }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <div className="field__control">
        <input
          {...input}
          id={id}
          className={error ? "field__input field__input--error" : "field__input"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {trailing}
      </div>
      {hint ? <p id={hintId} className="field__hint">{hint}</p> : null}
      {error ? (
        <p id={errorId} className="field__error">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
