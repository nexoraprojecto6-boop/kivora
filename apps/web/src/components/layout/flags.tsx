import { Globe } from "lucide-react";

/**
 * Bandeiras redondas desenhadas em SVG (sem ficheiros externos, funcionam com a política CSP).
 * Para usar a bandeira de Angola no português, troque "pt: \"PT\"" por "pt: \"AO\"" em FLAG_OF_LANGUAGE.
 */
type FlagCountry = "PT" | "AO" | "GB" | "FR" | "ES";

const FLAG_OF_LANGUAGE: Record<string, FlagCountry> = { pt: "PT", en: "GB", fr: "FR", es: "ES" };

function Art({ country }: { country: FlagCountry }) {
  switch (country) {
    case "PT":
      return (
        <>
          <rect width="30" height="20" fill="#da291c" />
          <rect width="12" height="20" fill="#046a38" />
          <circle cx="12" cy="10" r="4.2" fill="#ffd100" />
          <circle cx="12" cy="10" r="3" fill="#fff" />
          <rect x="10.4" y="8.2" width="3.2" height="3.6" rx="0.8" fill="#da291c" />
        </>
      );
    case "AO":
      return (
        <>
          <rect width="30" height="10" fill="#cc092f" />
          <rect y="10" width="30" height="10" fill="#000" />
          <circle cx="15" cy="10" r="4" fill="none" stroke="#ffcb00" strokeWidth="1.2" />
          <circle cx="15" cy="10" r="1.3" fill="#ffcb00" />
        </>
      );
    case "GB":
      return (
        <>
          <rect width="30" height="20" fill="#012169" />
          <path d="M0 0L30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
          <path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" strokeWidth="1.6" />
          <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6.5" />
          <path d="M15 0V20M0 10H30" stroke="#c8102e" strokeWidth="3.6" />
        </>
      );
    case "FR":
      return (
        <>
          <rect width="10" height="20" fill="#0055a4" />
          <rect x="10" width="10" height="20" fill="#fff" />
          <rect x="20" width="10" height="20" fill="#ef4135" />
        </>
      );
    case "ES":
      return (
        <>
          <rect width="30" height="20" fill="#aa151b" />
          <rect y="5" width="30" height="10" fill="#f1bf00" />
        </>
      );
  }
}

/** Bandeira redonda do país associado ao idioma (globo se o idioma não tiver bandeira). */
export function Flag({ code, size = 24 }: { code: string; size?: number }) {
  const country = FLAG_OF_LANGUAGE[code];
  if (!country) return <Globe size={size} aria-hidden="true" />;
  return (
    <svg
      className="lm-flag"
      viewBox="0 0 30 20"
      preserveAspectRatio="xMidYMid slice"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ borderRadius: "50%", display: "block", flex: "none" }}
    >
      <Art country={country} />
    </svg>
  );
}
