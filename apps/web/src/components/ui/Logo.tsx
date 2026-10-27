/** Logótipo KIVORA: marca "K" (SVG) e nome. Decorativo dentro de ligações com nome acessível. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo-lockup ${className}`.trim()}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="lkBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#175bff" />
            <stop offset="1" stopColor="#0d42ca" />
          </linearGradient>
        </defs>
        <rect width="34" height="34" rx="10" fill="url(#lkBg)" />
        <path d="M11 8v18M11 17l10-9M14.5 15l8.5 11" stroke="#ffd447" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="logo-lockup__name">KIVORA</span>
    </span>
  );
}
