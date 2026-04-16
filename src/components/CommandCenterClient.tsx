"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { draftOutreachEmail } from "@/app/actions/draft-email";
import { getPriorityTargets } from "@/app/actions/stats";
import { DraftEmailModal } from "./DraftEmailModal";
import { TodoList } from "./TodoList";
import { PodcastInbox } from "./PodcastInbox";
import { usePodcastWorkspace } from "./PodcastWorkspaceProvider";
import { StageBadge } from "./StageBadge";
import type { Sponsor } from "@/lib/types";

type DraftState = {
  open: boolean;
  title: string;
  body: string;
  toEmail: string;
  subject: string;
  attachDeck: boolean;
  loading: boolean;
  error: string | null;
  recommendedChannel: string;
  channelReason: string;
};

type HealthService = {
  status: "ok" | "warning" | "error";
  latency_ms: number;
  error?: string;
};

type HealthState = {
  anthropic: HealthService;
  supabase: HealthService;
  rocketreach: HealthService;
  youtube: HealthService;
  gmail: HealthService;
};

const initialDraft: DraftState = {
  open: false,
  title: "",
  body: "",
  toEmail: "",
  subject: "",
  attachDeck: false,
  loading: false,
  error: null,
  recommendedChannel: "",
  channelReason: "",
};

function daysSince(dateStr: string) {
  if (!dateStr) return null;
  const then = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function focusForDay(day: number) {
  const map: Record<number, string> = {
    1: "New outreach",
    2: "Follow-ups",
    3: "Warm touches",
    4: "Meetings",
    5: "Pipeline review",
  };
  return map[day] ?? "Strategic planning";
}

function playbookForDay(day: number) {
  const map: Record<number, string> = {
    1: "Monday: New outreach — hit your fresh Tier S targets",
    2: "Tuesday: 48h follow-ups — no reply after 2 days",
    3: "Wednesday: Warm touches — re-open soft conversations",
    4: "Thursday: Meetings — push high-intent contacts forward",
    5: "Friday: Pipeline review — close loops and prep next week",
  };
  return map[day] ?? "Weekend: clean CRM notes and prep next week's targets";
}

function localChannel(s: Sponsor) {
  const title = (s.contact_title ?? "").toLowerCase();
  const email = s.email.toLowerCase();
  const hasLinkedIn = Boolean(s.linkedin_url);
  const tier = (s.tier ?? "").toUpperCase();
  const isFounderOrCxo =
    title.includes("ceo") || title.includes("founder") ||
    title.includes("co-founder") || title.includes("chief");
  const genericEmail = email.startsWith("partnerships@") || email.startsWith("info@");
  if (tier === "S" && hasLinkedIn && email) return "combination";
  if (isFounderOrCxo && hasLinkedIn) return "linkedin dm";
  if (genericEmail) return "website inquiry";
  return "email";
}

function greetingPrefix(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatClock(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

export function CommandCenterClient({
  sponsors,
  initialNotes,
  meetings,
}: {
  sponsors: Sponsor[];
  initialNotes: unknown[];
  meetings: { company: string; startsAt: string; source: "calendar_mcp" | "sponsors" }[];
}) {
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const { activePodcast, accent } = usePodcastWorkspace();
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [priorityRows, setPriorityRows] = useState<Sponsor[]>([]);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthFetchError, setHealthFetchError] = useState<string | null>(null);
  const [activeHealthError, setActiveHealthError] = useState<keyof HealthState | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    setClock(new Date());
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void getPriorityTargets().then(setPriorityRows);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchHealth = async () => {
      setHealthLoading(true);
      setHealthFetchError(null);
      try {
        const res = await fetch("/api/health", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = (await res.json()) as HealthState | { error?: string };
        if (!alive) return;
        if (!res.ok) {
          setHealth(null);
          setHealthFetchError(
            typeof (data as { error?: string }).error === "string"
              ? (data as { error: string }).error
              : `Health check failed (${res.status})`
          );
        } else if ("error" in data && data.error) {
          setHealth(null);
          setHealthFetchError(String(data.error));
        } else {
          setHealth(data as HealthState);
        }
      } catch (e) {
        if (!alive) return;
        setHealth(null);
        setHealthFetchError(e instanceof Error ? e.message : "Health check network error");
      } finally {
        if (alive) setHealthLoading(false);
      }
    };
    void fetchHealth();
    const id = window.setInterval(() => void fetchHealth(), 60000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const healthOrder: Array<{ key: keyof HealthState; label: string }> = [
    { key: "anthropic", label: "Anthropic" },
    { key: "supabase", label: "Supabase" },
    { key: "rocketreach", label: "RocketReach" },
    { key: "youtube", label: "YouTube" },
    { key: "gmail", label: "Gmail" },
  ];

  const workspaceSponsors = useMemo(
    () => sponsors.filter((s) => s.podcast === activePodcast),
    [activePodcast, sponsors]
  );

  const priorities = useMemo(() => {
    if (priorityRows.length > 0) {
      return priorityRows.slice(0, 5).map((s) => ({
        s, since: daysSince(s.lastContactDate), bucket: 1,
      }));
    }
    if (!mounted) {
      return workspaceSponsors.slice()
        .sort((a, b) => a.company.localeCompare(b.company))
        .slice(0, 5)
        .map((s) => ({ s, since: null as number | null, bucket: 99 }));
    }
    return workspaceSponsors
      .map((s) => {
        const since = daysSince(s.lastContactDate);
        const tier = (s.tier ?? "").toUpperCase();
        const p1 = tier === "S" && s.stage === "New" ? 1 : 0;
        const p2 = since !== null && since >= 7 ? 1 : 0;
        const p3 = tier === "A" && s.stage === "Contacted" ? 1 : 0;
        const bucket = p1 ? 1 : p2 ? 2 : p3 ? 3 : 99;
        return { s, since, bucket };
      })
      .sort((a, b) => a.bucket !== b.bucket
        ? a.bucket - b.bucket
        : (b.since ?? -1) - (a.since ?? -1))
      .slice(0, 5);
  }, [workspaceSponsors, mounted, priorityRows]);

  const clientNow = mounted ? new Date() : null;
  const isoDay = clientNow ? (clientNow.getDay() === 0 ? 7 : clientNow.getDay()) : 1;
  const hour = clientNow?.getHours() ?? 12;
  const greet = greetingPrefix(hour);

  const openPitch = (s: Sponsor) => {
    setDraft({
      ...initialDraft, open: true,
      title: `${s.contactName} · ${s.company}`,
      toEmail: s.email,
      subject: `${s.company} x ${s.podcast} sponsorship`,
      loading: true,
    });
    void draftOutreachEmail(s.id).then((res) => {
      setDraft((d) =>
        res.ok
          ? { ...d, loading: false, body: res.email, recommendedChannel: res.recommendedChannel, channelReason: res.reason }
          : { ...d, loading: false, error: res.error }
      );
    });
  };

  return (
    <div className="w-full min-w-0 space-y-4 lg:space-y-5">
      <DraftEmailModal
        open={draft.open}
        onClose={() => setDraft(initialDraft)}
        title={draft.title}
        body={draft.body}
        toEmail={draft.toEmail}
        subject={draft.subject}
        recommendedChannel={draft.recommendedChannel}
        channelReason={draft.channelReason}
        attachDeck={draft.attachDeck}
        onToggleAttachDeck={(v) => setDraft((d) => ({ ...d, attachDeck: v }))}
        loading={draft.loading}
        error={draft.error}
      />

      {/* Header */}
      <header className="mission-card px-4 py-4 lg:px-5 lg:py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
              Command Center
            </p>
            <h1 className="mt-1 font-mono text-xl leading-tight text-[var(--color-accent-eggshell)] sm:text-2xl">
              {greet},{" "}
              <span className="text-[var(--color-accent-coral)]">Marquel</span>
            </h1>
            <p className="mt-1 font-mono text-sm" style={{ color: accent }}>
              {activePodcast === "One54"
                ? "One54 Africa — Outreach Command Center"
                : "Pressbox Chronicles — Outreach Command Center"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {clientNow
                ? clientNow.toLocaleDateString(undefined, {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  })
                : "—"}
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider" style={{ color: accent }}>
              Today&apos;s focus: {mounted ? focusForDay(isoDay) : "—"}
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">System health</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 sm:justify-end">
              {healthOrder.map(({ key, label }) => {
                const service = health?.[key];
                const status = healthLoading
                  ? "checking"
                  : service?.status === "ok"
                  ? "ok"
                  : service?.status === "warning"
                  ? "warning"
                  : "error";
                const dotClass =
                  status === "ok"
                    ? "bg-emerald-400"
                    : status === "warning"
                    ? "bg-amber-400"
                    : status === "error"
                    ? "bg-[var(--color-accent-coral)]"
                    : "bg-[var(--color-accent-primary)] animate-pulse";
                const chipLabel = key === "gmail" && status === "warning" ? "Auth Required" : label
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (status === "error") {
                        setActiveHealthError((prev) => (prev === key ? null : key));
                      } else {
                        setActiveHealthError(null);
                      }
                    }}
                    className="relative flex items-center gap-1.5 rounded border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]"
                  >
                    <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                    <span>{chipLabel}</span>
                  </button>
                );
              })}
            </div>
            {activeHealthError && (health?.[activeHealthError]?.error || healthFetchError) && (
              <p className="mt-2 max-w-[320px] text-xs text-[var(--color-accent-coral)] sm:ml-auto">
                {health?.[activeHealthError]?.error ?? healthFetchError}
              </p>
            )}
            <p className="mt-2 font-mono text-xs tabular-nums text-[var(--color-accent-eggshell)]">
              {mounted && clock ? formatClock(clock) : "—"}
            </p>
          </div>
        </div>
        <div className="leather-progress mt-4 h-1 w-full max-w-md" aria-hidden />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_min(320px,32%)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4 lg:space-y-5">

          {/* Playbook */}
          <section className="mission-card p-4">
            <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-eggshell)]">
              Today&apos;s Playbook
            </h2>
            <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
              {mounted ? playbookForDay(isoDay) : "—"}
            </p>
          </section>

          {/* Meetings */}
          <section className="mission-card p-4">
            <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-eggshell)]">
              Meetings
            </h2>
            <div className="mt-3 space-y-2">
              {meetings.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">No upcoming sponsor calls.</p>
              )}
              {meetings.map((m, idx) => (
                <div key={`${m.company}-${m.startsAt}-${idx}`} className="glass-card rounded-lg p-3">
                  <p className="font-medium text-[var(--color-accent-eggshell)]">{m.company}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {new Date(m.startsAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Priority Targets */}
          <section className="mission-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-eggshell)]">
                Today&apos;s Priority Targets
              </h2>
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Company</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Channel</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {priorities.map((item, idx) => (
                    <tr key={item.s.id} className="border-b border-[var(--color-border)] text-[color-mix(in_srgb,var(--color-accent-eggshell)_90%,transparent)]">
                      <td className="px-2 py-2 font-mono text-xs text-[var(--color-accent-primary)]">{idx + 1}</td>
                      <td className="px-2 py-2 font-medium">{item.s.company}</td>
                      <td className="px-2 py-2 text-[var(--color-text-secondary)]">{item.s.category || "-"}</td>
                      <td className="px-2 py-2 font-mono text-xs uppercase text-[var(--color-accent-coral)]">
                        {localChannel(item.s)}
                      </td>
                      <td className="px-2 py-2"><StageBadge stage={item.s.stage} /></td>
                      <td className="px-2 py-2 text-right">
                        <button type="button" className="btn-cta" onClick={() => openPitch(item.s)}>
                          Pitch →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 lg:hidden">
              {priorities.map((item) => (
                <div key={item.s.id} className="glass-card rounded-lg p-3">
                  <p className="font-medium text-[var(--color-accent-eggshell)]">{item.s.company}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.s.contactName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded border border-[rgba(232,83,61,0.4)] bg-[rgba(232,83,61,0.1)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--color-accent-coral)]">
                      {localChannel(item.s)}
                    </span>
                    <StageBadge stage={item.s.stage} />
                  </div>
                  <button type="button" className="btn-cta mt-3 w-full" onClick={() => openPitch(item.s)}>
                    Pitch →
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Mobile sidebar */}
          <div className="space-y-4 lg:hidden">
            <TodoList />
            <PodcastInbox />
          </div>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden min-w-0 space-y-4 lg:block">
          <TodoList />
          <PodcastInbox />
        </aside>
      </div>
    </div>
  );
}