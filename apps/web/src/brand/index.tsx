/**
 * Ponto único do logótipo KIVORA. Todas as páginas (acesso, boas-vindas e dashboard)
 * importam daqui; ninguém desenha o logótipo à mão nem escreve "KIVORA" ao lado.
 * O ficheiro logo-mark.svg é o logótipo completo (símbolo + nome) e faz parte do build
 * (nome com hash, servido só de leitura); só muda por commit no repositório.
 * brand.spec.ts falha se o ficheiro for alterado sem querer.
 *
 * O tamanho muda por posição através da altura (px); a largura segue a proporção do SVG.
 * Em fundos escuros (cabeçalho, menu lateral) usa `onDark`: o mesmo SVG numa placa branca,
 * para as letras azuis ficarem bem visíveis.
 */
import logoUrl from "./logo-mark.svg";

/** Proporção largura/altura do SVG (viewBox 1105 x 320). */
const LOGO_RATIO = 1105 / 320;

export function Logo({
  height = 36,
  onDark = false,
  className = "",
}: {
  height?: number;
  onDark?: boolean;
  className?: string;
}) {
  const img = (
    <img
      src={logoUrl}
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      alt=""
      draggable={false}
      style={{ display: "block" }}
    />
  );

  if (!onDark) {
    return (
      <span className={`brand-logo ${className}`.trim()} style={{ display: "inline-flex", lineHeight: 0 }}>
        {img}
      </span>
    );
  }

  return (
    <span
      className={`brand-logo brand-logo--plate ${className}`.trim()}
      style={{
        display: "inline-flex",
        lineHeight: 0,
        background: "#ffffff",
        borderRadius: Math.round(height * 0.4),
        padding: `${Math.round(height * 0.2)}px ${Math.round(height * 0.4)}px`,
      }}
    >
      {img}
    </span>
  );
}
