import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicUser } from "@kivora/shared";
import type { LoginInput, RegisterInput } from "@kivora/validation";
import { authApi } from "../../services/api-client.js";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Volta a perguntar ao backend quem está autenticado (por exemplo, quando uma chamada devolve 401). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * O estado da sessão vem sempre do backend (GET /auth/me). O frontend nunca
 * decide sozinho quem está autenticado e não guarda tokens: o cookie é HttpOnly.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const u = await authApi.login(input);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    // O registo já abre sessão: o utilizador segue logo para a verificação (email e documentos).
    const u = await authApi.register(input);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout, refresh }),
    [status, user, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth tem de ser usado dentro de AuthProvider.");
  return ctx;
}
