"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSuggestionToPipeline } from "@/app/actions/suggestions";
import type { PipelineSuggestion } from "@/lib/suggestions";

export function PartnershipsSuggestions({ initial }: { initial: PipelineSuggestion[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  if (rows.length === 0) return null;

  return (
    <section className="mission-card p-4 ring-1 ring-[rgba(232,83,61,0.25)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent-coral)] opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent-coral)]" />
        </span>
        <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-coral)]">Suggested additions</h2>
        <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">From episode intelligence</span>
      </div>
      <div className="space-y-2">
        {rows.map((s) => (
          <div
            key={s.id}
            className="glass-card flex flex-wrap items-start justify-between gap-3 rounded-lg p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--color-accent-eggshell)]">{s.company}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                    s.podcast === "One54"
                      ? "bg-[rgba(201,168,124,0.18)] text-[var(--color-accent-primary)]"
                      : "bg-[rgba(232,83,61,0.14)] text-[var(--color-accent-coral)]"
                  }`}
                >
                  {s.podcast === "One54" ? "ONE54" : "PRESSBOX"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{s.reason}</p>
              <p className="mt-1 font-mono text-[10px] text-[var(--color-text-secondary)]">{s.episodeTitle}</p>
            </div>
            <button
              type="button"
              disabled={pending}
              className="btn-cta min-h-11 shrink-0 px-3 py-2 text-[10px] disabled:opacity-50"
              onClick={() =>
                startTransition(() => {
                  void addSuggestionToPipeline(s.id).then(() => {
                    setRows((prev) => prev.filter((r) => r.id !== s.id));
                    router.refresh();
                  });
                })
              }
            >
              Add to pipeline
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
