"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/types/profile";

export function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { profile, loading } = useAuth();

  if (loading || !profile) return null;
  if (!allowedRoles.includes(profile.role)) return null;
  return <>{children}</>;
}
