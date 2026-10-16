import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role, Tenant, User } from "@motatto/shared";
import { api, tokenStore } from "./api";

export interface AuthUser extends User {
  impersonating?: boolean;
  effectiveRole?: Role;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  tenant: Tenant | null;
  loading: boolean;
  /** Role used for permission checks (dueno when impersonating). */
  role: Role | null;
  login: (email: string, password: string) => Promise<{ user: AuthUser; tenant: Tenant | null }>;
  setSession: (token: string, user?: AuthUser, tenant?: Tenant | null) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setTenant: (t: Tenant) => void;
  /** Leave support mode (impersonation) and go back to the superadmin token */
  exitSupport: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenantState] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState<boolean>(!!tokenStore.get());

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setTenantState(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<{ user: AuthUser; tenant: Tenant | null }>("/auth/me");
      setUser(me.user);
      setTenantState(me.tenant);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        tokenStore.clear();
        setToken(null);
        setUser(null);
        setTenantState(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSession = useCallback(
    async (t: string, u?: AuthUser, tn?: Tenant | null) => {
      tokenStore.set(t);
      setToken(t);
      if (u) {
        setUser(u);
        setTenantState(tn ?? null);
        setLoading(false);
      } else {
        setLoading(true);
        await refresh();
      }
    },
    [refresh],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.post<{ token: string; user: AuthUser; tenant: Tenant | null }>("/auth/login", { email, password });
      await setSession(r.token, r.user, r.tenant);
      return { user: r.user, tenant: r.tenant };
    },
    [setSession],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    tokenStore.clearSupport();
    setToken(null);
    setUser(null);
    setTenantState(null);
  }, []);

  const exitSupport = useCallback(async () => {
    const original = tokenStore.getSupport();
    tokenStore.clearSupport();
    if (original) await setSession(original);
    else logout();
  }, [setSession, logout]);

  const role: Role | null = user ? (user.impersonating ? (user.effectiveRole ?? "dueno") : user.role) : null;

  const value = useMemo<AuthState>(
    () => ({ token, user, tenant, loading, role, login, setSession, logout, refresh, setTenant: setTenantState, exitSupport }),
    [token, user, tenant, loading, role, login, setSession, logout, refresh, exitSupport],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
