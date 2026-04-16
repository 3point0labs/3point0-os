"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getAppSettings, saveAppSettings } from "@/app/actions/discovery";
import type { AppSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/client";

export function SettingsClient({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setS(initial);
  }, [initial]);

  const togglePodcast = (p: "One54" | "Pressbox Chronicles") => {
    setS((prev) => {
      const set = new Set(prev.podcasts);
      if (set.has(p)) set.delete(p);
      else set.add(p);
      const next = [...set];
      if (next.length === 0) return { ...prev, podcasts: [p] };
      return { ...prev, podcasts: next as AppSettings["podcasts"] };
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <section className="mission-card space-y-4 p-5">
        <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Auto-discovery</h2>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-accent-coral)]"
            checked={s.autoDiscovery}
            onChange={(e) => setS((prev) => ({ ...prev, autoDiscovery: e.target.checked }))}
          />
          <span className="text-sm text-[var(--color-accent-eggshell)]">Run discovery automatically</span>
        </label>
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase text-[var(--color-text-secondary)]">Frequency</p>
          <div className="flex gap-2">
            {(["daily", "weekly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setS((prev) => ({ ...prev, frequency: f }))}
                className={`min-h-11 rounded border px-3 py-2 font-mono text-xs uppercase lg:min-h-0 lg:py-1.5 ${
                  s.frequency === f
                    ? "border-[rgba(201,168,124,0.5)] text-[var(--color-accent-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase text-[var(--color-text-secondary)]">Contacts per run</p>
          <div className="flex gap-2">
            {([10, 25] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setS((prev) => ({ ...prev, contactsPerRun: n }))}
                className={`min-h-11 rounded border px-3 py-2 font-mono text-xs lg:min-h-0 lg:py-1.5 ${
                  s.contactsPerRun === n
                    ? "border-[rgba(201,168,124,0.5)] text-[var(--color-accent-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase text-[var(--color-text-secondary)]">Podcasts</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => togglePodcast("One54")}
              className={`min-h-11 rounded border px-3 py-2 font-mono text-xs uppercase lg:min-h-0 lg:py-1.5 ${
                s.podcasts.includes("One54")
                  ? "border-[rgba(201,168,124,0.5)] text-[var(--color-accent-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              One54
            </button>
            <button
              type="button"
              onClick={() => togglePodcast("Pressbox Chronicles")}
              className={`min-h-11 rounded border px-3 py-2 font-mono text-xs uppercase lg:min-h-0 lg:py-1.5 ${
                s.podcasts.includes("Pressbox Chronicles")
                  ? "border-[rgba(232,83,61,0.5)] text-[var(--color-accent-coral)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              Pressbox
            </button>
          </div>
        </div>
        {s.lastDiscoveryRunAt && (
          <p className="font-mono text-[10px] text-[var(--color-text-secondary)]">
            Last auto run: {new Date(s.lastDiscoveryRunAt).toLocaleString()}
          </p>
        )}
        {msg && <p className="text-sm text-[var(--color-accent-primary)]">{msg}</p>}
        <button
          type="button"
          disabled={pending}
          className="btn-cta disabled:opacity-50"
          onClick={() => {
            setMsg(null);
            startTransition(() => {
              void saveAppSettings(s).then((res) => {
                if (res.ok) {
                  setMsg("Saved.");
                  router.refresh();
                }
              });
            });
          }}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>

        <div className="pt-4">
          <button
            type="button"
            disabled={signingOut}
            className="min-h-10 rounded border border-[rgba(232,83,61,0.28)] bg-[rgba(232,83,61,0.08)] px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[rgba(232,83,61,0.8)] transition hover:bg-[rgba(232,83,61,0.12)] disabled:opacity-60"
            onClick={async () => {
              setSigningOut(true);
              const supabase = createClient()
              const { error } = await supabase.auth.signOut()
              if (!error) window.location.href = "/login"
              else setSigningOut(false)
            }}
          >
            {signingOut ? "SIGNING OUT..." : "SIGN OUT"}
          </button>
        </div>
      </section>
    </div>
  );
}
