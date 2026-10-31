import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "../../i18n/I18nProvider.js";
import { SUPPORTED_LANGUAGES, isLanguageCode } from "../../i18n/resources.js";
import { Flag } from "./flags.js";
import "./language-menu.css";

/**
 * Seletor de idioma compacto: só a bandeira do idioma atual. Ao tocar abre um painel estreito, na vertical,
 * com todos os idiomas e a bandeira de cada um. Fecha com Esc, ao tocar fora ou ao escolher.
 * Usado nas páginas de acesso, na boas-vindas e no painel (traz o seu próprio CSS).
 */
export function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const currentName = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name ?? language;

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: Event) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open && button.current) {
      // Perto do fundo do ecrã (por exemplo no rodapé) o painel abre para cima.
      const rect = button.current.getBoundingClientRect();
      setUp(window.innerHeight - rect.bottom < 240 && rect.top > 240);
    }
    setOpen((v) => !v);
  }

  return (
    <div className="lm" ref={root}>
      <button
        ref={button}
        type="button"
        className="lm-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("common.language.select")}: ${currentName}`}
        title={currentName}
        onClick={toggle}
      >
        <Flag code={language} size={26} />
      </button>
      {open ? (
        <ul className={`lm-panel${up ? " lm-panel--up" : ""}`} role="menu" aria-label={t("common.language.label")}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <li key={l.code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={l.code === language}
                lang={l.code}
                className={`lm-item${l.code === language ? " lm-item--on" : ""}`}
                onClick={() => {
                  if (isLanguageCode(l.code)) setLanguage(l.code);
                  setOpen(false);
                  button.current?.focus();
                }}
              >
                <Flag code={l.code} size={24} />
                <span className="lm-item__name">{l.name}</span>
                {l.code === language ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
