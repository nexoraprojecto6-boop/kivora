/**
 * Ponto único do logótipo KIVORA. Todas as páginas (acesso, boas-vindas e dashboard)
 * importam daqui; ninguém desenha o logótipo à mão nem escreve "KIVORA" ao lado.
 * O ficheiro logo-mark.svg é o logótipo completo (símbolo + nome) e faz parte do build
 * (nome com hash, servido só de leitura); só muda por commit no repositório.
 * brand.spec.ts falha se o ficheiro for alterado sem querer.
 *
 * O tamanho muda por posição através da altura (px); a largura segue a proporção do SVG.
 * O SVG tem fundo transparente e uma borda branca fina, por isso lê-se bem tanto em fundo
 * claro como escuro, sem placa nem variantes.
 */
import logoUrl from "./logo-mark.svg";

/** Proporção largura/altura do SVG (viewBox 1021 x 244). Fundo transparente, borda branca fina. */
const LOGO_RATIO = 1021 / 244;

export function Logo({ height = 36, className = "" }: { height?: number; className?: string }) {
  return (
    <span className={`brand-logo ${className}`.trim()} style={{ display: "inline-flex", lineHeight: 0 }}>
      <img
        src={logoUrl}
        width={Math.round(height * LOGO_RATIO)}
        height={height}
        alt=""
        draggable={false}
        style={{ display: "block" }}
      />
    </span>
  );
}
