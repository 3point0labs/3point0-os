"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSuggestionCount } from "@/app/actions/suggestions";

const items = [
  { href: "/command", label: "Command Center" },
  { href: "/broadcast", label: "Broadcast Room" },
  { href: "/partnerships", label: "Partnerships", badge: true as const },
];

export function NavLinks() {
  const pathname = usePathname();
  const [suggestionCount, setSuggestionCount] = useState(0);

  useEffect(() => {
    const refresh = () => void getSuggestionCount().then(setSuggestionCount);
    refresh();
    const id = window.setInterval(refresh, 12000);
    return () => window.clearInterval(id);
  }, [pathname]);

  return (
    <nav className="flex flex-1 flex-col gap-1.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const showBadge = "badge" in item && item.badge && suggestionCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-transparent py-2.5 pl-3 pr-3 font-mono text-xs uppercase tracking-wider transition lg:min-h-0 ${
              active
                ? "border-l-[3px] border-l-[var(--color-accent-primary)] bg-[rgba(201,168,124,0.08)] pl-2.5 text-[var(--color-accent-eggshell)]"
                : "text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[rgba(201,168,124,0.04)] hover:text-[var(--color-accent-eggshell)]"
            }`}
          >
            <span className="flex items-center gap-2">
              {active && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-coral)]"
                  aria-hidden
                />
              )}
              <span>{item.label}</span>
            </span>
            {showBadge && (
              <span className="relative shrink-0 rounded border border-[rgba(232,83,61,0.45)] bg-[rgba(232,83,61,0.12)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-accent-coral)]">
                {suggestionCount} new
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
