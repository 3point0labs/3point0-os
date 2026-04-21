"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { roleCanUseSettings } from "@/lib/access";

const allItems = [
  { href: "/command", label: "Command", Icon: IconCommand },
  { href: "/broadcast", label: "Broadcast", Icon: IconBroadcast },
  { href: "/partnerships", label: "Partnerships", Icon: IconPartnerships },
  { href: "/settings", label: "Settings", Icon: IconSettings, needsSettingsRole: true as const },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { profile, loading } = useAuth();

  const items = useMemo(() => {
    if (loading) return allItems.filter((i) => !("needsSettingsRole" in i && i.needsSettingsRole));
    const canSettings = roleCanUseSettings(profile?.role);
    return allItems.filter((i) => {
      if ("needsSettingsRole" in i && i.needsSettingsRole) return canSettings;
      return true;
    });
  }, [profile?.role, loading]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_92%,transparent)] backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors"
            >
              <span className={active ? "text-[var(--color-accent-coral)]" : "text-[var(--color-text-secondary)]"}>
                <Icon active={active} />
              </span>
              <span
                className={
                  active ? "text-[var(--color-accent-coral)]" : "text-[var(--color-text-secondary)]"
                }
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function IconCommand({ active }: { active: boolean }) {
  const c = active ? "var(--color-accent-coral)" : "var(--color-text-secondary)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}

function IconBroadcast({ active }: { active: boolean }) {
  const c = active ? "var(--color-accent-coral)" : "var(--color-text-secondary)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 5v14l11-7L8 5z"
        stroke={c}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M18 6v12" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPartnerships({ active }: { active: boolean }) {
  const c = active ? "var(--color-accent-coral)" : "var(--color-text-secondary)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 18c0-2.5 3-4 8-4s8 1.5 8 4"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSettings({ active }: { active: boolean }) {
  const c = active ? "var(--color-accent-coral)" : "var(--color-text-secondary)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke={c}
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={c}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}