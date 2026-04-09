"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { roleCanUseSettings } from "@/lib/access";

export function SidebarUser() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Failed to sign out", error);
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="mt-2 border-t border-[var(--color-border)] px-2 py-3">
        <p className="font-mono text-[10px] text-[var(--color-text-secondary)]">Loading…</p>
      </div>
    );
  }

  const name = profile?.name || user?.email || "User";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const roleLabel = profile?.role ?? "—";

  return (
    <div className="mt-2 border-t border-[var(--color-border)] px-2 py-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(201,168,124,0.35)] bg-[rgba(201,168,124,0.12)] font-mono text-sm font-medium text-[var(--color-accent-primary)]"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-[var(--color-accent-eggshell)]">{name}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
            {roleLabel}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="mt-3 w-full min-h-[44px] rounded-lg border border-[var(--color-border)] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-accent-eggshell)]"
      >
        Sign out
      </button>
      {roleCanUseSettings(profile?.role) && (
        <Link
          href="/settings"
          className="mt-2 flex min-h-[44px] items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-accent-eggshell)]"
        >
          <span aria-hidden>⚙</span>
          Settings
        </Link>
      )}
    </div>
  );
}
