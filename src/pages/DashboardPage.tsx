import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { DataState } from "../components/ui/DataState.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { adminApi } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";

export function DashboardPage() {
  const { isAdmin } = useAuth();
  const q = useAsync(() => adminApi.summary(), []);

  return (
    <>
      <PageHeader title="Painel" subtitle="Pedidos que aguardam uma decisão da equipa." />
      <DataState q={q}>
        {(s) => {
          const cards: { label: string; value: number; to: string; alert?: boolean; adminOnly?: boolean }[] = [
            { label: "Depósitos por confirmar", value: s.pendingDeposits, to: "/depositos", alert: true, adminOnly: true },
            { label: "Levantamentos por aprovar", value: s.pendingWithdrawals, to: "/levantamentos", alert: true, adminOnly: true },
            { label: "Levantamentos aprovados por pagar", value: s.approvedWithdrawals, to: "/levantamentos", alert: true, adminOnly: true },
            { label: "Subscrições por aprovar", value: s.pendingSubscriptions, to: "/subscricoes", alert: true, adminOnly: true },
            { label: "Verificações por analisar", value: s.pendingVerifications, to: "/verificacoes", alert: true, adminOnly: true },
            { label: "Tickets de suporte abertos", value: s.openTickets, to: "/suporte", alert: true },
            { label: "Utilizadores registados", value: s.users, to: "/utilizadores" },
          ];
          return (
            <div className="stats">
              {cards
                .filter((c) => isAdmin || !c.adminOnly)
                .map((c) => (
                  <Link key={c.label} to={c.to} className={`stat${c.alert && c.value > 0 ? " stat--alert" : ""}`}>
                    <span className="stat__value">{c.value}</span>
                    <span className="stat__label">{c.label}</span>
                  </Link>
                ))}
            </div>
          );
        }}
      </DataState>
    </>
  );
}
