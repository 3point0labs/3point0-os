"use client";

import { useEffect, useMemo, useState } from "react";
import { getPartnershipStats } from "@/app/actions/stats";
import type { PipelineSuggestion } from "@/lib/suggestions";
import type { Sponsor } from "@/lib/types";
import { PartnershipsSuggestions } from "./PartnershipsSuggestions";
import { PartnershipsScopeFilter, SponsorsClient } from "./SponsorsClient";

const SCOPE_OPTIONS: { key: PartnershipsScopeFilter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "One54", label: "ONE54" },
  { key: "Pressbox Chronicles", label: "PRESSBOX" },
];

export function PartnershipsClient({
  initial,
  suggestions,
}: {
  initial: Sponsor[];
  suggestions: PipelineSuggestion[];
}) {
  const [scope, setScope] = useState<PartnershipsScopeFilter>("all");
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    meetings: number;
    closed: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPartnershipStats(scope).then((next) => {
      if (!cancelled) setStats(next);
    });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const statsSource = useMemo(() => {
    if (scope === "all") return initial;
    return initial.filter((s) => s.podcast === scope);
  }, [initial, scope]);

  const totalContacts = stats?.total ?? statsSource.length;
  const activePipeline = stats?.active ?? statsSource.filter((s) => s.stage !== "Closed" && s.stage !== "New").length;
  const inNegotiation = stats?.meetings ?? statsSource.filter((s) => s.stage === "Negotiating").length;
  const closedDeals = stats?.closed ?? statsSource.filter((s) => s.stage === "Closed").length;

  return (
    <>
      <PartnershipsSuggestions initial={suggestions} />

      <section className="mission-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
            Partnership pipeline
          </h2>
          <div className="flex flex-wrap gap-2">
            {SCOPE_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setScope(o.key)}
                className={`min-h-11 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wider transition lg:min-h-0 lg:py-1.5 ${
                  scope === o.key
                    ? "border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.1)] text-[color:var(--accent)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total contacts" value={totalContacts} />
          <Stat label="Active pipeline" value={activePipeline} />
          <Stat label="In negotiation" value={inNegotiation} />
          <Stat label="Closed deals" value={closedDeals} />
        </div>
      </section>

      <SponsorsClient initial={initial} partnershipsScope={scope} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card rounded-lg p-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p className="mono-glow mt-2 text-3xl leading-none">{value}</p>
    </div>
  );
}