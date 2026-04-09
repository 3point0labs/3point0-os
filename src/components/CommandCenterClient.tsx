"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postTeamNote } from "@/app/actions/team-notes";
import { draftOutreachEmail } from "@/app/actions/draft-email";
import { createClient } from "@/lib/supabase/client";
import { DraftEmailModal } from "./DraftEmailModal";
import { usePodcastWorkspace } from "./PodcastWorkspaceProvider";
import { StageBadge } from "./StageBadge";
import type { TeamNote, TeamNotePodcastTag, TeamNoteSender } from "@/lib/team-notes";
import type { Sponsor } from "@/lib/types";

const SENDER_KEY = "3point0.teamNoteSender";
const SENDERS: TeamNoteSender[] = ["Marquel", "Randy", "Team"];

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
    title.includes("ceo") ||
    title.includes("founder") ||
    title.includes("co-founder") ||
    title.includes("chief");
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

function tagBadgeClass(tag: TeamNotePodcastTag) {
  if (tag === "ONE54") return "bg-[rgba(201,168,124,0.18)] text-[var(--color-accent-primary)]";
  if (tag === "PRESSBOX") return "bg-[rgba(232,83,61,0.14)] text-[var(--color-accent-coral)]";
  return "bg-[rgba(138,138,122,0.15)] text-[var(--color-text-secondary)]";
}

function formatClock(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function CommandCenterClient({
  sponsors,
  initialNotes,
  meetings,
}: {
  sponsors: Sponsor[];
  initialNotes: TeamNote[];
  meetings: { company: string; startsAt: string; source: "calendar_mcp" | "sponsors" }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const { activePodcast, accent } = usePodcastWorkspace();
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);

  const [sender, setSender] = useState<TeamNoteSender>("Marquel");
  const [noteTag, setNoteTag] = useState<TeamNotePodcastTag>("ONE54");
  const [noteInput, setNoteInput] = useState("");
  const [pendingNote, startNoteTransition] = useTransition();
  const [liveStats, setLiveStats] = useState<{
    totalTargets: number;
    activePipeline: number;
    meetingsSet: number;
    dealsClosed: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    setClock(new Date());
    const t = window.setInterval(() => setClock(new Date()), 1000);
    const s = window.localStorage.getItem(SENDER_KEY);
    if (s === "Marquel" || s === "Randy" || s === "Team") setSender(s);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SENDER_KEY, sender);
  }, [sender]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) return;

    let cancelled = false;
    const supabase = createClient();

    async function fetchStats() {
      try {
        const [{ count: total }, { count: active }, { count: meetings }, { count: closed }] =
          await Promise.all([
            supabase.from("sponsors").select("*", { count: "exact", head: true }),
            supabase
              .from("sponsors")
              .select("*", { count: "exact", head: true })
              .not("stage", "in", '("New","Closed")'),
            supabase
              .from("sponsors")
              .select("*", { count: "exact", head: true })
              .eq("stage", "Negotiating"),
            supabase
              .from("sponsors")
              .select("*", { count: "exact", head: true })
              .eq("stage", "Closed"),
          ]);

        if (cancelled) return;
        setLiveStats({
          totalTargets: total ?? 0,
          activePipeline: active ?? 0,
          meetingsSet: meetings ?? 0,
          dealsClosed: closed ?? 0,
        });
      } catch (error) {
        console.error("Failed to fetch command center stats", error);
      }
    }

    void fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const workspaceSponsors = useMemo(
    () => sponsors.filter((s) => s.podcast === activePodcast),
    [activePodcast, sponsors]
  );

  const fallbackTotalTargets = workspaceSponsors.length;
  const fallbackActivePipeline = workspaceSponsors.filter(
    (s) => s.stage !== "Closed" && s.stage !== "New"
  ).length;
  const fallbackMeetingsSet = workspaceSponsors.filter((s) => s.stage === "Negotiating").length;
  const fallbackDealsClosed = workspaceSponsors.filter((s) => s.stage === "Closed").length;
  const totalTargets = liveStats?.totalTargets ?? fallbackTotalTargets;
  const activePipeline = liveStats?.activePipeline ?? fallbackActivePipeline;
  const meetingsSet = liveStats?.meetingsSet ?? fallbackMeetingsSet;
  const dealsClosed = liveStats?.dealsClosed ?? fallbackDealsClosed;

  const priorities = useMemo(() => {
    if (!mounted) {
      return workspaceSponsors
        .slice()
        .sort((a, b) => a.company.localeCompare(b.company))
        .slice(0, 5)
        .map((s) => ({
          s,
          since: null as number | null,
          bucket: 99,
          p1: 0,
          p2: 0,
          p3: 0,
          p4: 0,
        }));
    }
    const scored = workspaceSponsors
      .map((s) => {
        const since = daysSince(s.lastContactDate);
        const tier = (s.tier ?? "").toUpperCase();
        const notesPriority = /priority/i.test(s.notes ?? "");
        const p1 = tier === "S" && s.stage === "New" ? 1 : 0;
        const p2 = since !== null && since >= 7 ? 1 : 0;
        const p3 = tier === "A" && s.stage === "Contacted" ? 1 : 0;
        const p4 = notesPriority ? 1 : 0;
        const bucket = p1 ? 1 : p2 ? 2 : p3 ? 3 : p4 ? 4 : 99;
        return { s, since, bucket, p1, p2, p3, p4 };
      })
      .sort((a, b) => {
        if (a.bucket !== b.bucket) return a.bucket - b.bucket;
        const aSince = a.since ?? -1;
        const bSince = b.since ?? -1;
        return bSince - aSince;
      })
      .slice(0, 5);
    return scored;
  }, [workspaceSponsors, mounted]);

  const sortedNotes = useMemo(() => {
    return [...initialNotes].sort((a, b) =>
      String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
    );
  }, [initialNotes]);

  const clientNow = mounted ? new Date() : null;
  const isoDay = clientNow ? (clientNow.getDay() === 0 ? 7 : clientNow.getDay()) : 1;
  const hour = clientNow?.getHours() ?? 12;
  const greet = greetingPrefix(hour);

  const openPitch = (s: Sponsor) => {
    setDraft({
      ...initialDraft,
      open: true,
      title: `${s.contactName} · ${s.company}`,
      toEmail: s.email,
      subject: `${s.company} x ${s.podcast} sponsorship`,
      loading: true,
    });
    void draftOutreachEmail(s.id).then((res) => {
      setDraft((d) =>
        res.ok
          ? {
              ...d,
              loading: false,
              body: res.email,
              recommendedChannel: res.recommendedChannel,
              channelReason: res.reason,
            }
          : { ...d, loading: false, error: res.error }
      );
    });
  };

  const teamNotesSection = (
    <section className="mission-card flex flex-col p-4">
      <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-eggshell)]">
        Agent Alpha · Team notes
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Internal feed — not a full chat.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--color-text-secondary)]">You are:</span>
        {SENDERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSender(s)}
            className={`min-h-11 rounded border px-2.5 py-2 font-mono text-[11px] uppercase tracking-wider lg:min-h-0 lg:py-1 ${
              sender === s
                ? "border-[rgba(201,168,124,0.5)] bg-[rgba(201,168,124,0.1)] text-[var(--color-accent-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto p-1">
        {sortedNotes.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-secondary)]">No notes yet.</p>
        )}
        {sortedNotes.map((n) => (
          <div key={n.id} className="glass-card flex gap-2 rounded-lg p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] font-mono text-xs text-[var(--color-accent-eggshell)]">
              {(n.sender || "?")[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[var(--color-accent-eggshell)]">{n.sender}</span>
                <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${tagBadgeClass(n.podcast)}`}>
                  {n.podcast === "BOTH" ? "BOTH" : n.podcast}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">
                  {mounted
                    ? new Date(n.createdAt).toLocaleString()
                    : n.createdAt.slice(0, 16).replace("T", " ")}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
                {n.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--color-text-secondary)]">Tag:</span>
        {(["ONE54", "PRESSBOX", "BOTH"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setNoteTag(t)}
            className={`min-h-11 rounded border px-2 py-2 font-mono text-[10px] uppercase lg:min-h-0 lg:py-0.5 ${
              noteTag === t ? tagBadgeClass(t) + " border-current" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
            }`}
          >
            {t === "BOTH" ? "Both" : t}
          </button>
        ))}
      </div>

      <input
        type="text"
        className="mt-2 min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-accent-eggshell)] placeholder:text-[var(--color-text-secondary)]"
        placeholder="Type a note and press Enter…"
        value={noteInput}
        disabled={pendingNote}
        onChange={(e) => setNoteInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey) return;
          e.preventDefault();
          const text = noteInput.trim();
          if (!text || pendingNote) return;
          startNoteTransition(() => {
            void postTeamNote({ sender, body: text, podcast: noteTag }).then((res) => {
              if (res.ok) {
                setNoteInput("");
                router.refresh();
              }
            });
          });
        }}
      />
    </section>
  );

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
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider" style={{ color: accent }}>
              Today&apos;s focus: {mounted ? focusForDay(isoDay) : "—"}
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
              Mission status
            </p>
            <p className="mt-1 font-mono text-sm font-medium tracking-wide text-[var(--color-accent-primary)]">
              Operational
            </p>
            <p className="mt-2 font-mono text-xs tabular-nums text-[var(--color-accent-eggshell)]">
              {mounted && clock ? formatClock(clock) : "—"}
            </p>
          </div>
        </div>
        <div className="leather-progress mt-4 h-1 w-full max-w-md" aria-hidden />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_min(320px,32%)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4 lg:space-y-5">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Total targets" value={totalTargets} />
            <StatCard label="Active pipeline" value={activePipeline} />
            <StatCard label="Meetings set" value={meetingsSet} />
            <StatCard label="Deals closed" value={dealsClosed} />
          </section>

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
                    <tr
                      key={item.s.id}
                      className="border-b border-[var(--color-border)] text-[color-mix(in_srgb,var(--color-accent-eggshell)_90%,transparent)]"
                    >
                      <td className="px-2 py-2 font-mono text-xs text-[var(--color-accent-primary)]">{idx + 1}</td>
                      <td className="px-2 py-2 font-medium">{item.s.company}</td>
                      <td className="px-2 py-2 text-[var(--color-text-secondary)]">{item.s.category || "-"}</td>
                      <td className="px-2 py-2 font-mono text-xs uppercase text-[var(--color-accent-coral)]">
                        {localChannel(item.s)}
                      </td>
                      <td className="px-2 py-2">
                        <StageBadge stage={item.s.stage} />
                      </td>
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

          <section className="mission-card hidden p-4 lg:block">
            <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-eggshell)]">
              Today&apos;s Playbook
            </h2>
            <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
              {mounted ? playbookForDay(isoDay) : "—"}
            </p>
          </section>

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

          <details className="mission-card p-4 lg:hidden">
            <summary className="min-h-11 cursor-pointer list-none font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-accent-eggshell)] [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Today&apos;s Playbook
                <span className="text-[var(--color-text-secondary)]">▼</span>
              </span>
            </summary>
            <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--color-accent-eggshell)_88%,transparent)]">
              {mounted ? playbookForDay(isoDay) : "—"}
            </p>
          </details>

          <div className="lg:hidden">{teamNotesSection}</div>
        </div>

        <aside className="hidden min-w-0 lg:block">{teamNotesSection}</aside>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="mission-card stat-card-ring p-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums text-[var(--color-accent-primary)] sm:text-3xl [text-shadow:0_0_16px_rgba(201,168,124,0.25)]">
        {value}
      </p>
    </div>
  );
}
