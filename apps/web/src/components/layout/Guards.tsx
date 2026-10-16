import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Permission } from "@motatto/shared";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/hooks/useCan";
import { PageLoader } from "@/components/ui";

export function RequireTenantUser({ children }: { children: ReactNode }) {
  const { user, tenant, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (user.role === "superadmin" && !user.impersonating) return <Navigate to="/superadmin" replace />;
  if (!tenant) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireSuperadmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "superadmin") return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function RequireCan({ perm, children }: { perm: Permission; children: ReactNode }) {
  const can = useCan();
  if (!can(perm)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
