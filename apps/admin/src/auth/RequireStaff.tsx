import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.js";

export function RequireStaff() {
  const { phase } = useAuth();
  const loc = useLocation();
  if (phase === "loading") return <div className="boot" role="status">A carregar…</div>;
  if (phase !== "ready") return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

/** Páginas só para ADMIN (SUPPORT vê aviso; o servidor também recusa). */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <div className="alert alert--warning" role="alert">
        Esta área é reservada a administradores. A sua conta tem perfil de suporte.
      </div>
    );
  }
  return <>{children}</>;
}
