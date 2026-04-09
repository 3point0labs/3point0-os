"use client";

import { useEffect, useState } from "react";

function formatNow(date: Date) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function SystemStatusBar() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mission-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-h-11 items-center gap-3 font-mono text-xs tracking-[0.2em] text-[var(--color-accent-primary)]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent-primary)] opacity-50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-accent-primary)]" />
        </span>
        SYSTEM ONLINE
      </div>
      <div className="min-h-11 font-mono text-xs tabular-nums text-[var(--color-accent-eggshell)]">
        {mounted && now ? formatNow(now) : "--:--:--"}
      </div>
      <div className="min-h-11 rounded-md border border-[var(--color-border)] bg-[rgba(201,168,124,0.08)] px-2.5 py-2 font-mono text-xs tracking-wider text-[var(--color-accent-primary)]">
        AGENTS: 2 ACTIVE
      </div>
      <div className="leather-progress hidden w-full basis-full sm:block sm:max-w-xs" aria-hidden />
    </div>
  );
}
