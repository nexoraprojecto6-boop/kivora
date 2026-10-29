import logoUrl from "./logo-mark.svg";

/** Proporção largura/altura do SVG (viewBox 1021 x 244). */
const LOGO_RATIO = 1021 / 244;

export function Logo({ height = 32 }: { height?: number }) {
  return (
    <img
      src={logoUrl}
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      alt="KIVORA"
      draggable={false}
      style={{ display: "block" }}
    />
  );
}
