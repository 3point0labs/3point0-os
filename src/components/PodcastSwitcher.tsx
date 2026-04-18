"use client";

import { usePodcastWorkspace } from "./PodcastWorkspaceProvider";

export function PodcastSwitcher({ variant = "sidebar" }: { variant?: "sidebar" | "dock" }) {
  const { activePodcast, setActivePodcast, allowedPodcasts } = usePodcastWorkspace();
  const isDock = variant === "dock";

  if (allowedPodcasts.length === 1) {
    const only = allowedPodcasts[0];
    return (
      <div
        className={`glass-card rounded-lg p-2 text-center font-mono text-[11px] uppercase tracking-wider ${
          only === "One54"
            ? "text-[var(--color-accent-primary)]"
            : "text-[var(--color-accent-coral)]"
        } ${isDock ? "w-full" : "mb-4"}`}
        role="status"
        aria-label="Workspace"
      >
        {only === "One54" ? "ONE54" : "PRESSBOX"}
      </div>
    );
  }

  return (
    <div
      className={`glass-card rounded-lg p-1 ${isDock ? "w-full" : "mb-4"}`}
      role="group"
      aria-label="Workspace"
    >
      <div className="grid grid-cols-2 gap-1">
        {allowedPodcasts.includes("One54") && (
          <button
            type="button"
            onClick={() => setActivePodcast("One54")}
            className={`rounded-md px-2 font-mono text-[11px] uppercase tracking-wider transition ${
              isDock ? "min-h-11 py-2.5 lg:min-h-0 lg:py-1.5" : "py-1.5"
            } ${
              activePodcast === "One54"
                ? "bg-[rgba(139,69,19,0.18)] text-[var(--color-accent-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-accent-eggshell)]"
            }`}
          >
            ONE54
          </button>
        )}
        {allowedPodcasts.includes("Pressbox Chronicles") && (
          <button
            type="button"
            onClick={() => setActivePodcast("Pressbox Chronicles")}
            className={`rounded-md px-2 font-mono text-[11px] uppercase tracking-wider transition ${
              isDock ? "min-h-11 py-2.5 lg:min-h-0 lg:py-1.5" : "py-1.5"
            } ${
              activePodcast === "Pressbox Chronicles"
                ? "bg-[rgba(160,85,42,0.16)] text-[var(--color-accent-coral)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-accent-eggshell)]"
            }`}
          >
            PRESSBOX
          </button>
        )}
      </div>
    </div>
  );
}
