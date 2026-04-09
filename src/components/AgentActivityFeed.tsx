"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Entry = { id: number; ts: string; text: string; level: "teal" | "purple" | "amber" };

const templates = [
  { text: "Sponsor outreach agent enriched company context", level: "teal" as const },
  { text: "Draft email generated and queued to modal", level: "purple" as const },
  { text: "Pipeline stage transition recorded", level: "teal" as const },
  { text: "Follow-up scanner found contact overdue 7+ days", level: "amber" as const },
  { text: "Dashboard metrics refreshed from local JSON", level: "teal" as const },
  { text: "Web research pass completed for target brand", level: "purple" as const },
];

function stamp() {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AgentActivityFeed() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const nextId = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEntries(
      Array.from({ length: 8 }).map((_, i) => {
        const seed = templates[i % templates.length];
        return { id: i + 1, ts: stamp(), text: seed.text, level: seed.level };
      })
    );
    nextId.current = 9;
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const template = templates[Math.floor(Math.random() * templates.length)];
      setEntries((prev) => {
        const next = [
          ...prev,
          { id: nextId.current++, ts: stamp(), text: template.text, level: template.level },
        ];
        return next.slice(-24);
      });
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [entries]);

  const levelClass = useMemo(
    () => ({
      teal: "border-[rgba(201,168,124,0.45)] text-[var(--color-accent-primary)]",
      purple: "border-[rgba(167,139,250,0.45)] text-[#c4b5fd]",
      amber: "border-[rgba(232,83,61,0.45)] text-[var(--color-accent-coral)]",
    }),
    []
  );

  return (
    <aside className="mission-card h-[540px]">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="font-mono text-sm tracking-wider text-[var(--color-accent-eggshell)]">Agent Activity Feed</h3>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Live stream of system actions</p>
      </header>
      <div ref={containerRef} className="h-[470px] space-y-2 overflow-y-auto px-3 py-3">
        {entries.map((entry) => (
          <div key={entry.id} className="glass-card rounded-md px-3 py-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase ${levelClass[entry.level]}`}>
                {entry.level}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-[var(--color-accent-eggshell)]">{entry.ts}</span>
            </div>
            <p className="text-xs text-[color-mix(in_srgb,var(--color-accent-eggshell)_85%,transparent)]">{entry.text}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
