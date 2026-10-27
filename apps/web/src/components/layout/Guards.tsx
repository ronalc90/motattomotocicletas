import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { CloudOff, RefreshCw } from "lucide-react";
import type { Permission } from "@motatto/shared";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/hooks/useCan";
import { Button, EmptyState, PageLoader } from "@/components/ui";

/**
 * /auth/me no respondió (límite de peticiones, sin red o servidor caído) pero el token sigue
 * guardado: no es una sesión inválida, así que no se manda a /login. Se reintenta solo, cada
 * vez más espaciado (5 s, 10 s, 20 s… hasta 1 min), o con el botón.
 */
function SessionRetry({ message }: { message: string }) {
  const { refresh } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const retry = useCallback(async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
    setAttempt((n) => n + 1);
  }, [refresh]);
  useEffect(() => {
    if (busy) return;
    const t = setTimeout(() => void retry(), Math.min(60_000, 5_000 * 2 ** attempt));
    return () => clearTimeout(t);
  }, [attempt, busy, retry]);
  return (
    <EmptyState
      className="py-20"
      icon={<CloudOff className="h-7 w-7" />}
      title="No pudimos verificar tu sesión"
      text={`${message.replace(/\.?$/, ".")} Tu sesión sigue abierta y lo volvemos a intentar automáticamente.`}
      action={
        <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={busy} onClick={() => void retry()}>
          Reintentar ahora
        </Button>
      }
    />
  );
}

export function RequireTenantUser({ children }: { children: ReactNode }) {
  const { user, tenant, loading, sessionError } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user && sessionError) return <SessionRetry message={sessionError} />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (user.role === "superadmin" && !user.impersonating) return <Navigate to="/superadmin" replace />;
  if (!tenant) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireSuperadmin({ children }: { children: ReactNode }) {
  const { user, loading, sessionError } = useAuth();
  if (loading) return <PageLoader />;
  if (!user && sessionError) return <SessionRetry message={sessionError} />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "superadmin") return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function RequireCan({ perm, children }: { perm: Permission; children: ReactNode }) {
  const can = useCan();
  if (!can(perm)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
