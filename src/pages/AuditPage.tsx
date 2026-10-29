import { RefreshCw } from "lucide-react";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { adminApi } from "../lib/api.js";
import { formatDateTime } from "../lib/format.js";
import { useAsync } from "../lib/useAsync.js";

export function AuditPage() {
  const q = useAsync(() => adminApi.audit(200), []);
  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Registo das acções sensíveis (últimas 200)."
        actions={<button className="btn btn--ghost btn--sm" type="button" onClick={q.reload}><RefreshCw size={14} /> Actualizar</button>}
      />
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Sem eventos registados.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Quando</th><th>Acção</th><th>Autor</th><th>Resultado</th><th>Pedido</th></tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="nowrap">{formatDateTime(e.createdAt)}</td>
                      <td className="mono">{e.action}</td>
                      <td>{e.actorEmail ?? "—"}</td>
                      <td><Badge text={e.outcome === "SUCCESS" ? "Sucesso" : "Falha"} tone={e.outcome === "SUCCESS" ? "success" : "danger"} /></td>
                      <td className="mono muted">{e.requestId.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataState>
    </>
  );
}
