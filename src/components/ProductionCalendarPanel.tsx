"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addProductionEpisode } from "@/app/actions/production-calendar";
import type { ProductionEpisode, ProductionStatus } from "@/lib/production-calendar";

const STATUSES: ProductionStatus[] = ["Scheduled", "Recording", "Editing", "Published"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusClass(s: ProductionStatus) {
  if (s === "Published") return "text-[var(--color-accent-primary)] border-[rgba(201,168,124,0.4)]";
  if (s === "Recording") return "text-[#f59e0b] border-[#f59e0b44]";
  if (s === "Editing") return "text-[#a78bfa] border-[#a78bfa44]";
  return "text-[var(--color-text-secondary)] border-[var(--color-border)]";
}

export function ProductionCalendarPanel({ initial }: { initial: ProductionEpisode[] }) {
  const router = useRouter();
  const [clientReady, setClientReady] = useState(false);
  const [view, setView] = useState({ y: 2000, m: 0 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    guestName: "",
    recordDate: "2000-01-01",
    publishDate: "2000-01-01",
    podcast: "One54" as "One54" | "Pressbox Chronicles",
    status: "Scheduled" as ProductionStatus,
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const n = new Date();
    setView({ y: n.getFullYear(), m: n.getMonth() });
    const ymd = toYmd(n);
    setForm((f) => ({ ...f, recordDate: ymd, publishDate: ymd }));
    setClientReady(true);
  }, []);

  const upcoming = useMemo(() => {
    if (!clientReady) return [];
    const today = toYmd(new Date());
    return [...initial]
      .filter((e) => e.publishDate >= today)
      .sort((a, b) => a.publishDate.localeCompare(b.publishDate))
      .slice(0, 5);
  }, [initial, clientReady]);

  const daysWithMarks = useMemo(() => {
    const set = new Set<string>();
    for (const e of initial) {
      if (e.recordDate) set.add(e.recordDate.slice(0, 10));
      if (e.publishDate) set.add(e.publishDate.slice(0, 10));
    }
    return set;
  }, [initial]);

  const { gridDays, padStart } = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lastDay = new Date(view.y, view.m + 1, 0).getDate();
    const pad = (first.getDay() + 6) % 7;
    const days: number[] = [];
    for (let d = 1; d <= lastDay; d += 1) days.push(d);
    return { gridDays: days, padStart: pad };
  }, [view.y, view.m]);

  const monthLabel = `${MONTH_NAMES[view.m]} ${view.y}`;

  return (
    <div className="glass-card border-t border-[var(--color-border)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-2 py-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Production calendar</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-9 rounded border border-[rgba(201,168,124,0.4)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-primary)] hover:bg-[rgba(201,168,124,0.1)]"
        >
          + Add episode
        </button>
      </div>

      <div className="p-2">
        {!clientReady ? (
          <p className="py-4 text-center font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Loading…</p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                className="font-mono text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-eggshell)]"
                onClick={() =>
                  setView((v) => {
                    const nm = v.m - 1;
                    if (nm < 0) return { y: v.y - 1, m: 11 };
                    return { y: v.y, m: nm };
                  })
                }
              >
                ←
              </button>
              <span className="font-mono text-[11px] text-[var(--color-accent-eggshell)]">{monthLabel}</span>
              <button
                type="button"
                className="font-mono text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-eggshell)]"
                onClick={() =>
                  setView((v) => {
                    const nm = v.m + 1;
                    if (nm > 11) return { y: v.y + 1, m: 0 };
                    return { y: v.y, m: nm };
                  })
                }
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center font-mono text-[9px] uppercase text-[var(--color-text-secondary)]">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-0.5">
              {Array.from({ length: padStart }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {gridDays.map((day) => {
                const ymd = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const mark = daysWithMarks.has(ymd);
                return (
                  <div
                    key={ymd}
                    className="flex aspect-square flex-col items-center justify-center rounded border border-transparent text-[11px] text-[color-mix(in_srgb,var(--color-accent-eggshell)_82%,transparent)]"
                    title={ymd}
                  >
                    <span>{day}</span>
                    {mark && <span className="mt-0.5 h-1 w-1 rounded-full bg-[var(--color-accent-primary)]" />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] px-2 py-2">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Next 5 upcoming</p>
        <ul className="space-y-2">
          {!clientReady && <li className="text-xs text-[var(--color-text-secondary)]">…</li>}
          {clientReady && upcoming.length === 0 && (
            <li className="text-xs text-[var(--color-text-secondary)]">No scheduled publishes.</li>
          )}
          {upcoming.map((e) => (
            <li key={e.id} className="glass-card rounded-lg px-2 py-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-1">
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                    e.podcast === "One54"
                      ? "bg-[rgba(201,168,124,0.18)] text-[var(--color-accent-primary)]"
                      : "bg-[rgba(232,83,61,0.14)] text-[var(--color-accent-coral)]"
                  }`}
                >
                  {e.podcast === "One54" ? "ONE54" : "PRESSBOX"}
                </span>
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${statusClass(e.status)}`}>
                  {e.status}
                </span>
              </div>
              <p className="mt-1 font-medium text-[var(--color-accent-eggshell)]">{e.guestName || "TBD"}</p>
              <p className="line-clamp-1 text-[11px] text-[var(--color-text-secondary)]">{e.title}</p>
              <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]">
                Record {e.recordDate} · Pub {e.publishDate}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="mission-card max-h-[90vh] w-full max-w-md overflow-y-auto p-4">
            <h3 className="font-mono text-sm uppercase tracking-wider text-[var(--color-accent-eggshell)]">Add episode</h3>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-[var(--color-text-secondary)]">
                Title
                <input
                  className="mt-1 min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2 text-sm text-[var(--color-accent-eggshell)]"
                  value={form.title}
                  onChange={(ev) => setForm((f) => ({ ...f, title: ev.target.value }))}
                />
              </label>
              <label className="block text-xs text-[var(--color-text-secondary)]">
                Guest name
                <input
                  className="mt-1 min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2 text-sm text-[var(--color-accent-eggshell)]"
                  value={form.guestName}
                  onChange={(ev) => setForm((f) => ({ ...f, guestName: ev.target.value }))}
                />
              </label>
              <label className="block text-xs text-[var(--color-text-secondary)]">
                Record date
                <input
                  type="date"
                  className="mt-1 min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2 text-sm text-[var(--color-accent-eggshell)]"
                  value={form.recordDate}
                  onChange={(ev) => setForm((f) => ({ ...f, recordDate: ev.target.value }))}
                />
              </label>
              <label className="block text-xs text-[var(--color-text-secondary)]">
                Publish date
                <input
                  type="date"
                  className="mt-1 min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2 text-sm text-[var(--color-accent-eggshell)]"
                  value={form.publishDate}
                  onChange={(ev) => setForm((f) => ({ ...f, publishDate: ev.target.value }))}
                />
              </label>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">Podcast</p>
                <div className="mt-1 flex gap-2">
                  {(["One54", "Pressbox Chronicles"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, podcast: p }))}
                      className={`min-h-11 rounded border px-2 py-2 font-mono text-[10px] uppercase lg:min-h-0 lg:py-1 ${
                        form.podcast === p
                          ? "border-[rgba(201,168,124,0.5)] text-[var(--color-accent-primary)]"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {p === "One54" ? "ONE54" : "PRESSBOX"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">Status</p>
                <select
                  className="mt-1 min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2 text-sm text-[var(--color-accent-eggshell)]"
                  value={form.status}
                  onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value as ProductionStatus }))}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="min-h-11 rounded border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-secondary)]"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className="btn-cta px-3 py-2 text-xs disabled:opacity-50"
                onClick={() => {
                  setErr(null);
                  startTransition(() => {
                    void addProductionEpisode(form).then((res) => {
                      if (!res.ok) {
                        setErr(res.error);
                        return;
                      }
                      setOpen(false);
                      setForm({
                        title: "",
                        guestName: "",
                        recordDate: toYmd(new Date()),
                        publishDate: toYmd(new Date()),
                        podcast: "One54",
                        status: "Scheduled",
                      });
                      router.refresh();
                    });
                  });
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
