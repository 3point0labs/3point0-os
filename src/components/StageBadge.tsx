import type { Stage } from "@/lib/types";

/** NEW = gray, WARM = leather, HOT = coral (Negotiating) */
const styles: Record<Stage, string> = {
  New: "border-[rgba(107,90,74,0.45)] bg-[rgba(107,90,74,0.12)] text-[var(--color-text-secondary)]",
  Contacted:
    "border-[rgba(139,69,19,0.45)] bg-[rgba(139,69,19,0.12)] text-[var(--color-accent-primary)]",
  "Followed Up":
    "border-[rgba(139,69,19,0.4)] bg-[rgba(139,69,19,0.08)] text-[var(--color-accent-primary)]",
  Negotiating:
    "border-[rgba(160,85,42,0.5)] bg-[rgba(160,85,42,0.12)] text-[var(--color-accent-coral)]",
  Closed: "border-[rgba(107,90,74,0.35)] bg-[rgba(107,90,74,0.08)] text-[var(--color-text-secondary)]",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`inline-flex min-h-[28px] items-center rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${styles[stage]}`}
    >
      {stage}
    </span>
  );
}
