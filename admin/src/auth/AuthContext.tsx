import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicUser } from "@kivora/shared";
import { adminApi, ApiError, authApi } from "../lib/api.js";

/**
 * Estados:
 *  - loading: a verificar a sessão;
 *  - anon: sem sessão;
 *  - forbidden: sessão válida, mas a conta não é ADMIN nem SUPPORT (sessão é terminada);
 *  - ready: pessoal autorizado.
 * O servidor decide sempre (StaffGuard/AdminOnlyGuard); aqui só se adapta o menu.
 */
type Phase = "loading" | "anon" | "forbidden" | "ready";

interface AuthValue {
  phase: Phase;
  user: PublicUser | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const resolveStaff = useCallback(async (u: PublicUser) => {
    try {
      await adminApi.summary();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) {
        await authApi.logout().catch(() => undefined);
        setUser(null);
        setIsAdmin(false);
        setPhase("forbidden");
        return;
      }
      throw e;
    }
    setIsAdmin(await adminApi.probeAdmin());
    setUser(u);
    setPhase("ready");
  }, []);

  useEffect(() => {
    let alive = true;
    authApi
      .me()
      .then((u) => (alive ? resolveStaff(u) : undefined))
      .catch(() => {
        if (alive) setPhase("anon");
      });
    return () => {
      alive = false;
    };
  }, [resolveStaff]);

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await authApi.login({ email, password });
      await resolveStaff(u);
    },
    [resolveStaff],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
    setIsAdmin(false);
    setPhase("anon");
  }, []);

  const value = useMemo<AuthValue>(() => ({ phase, user, isAdmin, login, logout }), [phase, user, isAdmin, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora de AuthProvider");
  return v;
}
