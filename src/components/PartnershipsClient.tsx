"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getPartnershipStats } from "@/app/actions/stats";
import { getOutreachQueue, type QueueItem } from "@/app/actions/outreach-queue";
import type { PipelineSuggestion } from "@/lib/suggestions";
import type { Sponsor } from "@/lib/types";
import { PartnershipsSuggestions } from "./PartnershipsSuggestions";
import { PartnershipsScopeFilter, SponsorsClient } from "./SponsorsClient";

const SCOPE_OPTIONS: { key: PartnershipsScopeFilter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "One54", label: "ONE54" },
  { key: "Pressbox Chronicles", label: "PRESSBOX" },
];

function channelBadge(channel: string) {
  if (channel === "COMBINATION")
    return "border-[rgba(139,69,19,0.5)] bg-[rgba(139,69,19,0.12)] text-[var(--color-accent-primary)]";
  if (channel === "LINKEDIN DM")
    return "border-[rgba(0,119,181,0.5)] bg-[rgba(0,119,181,0.12)] text-[#0077b5]";
  return "border-[rgba(160,85,42,0.4)] bg-[rgba(160,85,42,0.1)] text-[var(--color-accent-coral)]";
}

function OutreachQueue({ podcast }: { podcast: "One54" | "Pressbox Chronicles" }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLoading(true);
    setError(null);
    setItems([]);
    setDismissed(new Set());
    startTransition(() => {
      void getOutreachQueue(podcast).then((res) => {
        setLoading(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setItems(res.items);
        if (res.items.length > 0) setExpanded(res.items[0].sponsor.id);
      });
    });
  }, [podcast]);

  const visible = items.filter((i) => !dismissed.has(i.sponsor.id));

  const copyDraft = (item: QueueItem) => {
    void navigator.clipboard.writeText(item.draft).then(() => {
      setCopied(item.sponsor.id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <section className="mission-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)]">
            Outreach Queue
          </h2>
          {!loading && visible.length > 0 && (
            <span className="rounded-full bg-[rgba(160,85,42,0.2)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-accent-coral)]">
              {visible.length}
            </span>
          )}
        </div>
        <p className="font-mono text-[10px] text-[var(--color-text-secondary)]">
          Haiku · minimal tokens
        </p>
      </div>

      {loading && (
        <p className="animate-pulse font-mono text-xs uppercase tracking-wider text-[var(--color-accent-coral)]">
          Building queue...
        </p>
      )}
      {error && (
        <p className="text-xs text-[var(--color-accent-coral)]">{error}</p>
      )}
      {!loading && visible.length === 0 && !error && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Queue clear — no overdue or uncontacted priority targets.
        </p>
      )}

      <div className="space-y-2">
        {visible.map((item) => {
          const isOpen = expanded === item.sponsor.id;
          return (
            <div key={item.sponsor.id} className="glass-card rounded-lg overflow-hidden">
              {/* Header row */}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : item.sponsor.id)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--color-accent-eggshell)]">
                      {item.sponsor.company}
                    </p>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${channelBadge(item.channel)}`}
                    >
                      {item.channel}
                    </span>
                    {item.cached && (
                      <span className="rounded bg-green-600/20 px-1.5 py-0.5 font-mono text-[9px] text-green-400">
                        cached
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {item.sponsor.contactName}
                    {item.sponsor.contact_title
                      ? ` · ${item.sponsor.contact_title}`
                      : ""}
                    {" · "}
                    <span className="text-[var(--color-accent-coral)]">
                      {item.reason}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 text-[var(--color-text-secondary)]">
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>

              {/* Expanded draft */}
              {isOpen && (
                <div className="border-t border-[var(--color-border)] p-3">
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
                    {item.draft}
                  </pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyDraft(item)}
                      className="min-h-9 rounded-md border border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.1)] px-3 font-mono text-[10px] uppercase tracking-wider text-[color:var(--accent)]"
                    >
                      {copied === item.sponsor.id ? "✓ Copied" : "Copy draft"}
                    </button>
                    {item.sponsor.linkedin_url && (
                      <a
                        href={item.sponsor.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-9 rounded-md border border-[rgba(0,119,181,0.4)] bg-[rgba(0,119,181,0.08)] px-3 font-mono text-[10px] uppercase tracking-wider text-[#0077b5]"
                      >
                        Open LinkedIn
                      </a>
                    )}
                    {item.sponsor.email && (
                      <a
                        href={`mailto:${item.sponsor.email}?subject=${encodeURIComponent(
                          `${item.sponsor.company} x ${podcast} sponsorship`
                        )}&body=${encodeURIComponent(item.draft)}`}
                        className="min-h-9 rounded-md border border-[rgba(160,85,42,0.4)] bg-[rgba(160,85,42,0.1)] px-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-coral)]"
                      >
                        Open in Mail
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setDismissed((prev) => new Set([...prev, item.sponsor.id]))
                      }
                      className="min-h-9 rounded-md border border-[var(--color-border)] px-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

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

  // Determine active podcast for queue
  const queuePodcast: "One54" | "Pressbox Chronicles" =
    scope === "Pressbox Chronicles" ? "Pressbox Chronicles" : "One54";

  useEffect(() => {
    let cancelled = false;
    void getPartnershipStats(scope).then((next) => {
      if (!cancelled) setStats(next);
    });
    return () => { cancelled = true; };
  }, [scope]);

  const statsSource = useMemo(() => {
    if (scope === "all") return initial;
    return initial.filter((s) => s.podcast === scope);
  }, [initial, scope]);

  const totalContacts = stats?.total ?? statsSource.length;
  const activePipeline =
    stats?.active ??
    statsSource.filter((s) => s.stage !== "Closed" && s.stage !== "New").length;
  const inNegotiation =
    stats?.meetings ?? statsSource.filter((s) => s.stage === "Negotiating").length;
  const closedDeals =
    stats?.closed ?? statsSource.filter((s) => s.stage === "Closed").length;

  return (
    <>
      <PartnershipsSuggestions initial={suggestions} />

      {/* Stats */}
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

      {/* Outreach Queue — the autonomous workflow */}
      <OutreachQueue podcast={queuePodcast} />

      {/* Full kanban */}
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