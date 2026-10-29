import { FileText, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api.js";
import { errorText } from "../../lib/labels.js";

type State =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "error"; text: string }
  | { kind: "image"; url: string }
  | { kind: "pdf"; url: string };

/**
 * Mostra um ficheiro privado (comprovativo ou documento): imagem em linha, PDF numa nova aba.
 * `load` devolve null quando o servidor responde 404 (sem ficheiro).
 */
export function BlobViewer({
  load,
  label,
  emptyText = "Sem ficheiro anexado.",
  deps,
}: {
  load: () => Promise<{ url: string; mime: string } | null>;
  label: string;
  emptyText?: string;
  deps: readonly unknown[];
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    setState({ kind: "loading" });
    load()
      .then((f) => {
        if (!alive) {
          if (f) URL.revokeObjectURL(f.url);
          return;
        }
        if (!f) return setState({ kind: "none" });
        created = f.url;
        setState({ kind: f.mime.startsWith("image/") ? "image" : "pdf", url: f.url });
      })
      .catch((e: unknown) => alive && setState({ kind: "error", text: errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR") }));
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <figure className="blob">
      <figcaption>{label}</figcaption>
      {state.kind === "loading" && <div className="blob__box muted">A carregar…</div>}
      {state.kind === "none" && (
        <div className="blob__box muted"><ImageOff size={20} /> {emptyText}</div>
      )}
      {state.kind === "error" && <div className="blob__box blob__box--error">{state.text}</div>}
      {state.kind === "image" && (
        <button type="button" className={`blob__img${zoom ? " is-zoom" : ""}`} onClick={() => setZoom((z) => !z)} aria-label={`Ampliar: ${label}`}>
          <img src={state.url} alt={label} />
        </button>
      )}
      {state.kind === "pdf" && (
        <a className="blob__box" href={state.url} target="_blank" rel="noreferrer">
          <FileText size={20} /> Abrir PDF numa nova aba
        </a>
      )}
    </figure>
  );
}
