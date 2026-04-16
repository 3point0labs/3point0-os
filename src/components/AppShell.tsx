"use client"

import Link from "next/link";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MobileBottomNav } from "./MobileBottomNav";
import { NavLinks } from "./NavLinks";
import { PodcastSwitcher } from "./PodcastSwitcher";
import { SidebarUser } from "./SidebarUser";

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.provider_token) {
        await supabase
          .from("profiles")
          .update({
            provider_token: session.provider_token,
            provider_refresh_token: session.provider_refresh_token ?? null,
          })
          .eq("id", session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="flex min-h-full min-w-0 text-[var(--color-accent-eggshell)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 shrink-0 border-r border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_94%,transparent)] backdrop-blur-md lg:flex">
        <div className="flex h-full w-full flex-col px-4 py-6">
          <Link href="/command" className="mb-8 flex flex-col items-center py-2">
            <img src="/logo.png" alt="3point0 Labs" className="h-10 w-auto" />
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Mission Control</p>
          </Link>
          <PodcastSwitcher variant="sidebar" />
          <NavLinks />
          <div className="flex-1" />
          <SidebarUser />
          <p className="mt-2 px-2 font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
            Media systems online
          </p>
        </div>
      </aside>

      <div
        className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_95%,transparent)] backdrop-blur-md px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] lg:hidden"
        role="region"
        aria-label="Workspace switcher"
      >
        <PodcastSwitcher variant="dock" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden pl-0 pt-[88px] pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60 lg:pt-0">
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden px-4 py-4 text-sm lg:px-8 lg:py-8 lg:text-base">
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
