"use client";
import { useEffect, useRef, useState } from "react";
import { getSession, logout, type User } from "../services/session";
import "./profile-menu.css";

export type MenuItem = { label: string; href?: string; onClick?: () => void; danger?: boolean };

export const DEFAULT_ITEMS: MenuItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Carteira", href: "/dashboard/wallet" },
  { label: "Transacções", href: "/dashboard/transactions" },
  { label: "O meu perfil", href: "/dashboard/profile" },
  { label: "Definições", href: "/dashboard/settings" },
  { label: "Terminar sessão", onClick: logout, danger: true },
];

export default function ProfileMenu({ items = DEFAULT_ITEMS }: { items?: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User>({ name: "…", email: "" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { getSession().then(setUser).catch(() => {}); }, []);
  useEffect(() => {
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, []);

  return (
    <div className="pm" ref={ref}>
      <button className="pm-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {user.avatar ? <img src={user.avatar} alt="" /> : <span>{user.name[0]}</span>}
      </button>
      {open && (
        <div className="pm-pop" role="menu">
          <div className="pm-head"><strong>{user.name}</strong><small>{user.email}</small></div>
          {items.map(i => i.href ? (
            <a key={i.label} href={i.href} role="menuitem" onClick={() => setOpen(false)}>{i.label}</a>
          ) : (
            <button key={i.label} role="menuitem" className={i.danger ? "danger" : ""}
              onClick={() => { setOpen(false); i.onClick?.(); }}>{i.label}</button>
          )}
        </div>
      )}
    </div>
  );
}
