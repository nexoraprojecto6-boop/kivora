import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}

/** Filtro por estado (separadores). `value` vazio = todos. */
export function FilterTabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; count?: number }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          className={`tabs__tab${value === o.value ? " is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className="tabs__count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
