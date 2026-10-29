import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { AsyncState } from "../../lib/useAsync.js";
import { errorText } from "../../lib/labels.js";

/** Mostra carregamento, erro (com repetir) ou o conteúdo. */
export function DataState<T>({ q, children }: { q: AsyncState<T>; children: (data: T) => ReactNode }) {
  if (q.error) {
    return (
      <div className="alert alert--danger" role="alert">
        <span>{errorText(q.error.code)}</span>
        <button className="btn btn--ghost btn--sm" onClick={q.reload} type="button">
          <RefreshCw size={14} /> Repetir
        </button>
      </div>
    );
  }
  if (q.data === null) return <div className="state" role="status">A carregar…</div>;
  return <>{children(q.data)}</>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state state--empty">{children}</div>;
}
