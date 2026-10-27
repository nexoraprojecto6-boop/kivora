/**
 * Ponto único do logótipo KIVORA. Todas as páginas (acesso, boas-vindas e dashboard)
 * importam daqui; ninguém desenha o logótipo à mão. O ficheiro logo-mark.svg faz parte
 * do build (nome com hash, servido só de leitura) e só muda por commit no repositório.
 * brand.spec.ts falha se o ficheiro for alterado sem querer; .github/CODEOWNERS exige revisão.
 */
import logoMarkUrl from "./logo-mark.svg";

export function LogoMark({ size = 34 }: { size?: number }) {
  return <img src={logoMarkUrl} width={size} height={size} alt="" draggable={false} />;
}

/** Marca e nome. O nome acessível vem da ligação ou do elemento que a rodeia. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`logo-lockup ${className}`.trim()}>
      <LogoMark />
      <span className="logo-lockup__name">KIVORA</span>
    </span>
  );
}
