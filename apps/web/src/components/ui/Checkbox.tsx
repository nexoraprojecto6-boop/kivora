interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | undefined;
}

export function Checkbox({ id, label, checked, onChange, error }: CheckboxProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="checkbox">
      <div className="checkbox__row">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        />
        <label htmlFor={id}>{label}</label>
      </div>
      {error ? (
        <p id={errorId} className="field__error">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
