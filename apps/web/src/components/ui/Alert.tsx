import type { ReactNode } from "react";

/** Mensagem de erro geral. O ícone é decorativo: o estado é sempre indicado por texto. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="alert alert--error">
      <span aria-hidden="true" className="alert__icon">!</span>
      <span>{children}</span>
    </div>
  );
}
