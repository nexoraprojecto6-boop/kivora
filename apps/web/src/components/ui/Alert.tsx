import type { ReactNode } from "react";

/** Mensagem geral. O ícone é decorativo: o estado é sempre indicado por texto. */
export function Alert({ children, kind = "error" }: { children: ReactNode; kind?: "error" | "success" }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`alert alert--${kind}`}>
      <span aria-hidden="true" className="alert__icon">{kind === "error" ? "!" : "✓"}</span>
      <span>{children}</span>
    </div>
  );
}
