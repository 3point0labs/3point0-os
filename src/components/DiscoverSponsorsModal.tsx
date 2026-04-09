"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addDiscoveredSponsorsToPipeline,
  runManualDiscovery,
  type DiscoveryRow,
} from "@/app/actions/discovery";
import { SPONSOR_CATEGORIES } from "@/lib/categories";
import type { Podcast } from "@/lib/types";

const PODCAST_OPTIONS = [
  { id: "ONE54" as const, label: "ONE54" },
  { id: "PRESSBOX" as const, label: "PRESSBOX" },
  { id: "BOTH" as const, label: "BOTH" },
];

const COUNTS = [10, 25, 50] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
};

export function DiscoverSponsorsModal({ open, onClose, onAdded }: Props) {
  const [podcastMode, setPodcastMode] = useState<"ONE54" | "PRESSBOX" | "BOTH">("ONE54");
  const [category, setCategory] = useState<string>("__ALL__");
  const [count, setCount] = useState<10 | 25 | 50>(10);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [results, setResults] = useState<DiscoveryRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const categoryOptions = useMemo(
    () => [{ value: "__ALL__", label: "All categories" }, ...SPONSOR_CATEGORIES.map((c) => ({ value: c, label: c }))],
    []
  );

  if (!open) return null;

  const toggleRow = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const runDiscover = () => {
    setError(null);
    startTransition(() => {
      void runManualDiscovery({
        podcastMode,
        category,
        count,
      }).then((res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.results.length === 0) {
          setError("No new sponsors found. Try another category or a higher count.");
          return;
        }
        setResults(res.results);
        setSelected(new Set(res.results.map((_, i) => i)));
        setStep("preview");
      });
    });
  };

  const addSelected = () => {
    const rows = results.filter((_, i) => selected.has(i));
    if (rows.length === 0) return;
    setError(null);
    startTransition(() => {
      void addDiscoveredSponsorsToPipeline(rows, "One54").then((res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onAdded();
        onClose();
        setStep("form");
        setResults([]);
        setSelected(new Set());
      });
    });
  };

  const close = () => {
    if (!pending) {
      onClose();
      setStep("form");
      setResults([]);
      setError(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog">
      <div className="mission-card max-h-[90vh] w-full max-w-4xl overflow-hidden flex flex-col">
        <div className="border-b border-[rgba(var(--accent-rgb),0.2)] px-4 py-3 flex items-center justify-between">
          <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)]">Auto-discovery</h2>
          <button type="button" className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent-eggshell)]" onClick={close}>
            ✕
          </button>
        </div>

        {step === "form" && (
          <div className="p-4 space-y-4 overflow-y-auto">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Research agent uses Claude with web search (when enabled on your API key) to suggest sponsors not already in the pipeline.
            </p>
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Podcast</p>
              <div className="flex flex-wrap gap-2">
                {PODCAST_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPodcastMode(p.id)}
                    className={`rounded border px-3 py-1.5 font-mono text-xs uppercase ${
                      podcastMode === p.id
                        ? "border-[rgba(var(--accent-rgb),0.5)] bg-[rgba(var(--accent-rgb),0.12)] text-[color:var(--accent)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                Category
              </label>
              <select
                className="min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-accent-eggshell)]"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categoryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Contacts to find</p>
              <div className="flex flex-wrap gap-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCount(c)}
                    className={`rounded border px-3 py-1.5 font-mono text-xs ${
                      count === c
                        ? "border-[rgba(var(--accent-rgb),0.5)] text-[color:var(--accent)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="min-h-11 rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
                onClick={close}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className="btn-cta px-4 py-2 disabled:opacity-50"
                onClick={runDiscover}
              >
                {pending ? "Running…" : "Discover"}
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="border-b border-[var(--color-border)] p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {results.length} found — uncheck any row to exclude before adding.
              </p>
            </div>
            <div className="overflow-auto flex-1 p-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] font-mono text-[10px] uppercase text-[var(--color-text-secondary)]">
                    <th className="p-2 w-8" />
                    <th className="p-2">Brand</th>
                    <th className="p-2">Podcast</th>
                    <th className="p-2">Contact</th>
                    <th className="p-2">Tier</th>
                    <th className="p-2">Pitch</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={`${r.brand}-${idx}`} className="border-b border-[var(--color-border)]">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(idx)}
                          onChange={() => toggleRow(idx)}
                        />
                      </td>
                      <td className="p-2 font-medium text-[var(--color-accent-eggshell)]">{r.brand}</td>
                      <td className="p-2 text-[var(--color-text-secondary)]">{(r.podcast as Podcast) ?? "—"}</td>
                      <td className="p-2 text-[var(--color-text-secondary)]">
                        {r.contactName}
                        <br />
                        <span className="text-[var(--color-text-secondary)]">{r.title}</span>
                      </td>
                      <td className="p-2 font-mono text-[color:var(--accent)]">{r.tier}</td>
                      <td className="max-w-[200px] truncate p-2 text-[color-mix(in_srgb,var(--color-accent-eggshell)_85%,transparent)]" title={r.pitchAngle}>
                        {r.pitchAngle}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="px-4 text-sm text-red-300">{error}</p>}
            <div className="flex justify-between gap-2 border-t border-[var(--color-border)] p-4">
              <button
                type="button"
                className="min-h-11 rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
                onClick={() => {
                  setStep("form");
                  setResults([]);
                }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={pending || selected.size === 0}
                className="btn-cta px-4 py-2 disabled:opacity-50"
                onClick={addSelected}
              >
                {pending ? "Saving…" : `Add selected (${selected.size})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
