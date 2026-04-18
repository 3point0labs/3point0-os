"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  addOpportunityToPipeline,
  analyzeEpisode,
  getLatestEpisodes,
  scanRecentEpisodes,
} from "@/app/actions/intelligence";
import type { IntelligenceEntry, PodcastWorkspace } from "@/lib/intelligence";
import type { ProductionEpisode } from "@/lib/production-calendar";
import { ProductionCalendarPanel } from "./ProductionCalendarPanel";
import { usePodcastWorkspace } from "./PodcastWorkspaceProvider";

type Episode = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  views: number;
  channelTitle: string;
};

type ScanOpportunityRow = {
  company: string;
  mentions: number;
  reasons: string[];
  category: string;
  urgency: string;
};

function urgencyStyle(u: string): string {
  if (u === "high")
    return "border-[rgba(var(--accent-rgb),0.45)] text-[color:var(--accent)]";
  if (u === "medium") return "border-[rgba(160,85,42,0.4)] text-[var(--color-accent-coral)]";
  return "border-[rgba(107,90,74,0.45)] text-[var(--color-text-secondary)]";
}

function ViewsBar({ episodes }: { episodes: Episode[] }) {
  if (episodes.length === 0) return null;
  const max = Math.max(...episodes.map((e) => e.views), 1);
  return (
    <div className="mt-3 space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        Views performance
      </p>
      {[...episodes]
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
        .map((ep) => (
          <div key={ep.id} className="flex items-center gap-2">
            <p className="w-32 shrink-0 truncate text-[10px] text-[var(--color-text-secondary)]">
              {ep.title}
            </p>
            <div className="flex-1 rounded-full bg-[var(--color-bg-primary)] h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[color:var(--accent)] transition-all duration-500"
                style={{ width: `${Math.round((ep.views / max) * 100)}%` }}
              />
            </div>
            <p className="w-12 shrink-0 text-right font-mono text-[10px] text-[var(--color-accent-eggshell)]">
              {ep.views >= 1000 ? `${(ep.views / 1000).toFixed(1)}k` : ep.views}
            </p>
          </div>
        ))}
    </div>
  );
}

function IntelPanel({
  activeReport,
  scanResult,
  totalTokenUsage,
  activePodcast,
}: {
  activeReport?: IntelligenceEntry;
  scanResult: ScanOpportunityRow[];
  totalTokenUsage: { input: number; output: number };
  activePodcast: PodcastWorkspace;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto p-4 text-sm">
      {!activeReport && (
        <p className="leading-relaxed text-[var(--color-text-secondary)]">
          Select an episode and press Analyze to scan for opportunities
        </p>
      )}
      {activeReport && (
        <div className="space-y-4">
          {activeReport.finding.guestName ? (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Guest</p>
              <p className="text-sm text-[var(--color-accent-eggshell)]">{activeReport.finding.guestName}</p>
            </div>
          ) : null}
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              Brand mentions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeReport.finding.brandMentions.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-[rgba(var(--accent-rgb),0.35)] bg-[rgba(var(--accent-rgb),0.08)] px-2 py-0.5 text-xs text-[color:var(--accent)]"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              Sponsor opportunities
            </p>
            <div className="space-y-2">
              {activeReport.finding.sponsorOpportunities.map((opp, idx) => (
                <div key={`${opp.company}-${idx}`} className={`glass-card rounded-lg border p-2 ${urgencyStyle(opp.urgency)}`}>
                  <p className="font-medium text-[var(--color-accent-eggshell)]">{opp.company}</p>
                  <p className="text-xs opacity-90">{opp.reason}</p>
                  <button
                    type="button"
                    className="btn-cta mt-2 min-h-9 w-auto px-3 py-2 text-[10px]"
                    onClick={() => {
                      void addOpportunityToPipeline({
                        podcast: activePodcast,
                        company: opp.company,
                        reason: opp.reason,
                        category: opp.category,
                      });
                    }}
                  >
                    Add to pipeline
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              Key topics
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeReport.finding.keyTopics.map((t) => (
                <span
                  key={t}
                  className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          {activeReport.finding.quotableStats.length > 0 && (
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Stats</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
                {activeReport.finding.quotableStats.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              Pitch insights
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
              {activeReport.finding.pitchInsights.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
          <p className="font-mono text-[10px] text-[var(--color-text-secondary)]">
            tokens in/out: {activeReport.tokenUsage.input}/{activeReport.tokenUsage.output} · analysis:{" "}
            {Math.round(activeReport.analysisTimeMs / 1000)}s
          </p>
        </div>
      )}

      {scanResult.length > 0 && (
        <div className="mt-6 border-t border-[var(--color-border)] pt-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
            Master opportunities
          </div>
          <div className="max-h-48 overflow-y-auto">
            <div className="space-y-2">
              {scanResult.map((o) => (
                <div key={o.company} className="glass-card rounded-lg p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-[var(--color-accent-eggshell)]">{o.company}</p>
                    <span className="shrink-0 font-mono text-[10px] text-[color:var(--accent)]">{o.mentions}×</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">{o.reasons[0]}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] text-[var(--color-text-secondary)]">
              aggregate tokens in/out: {totalTokenUsage.input}/{totalTokenUsage.output}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function IntelligenceClient({
  productionInitial = [],
}: {
  productionInitial?: ProductionEpisode[];
}) {
  const { activePodcast } = usePodcastWorkspace();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [channel, setChannel] = useState<{
    id: string;
    title: string;
    subscribers: number;
    handle: string;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, IntelligenceEntry>>({});
  const [loading, setLoading] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanOpportunityRow[]>([]);
  const [pendingScan, startScanTransition] = useTransition();
  const [pendingAnalyze, startAnalyzeTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [showScanConfirm, setShowScanConfirm] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setLoading(true);
    setSetupMessage(null);
    void getLatestEpisodes(activePodcast as PodcastWorkspace, 10).then((res) => {
      setLoading(false);
      if (!res.ok) {
        setSetupMessage(res.missingKey
          ? "Add your YouTube API key to .env.local to enable the episode feed"
          : res.error);
        setEpisodes([]);
        setChannel(null);
        setSelectedId(null);
        return;
      }
      setEpisodes(res.episodes);
      setChannel(res.channel);
      setSelectedId((prev) => {
        if (prev && res.episodes.some((e) => e.id === prev)) return prev;
        return res.episodes[0]?.id ?? null;
      });
    });
  }, [activePodcast]);

  const selected = useMemo(
    () => (selectedId ? episodes.find((e) => e.id === selectedId) ?? null : null),
    [episodes, selectedId]
  );
  const activeReport = selectedId ? reports[selectedId] : undefined;

  // Count uncached episodes for scan cost estimate
  const uncachedCount = useMemo(
    () => episodes.filter((e) => !reports[e.id]).length,
    [episodes, reports]
  );

  const totalTokenUsage = useMemo(() => {
    return Object.values(reports).reduce(
      (acc, r) => ({ input: acc.input + r.tokenUsage.input, output: acc.output + r.tokenUsage.output }),
      { input: 0, output: 0 }
    );
  }, [reports]);

  const divider = "var(--color-border)";

  const epList = episodes.map((ep) => {
    const isActive = ep.id === selectedId;
    const isCached = Boolean(reports[ep.id]);
    return (
      <button
        key={ep.id}
        type="button"
        onClick={() => setSelectedId(ep.id)}
        className={`shrink-0 snap-start text-left transition-colors lg:w-full ${
          isActive ? "ring-2 ring-[var(--color-accent-primary)] ring-offset-2 ring-offset-[var(--color-bg-primary)]" : ""
        }`}
      >
        <div className="glass-card flex w-[140px] flex-col overflow-hidden rounded-lg lg:w-full lg:flex-row lg:gap-3 lg:p-3">
          <div className="relative lg:shrink-0">
            <img src={ep.thumbnail} alt="" className="aspect-video w-full object-cover lg:h-[45px] lg:w-[80px] lg:rounded" />
            {isCached && (
              <span className="absolute bottom-1 right-1 rounded bg-green-600/80 px-1 py-0.5 font-mono text-[8px] uppercase text-white">
                ✓ cached
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 p-2 lg:p-0">
            <p className={`line-clamp-2 text-xs font-medium leading-snug lg:text-sm ${
              isActive ? "text-[var(--color-accent-primary)]" : "text-[var(--color-accent-eggshell)]"
            }`}>
              {ep.title}
            </p>
            <p className="mt-1 text-[10px] text-[var(--color-text-secondary)] lg:text-xs">
              {mounted ? new Date(ep.publishedAt).toLocaleDateString() : ep.publishedAt.slice(0, 10)}
            </p>
          </div>
        </div>
      </button>
    );
  });

  const playerBlock = selected ? (
    <>
      <div className="relative w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-black aspect-video lg:aspect-auto lg:min-h-[400px]">
        <iframe
          title={selected.title}
          src={`https://www.youtube.com/embed/${selected.id}?rel=0`}
          className="absolute inset-0 h-full w-full lg:relative lg:min-h-[400px]"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <h2 className="mt-4 line-clamp-4 font-mono text-base leading-snug text-[var(--color-accent-eggshell)]">{selected.title}</h2>
      <p className="mt-2 font-mono text-xs text-[var(--color-text-secondary)]">
        {mounted ? selected.views.toLocaleString() : selected.views.toString()} views ·{" "}
        {mounted ? new Date(selected.publishedAt).toLocaleString() : selected.publishedAt.slice(0, 19).replace("T", " ")}
        {reports[selected.id] && (
          <span className="ml-2 rounded bg-green-600/20 px-1.5 py-0.5 text-green-400 text-[10px] font-mono">
            ✓ analyzed
          </span>
        )}
      </p>
      <button
        type="button"
        disabled={pendingAnalyze}
        onClick={() =>
          startAnalyzeTransition(() => {
            void analyzeEpisode(selected.id, activePodcast as PodcastWorkspace, selected.title).then((res) => {
              if (!res.ok) return;
              setReports((prev) => ({ ...prev, [selected.id]: res.entry }));
            });
          })
        }
        className="btn-cta mt-4 w-full py-3 text-sm tracking-[0.12em]"
      >
        {pendingAnalyze
          ? "ANALYZING…"
          : reports[selected.id]
          ? "RE-ANALYZE EPISODE"
          : "ANALYZE EPISODE"}
      </button>
      {reports[selected.id] && (
        <p className="mt-1 text-center font-mono text-[10px] text-[var(--color-text-secondary)]">
          Using cached result — no tokens used
        </p>
      )}
    </>
  ) : (
    <div className="glass-card flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center lg:min-h-[400px]">
      <p className="font-mono text-sm text-[var(--color-text-secondary)]">
        {loading ? "Loading episode…" : "No episodes available"}
      </p>
    </div>
  );

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden">
      <section className="mission-card px-4 py-4 lg:px-5 lg:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-mono text-lg uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)] lg:text-xl">
            Broadcast Room
          </h1>
          <div className="relative">
            {showScanConfirm ? (
              <div className="flex items-center gap-2 rounded-md border border-[rgba(160,85,42,0.5)] bg-[rgba(160,85,42,0.1)] px-3 py-2">
                <span className="font-mono text-xs text-[var(--color-accent-coral)]">
                  {uncachedCount} new episode{uncachedCount !== 1 ? "s" : ""} — run Claude on all?
                </span>
                <button
                  type="button"
                  className="font-mono text-xs text-green-400 hover:text-green-300"
                  onClick={() => {
                    setShowScanConfirm(false);
                    startScanTransition(() => {
                      void scanRecentEpisodes(activePodcast as PodcastWorkspace).then((res) => {
                        if (!res.ok) return;
                        const nextReports: Record<string, IntelligenceEntry> = {};
                        for (const entry of res.analyzed) nextReports[entry.videoId] = entry;
                        setReports((prev) => ({ ...prev, ...nextReports }));
                        setScanResult(res.opportunities);
                      });
                    });
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="font-mono text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-eggshell)]"
                  onClick={() => setShowScanConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={pendingScan || loading || episodes.length === 0}
                onClick={() => {
                  if (uncachedCount === 0) {
                    // All cached, run anyway
                    startScanTransition(() => {
                      void scanRecentEpisodes(activePodcast as PodcastWorkspace).then((res) => {
                        if (!res.ok) return;
                        const nextReports: Record<string, IntelligenceEntry> = {};
                        for (const entry of res.analyzed) nextReports[entry.videoId] = entry;
                        setReports((prev) => ({ ...prev, ...nextReports }));
                        setScanResult(res.opportunities);
                      });
                    });
                  } else {
                    setShowScanConfirm(true);
                  }
                }}
                className="min-h-11 rounded-md border border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.1)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[color:var(--accent)] disabled:opacity-50"
              >
                {pendingScan ? "Scanning…" : `Scan all · ${uncachedCount} new`}
              </button>
            )}
          </div>
        </div>
        {pendingScan && (
          <p className="mt-2 animate-pulse font-mono text-xs uppercase tracking-wider text-[var(--color-accent-coral)]">
            SCANNING...
          </p>
        )}
        {channel && (
          <p className="mt-2 font-mono text-xs text-[var(--color-text-secondary)]">
            Channel verified: <span className="text-[var(--color-accent-eggshell)]">{channel.title}</span> ({channel.handle}) ·{" "}
            {mounted ? channel.subscribers.toLocaleString() : channel.subscribers.toString()} subscribers
          </p>
        )}
        {setupMessage && <p className="mt-2 text-sm text-[var(--color-accent-coral)]">{setupMessage}</p>}
        {mounted && episodes.length > 0 && <ViewsBar episodes={episodes} />}
      </section>

      {/* Mobile */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Episodes</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory px-1">
            {episodes.length === 0 && !loading && (
              <p className="p-3 text-sm text-[var(--color-text-secondary)]">No episodes loaded.</p>
            )}
            {epList}
          </div>
        </div>
        <section className="min-w-0 px-0">{playerBlock}</section>
        <section className="mission-card min-h-[220px] overflow-hidden p-0">
          <IntelPanel activeReport={activeReport} scanResult={scanResult} totalTokenUsage={totalTokenUsage} activePodcast={activePodcast as PodcastWorkspace} />
        </section>
        <ProductionCalendarPanel initial={productionInitial} />
      </div>

      {/* Desktop 3-column */}
      <div
        className="hidden min-h-0 w-full min-w-0 lg:grid"
        style={{ gridTemplateColumns: "25% 50% 25%", height: "calc(100vh - 120px)", gap: 0 }}
      >
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--color-bg-secondary)]" style={{ borderRight: `1px solid ${divider}` }}>
          <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
            Episodes · last 10
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-scroll p-2">
            {episodes.length === 0 && !loading && (
              <p className="p-3 text-xs text-[var(--color-text-secondary)]">No episodes loaded.</p>
            )}
            {episodes.map((ep) => {
              const isActive = ep.id === selectedId;
              const isCached = Boolean(reports[ep.id]);
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => setSelectedId(ep.id)}
                  className={`glass-card flex w-full gap-3 rounded-lg p-3 text-left transition-colors ${
                    isActive ? "ring-1 ring-[rgba(139,69,19,0.45)]" : "hover:brightness-110"
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={ep.thumbnail} alt="" className="h-[45px] w-[80px] rounded object-cover" />
                    {isCached && (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-green-600/80 px-1 font-mono text-[8px] text-white">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`line-clamp-2 text-sm font-medium leading-snug ${
                      isActive ? "text-[var(--color-accent-primary)]" : "text-[var(--color-accent-eggshell)]"
                    }`}>
                      {ep.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {mounted ? new Date(ep.publishedAt).toLocaleDateString() : ep.publishedAt.slice(0, 10)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="max-h-[min(48vh,420px)] shrink-0 overflow-y-auto border-t border-[var(--color-border)]">
            <ProductionCalendarPanel initial={productionInitial} />
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-[var(--color-bg-primary)] p-4">{playerBlock}</section>

        <aside className="flex min-h-0 min-w-0 flex-col overflow-y-scroll bg-[var(--color-bg-secondary)]" style={{ borderLeft: `1px solid ${divider}` }}>
          <IntelPanel activeReport={activeReport} scanResult={scanResult} totalTokenUsage={totalTokenUsage} activePodcast={activePodcast as PodcastWorkspace} />
        </aside>
      </div>
    </div>
  );
}