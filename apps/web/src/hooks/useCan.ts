import { can, type Permission } from "@motatto/shared";
import { useAuth } from "@/lib/auth";

export function useCan() {
  const { role } = useAuth();
  return (perm: Permission) => can(role, perm);
}
