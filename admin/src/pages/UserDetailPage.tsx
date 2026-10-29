import { ArrowLeft, Ban, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { Badge } from "../components/ui/Badge.js";
import { DataState } from "../components/ui/DataState.js";
import { DecisionDialog } from "../components/ui/DecisionDialog.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { useToast } from "../components/ui/Toast.js";
import { adminApi, type UserStatus } from "../lib/api.js";
import { formatDate, formatMoney } from "../lib/format.js";
import { ROLE_LABEL } from "../lib/labels.js";
import { useAsync } from "../lib/useAsync.js";

const ACTIONS: Record<UserStatus, { title: string; confirm: string; tone: "primary" | "danger" | "success"; text: string }> = {
  SUSPENDED: {
    title: "Banir utilizador",
    confirm: "Banir",
    tone: "danger",
    text: "A conta fica suspensa e todas as sessões abertas são terminadas de imediato. O utilizador deixa de poder entrar.",
  },
  LIMITED: {
    title: "Limitar conta",
    confirm: "Limitar",
    tone: "primary",
    text: "A conta fica com acesso limitado, conforme as regras do servidor para contas limitadas.",
  },
  ACTIVE: {
    title: "Reactivar conta",
    confirm: "Reactivar",
    tone: "success",
    text: "A conta volta ao estado activo e o utilizador pode entrar normalmente.",
  },
};

export function UserDetailPage() {
  const { id = "" } = useParams();
  const { isAdmin, user: me } = useAuth();
  const toast = useToast();
  const q = useAsync(() => adminApi.user(id), [id]);
  const [target, setTarget] = useState<UserStatus | null>(null);

  return (
    <>
      <Link to="/utilizadores" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
        <ArrowLeft size={14} /> Utilizadores
      </Link>
      <DataState q={q}>
        {(u) => {
          const self = u.id === me?.id;
          return (
            <>
              <PageHeader
                title={u.fullName}
                subtitle={u.email}
                actions={
                  isAdmin && !self ? (
                    <>
                      {u.status !== "ACTIVE" && (
                        <button className="btn btn--success" type="button" onClick={() => setTarget("ACTIVE")}>
                          <ShieldCheck size={16} /> Reactivar
                        </button>
                      )}
                      {u.status === "ACTIVE" && (
                        <button className="btn btn--ghost" type="button" onClick={() => setTarget("LIMITED")}>
                          <ShieldOff size={16} /> Limitar
                        </button>
                      )}
                      {u.status !== "SUSPENDED" && (
                        <button className="btn btn--danger" type="button" onClick={() => setTarget("SUSPENDED")}>
                          <Ban size={16} /> Banir
                        </button>
                      )}
                    </>
                  ) : undefined
                }
              />
              <div className="grid-2">
                <section className="card">
                  <h2>Dados da conta</h2>
                  <dl className="kv">
                    <dt>Nome</dt><dd>{u.fullName}</dd>
                    <dt>E-mail</dt><dd>{u.email}</dd>
                    <dt>País de residência</dt><dd>{u.countryOfResidence}</dd>
                    <dt>Perfil</dt><dd>{ROLE_LABEL[u.role] ?? u.role}</dd>
                    <dt>Estado da conta</dt><dd><Badge status={u.status} /></dd>
                    <dt>Verificação</dt><dd><Badge status={u.verificationStatus} /></dd>
                    <dt>Registo</dt><dd>{formatDate(u.createdAt)}</dd>
                    <dt>Identificador</dt><dd className="mono">{u.id}</dd>
                  </dl>
                </section>
                <section className="card">
                  <h2>Carteira e actividade</h2>
                  <dl className="kv">
                    <dt>Saldo disponível</dt><dd><strong>{formatMoney(u.available)}</strong></dd>
                    <dt>Valor reservado</dt><dd>{formatMoney(u.reserved)}</dd>
                    <dt>Depósitos</dt><dd>{u.deposits}</dd>
                    <dt>Levantamentos</dt><dd>{u.withdrawals}</dd>
                    <dt>Subscrições</dt><dd>{u.subscriptions}</dd>
                  </dl>
                </section>
              </div>
              {!isAdmin && <div className="alert alert--info">Perfil de suporte: pode consultar, mas não alterar contas.</div>}
              {self && <div className="alert alert--info">Esta é a sua própria conta; não pode alterar o seu estado.</div>}

              {target && (
                <DecisionDialog
                  title={ACTIONS[target].title}
                  tone={ACTIONS[target].tone}
                  confirmLabel={ACTIONS[target].confirm}
                  noteHidden
                  description={<><strong>{u.fullName}</strong> ({u.email}). {ACTIONS[target].text}</>}
                  onClose={() => setTarget(null)}
                  onConfirm={async () => {
                    q.setData(await adminApi.setUserStatus(u.id, target));
                    toast.success("Estado da conta actualizado.");
                  }}
                />
              )}
            </>
          );
        }}
      </DataState>
    </>
  );
}
