"use client";

import { useState } from "react";
import { runScheduledDiscoveryIfDue } from "@/app/actions/discovery";
import { runManualDiscovery, addDiscoveredSponsorsToPipeline } from "@/app/actions/discovery";

function formatLastRun(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 1) return "Less than an hour ago";
  if (diffHours < 24) return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function DiscoveryStatusBar({ lastRunAt }: { lastRunAt: string | null }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleRunNow() {
    setStatus("running");
    setMessage(null);
    try {
      const result = await runManualDiscovery({
        podcastMode: "BOTH",
        category: "__ALL__",
        count: 10,
      });
      if (!result.ok) {
        setStatus("error");
        setMessage(result.error);
        return;
      }
      if (result.results.length > 0) {
        await addDiscoveredSponsorsToPipeline(result.results, "One54");
        setStatus("done");
        setMessage(`${result.results.length} new contacts added`);
      } else {
        setStatus("done");
        setMessage("No new contacts found");
      }
    } catch (e) {
      setStatus("error");
      setMessage("Discovery failed — try again");
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Sponsor pipeline and outreach for{" "}
        <span className="text-[var(--color-accent-eggshell)]">Pressbox Chronicles</span> and{" "}
        <span className="text-[var(--color-accent-eggshell)]">One54</span>
      </p>
      <span className="text-[var(--color-text-secondary)] opacity-40">·</span>
      <span className="font-mono text-xs text-[var(--color-text-secondary)]">
        Last discovery:{" "}
        <span className="text-[var(--color-accent-eggshell)]">{formatLastRun(lastRunAt)}</span>
      </span>
      <button
        onClick={handleRunNow}
        disabled={status === "running"}
        className="flex items-center gap-1.5 rounded border border-[rgba(139,69,19,0.3)] bg-[rgba(139,69,19,0.06)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-primary)] transition hover:bg-[rgba(139,69,19,0.12)] disabled:opacity-50"
      >
        {status === "running" ? (
          <>
            <span className="animate-spin">⟳</span>
            Running...
          </>
        ) : (
          <>⟳ Run Now</>
        )}
      </button>
      {message && (
        <span className={`font-mono text-[10px] ${status === "done" ? "text-green-400" : "text-[var(--color-accent-coral)]"}`}>
          {status === "done" ? "✓" : "✗"} {message}
        </span>
      )}
    </div>
  );
}