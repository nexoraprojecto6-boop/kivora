import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/Badge.js";
import { DataState, Empty } from "../components/ui/DataState.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { adminApi } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import { ROLE_LABEL } from "../lib/labels.js";
import { useAsync } from "../lib/useAsync.js";

export function UsersPage() {
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(text.trim()), 350);
    return () => window.clearTimeout(t);
  }, [text]);
  const q = useAsync(() => adminApi.users(term || undefined), [term]);

  return (
    <>
      <PageHeader title="Utilizadores" subtitle="Pesquise por nome ou e-mail e abra a ficha para ver dados e gerir a conta." />
      <div className="toolbar">
        <label className="field" style={{ minWidth: "18rem" }}>
          <span className="visually-hidden">Pesquisar</span>
          <span style={{ position: "relative", display: "block" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12 }} aria-hidden />
            <input className="input" style={{ paddingLeft: 36 }} placeholder="Nome ou e-mail" value={text} onChange={(e) => setText(e.target.value)} />
          </span>
        </label>
      </div>
      <DataState q={q}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>Nenhum utilizador encontrado.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Utilizador</th><th>País</th><th>Perfil</th><th>Verificação</th><th>Conta</th><th>Registo</th></tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="row-click" onClick={() => nav(`/utilizadores/${u.id}`)}>
                      <td><span className="cell-main">{u.fullName}<small>{u.email}</small></span></td>
                      <td>{u.countryOfResidence}</td>
                      <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                      <td><Badge status={u.verificationStatus} /></td>
                      <td><Badge status={u.status} /></td>
                      <td className="nowrap">{formatDate(u.createdAt)}</td>
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
