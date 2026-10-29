import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { Logo } from "../brand/index.js";
import { adminApi } from "../lib/api.js";
import { ROLE_LABEL } from "../lib/labels.js";

interface NavItem { to: string; label: string; icon: typeof Users; adminOnly?: boolean; badge?: "deposits" | "withdrawals" | "verifications" | "subscriptions" | "tickets" }

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Visão geral", items: [{ to: "/", label: "Painel", icon: LayoutDashboard }] },
  {
    group: "Operações",
    items: [
      { to: "/depositos", label: "Depósitos", icon: ArrowDownToLine, adminOnly: true, badge: "deposits" },
      { to: "/levantamentos", label: "Levantamentos", icon: ArrowUpFromLine, adminOnly: true, badge: "withdrawals" },
      { to: "/verificacoes", label: "Verificações", icon: ShieldCheck, adminOnly: true, badge: "verifications" },
      { to: "/subscricoes", label: "Subscrições e rendimentos", icon: TrendingUp, adminOnly: true, badge: "subscriptions" },
    ],
  },
  {
    group: "Gestão",
    items: [
      { to: "/utilizadores", label: "Utilizadores", icon: Users },
      { to: "/planos", label: "Planos", icon: Layers, adminOnly: true },
      { to: "/metodos", label: "Métodos de pagamento", icon: CreditCard, adminOnly: true },
      { to: "/acordos", label: "Acordos", icon: FileText, adminOnly: true },
      { to: "/suporte", label: "Suporte", icon: LifeBuoy, badge: "tickets" },
      { to: "/auditoria", label: "Auditoria", icon: ScrollText, adminOnly: true },
    ],
  },
];

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => setOpen(false), [loc.pathname]);

  useEffect(() => {
    let alive = true;
    const pull = () =>
      adminApi
        .summary()
        .then((s) => {
          if (!alive) return;
          setCounts({
            deposits: s.pendingDeposits,
            withdrawals: s.pendingWithdrawals + s.approvedWithdrawals,
            verifications: s.pendingVerifications,
            subscriptions: s.pendingSubscriptions,
            tickets: s.openTickets,
          });
        })
        .catch(() => undefined);
    void pull();
    const t = window.setInterval(pull, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [loc.pathname]);

  return (
    <div className="shell">
      <aside className={`sidebar${open ? " is-open" : ""}`}>
        <div className="sidebar__brand"><Logo height={30} /></div>
        <nav aria-label="Principal">
          {NAV.map((g) => {
            const items = g.items.filter((i) => isAdmin || !i.adminOnly);
            if (!items.length) return null;
            return (
              <div key={g.group} className="nav-group">
                <div className="nav-group__title">{g.group}</div>
                {items.map((i) => {
                  const Icon = i.icon;
                  const n = i.badge ? counts[i.badge] ?? 0 : 0;
                  return (
                    <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}>
                      <Icon size={18} />
                      <span>{i.label}</span>
                      {n > 0 && <span className="nav-item__badge">{n}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn topbar__menu" onClick={() => setOpen((o) => !o)} aria-label="Menu" type="button">
            <Menu size={20} />
          </button>
          <div className="topbar__spacer" />
          <div className="topbar__user">
            <div>
              <strong>{user?.fullName}</strong>
              <small>{isAdmin ? ROLE_LABEL["ADMIN"] : ROLE_LABEL["SUPPORT"]}</small>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => void logout()} type="button">
              <LogOut size={14} /> Sair
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
