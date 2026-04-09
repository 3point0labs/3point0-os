import type { Stage } from "@/lib/types";

/** NEW = gray, WARM = leather, HOT = coral (Negotiating) */
const styles: Record<Stage, string> = {
  New: "border-[rgba(138,138,122,0.45)] bg-[rgba(138,138,122,0.12)] text-[var(--color-text-secondary)]",
  Contacted:
    "border-[rgba(201,168,124,0.45)] bg-[rgba(201,168,124,0.12)] text-[var(--color-accent-primary)]",
  "Followed Up":
    "border-[rgba(201,168,124,0.4)] bg-[rgba(201,168,124,0.08)] text-[var(--color-accent-primary)]",
  Negotiating:
    "border-[rgba(232,83,61,0.5)] bg-[rgba(232,83,61,0.12)] text-[var(--color-accent-coral)]",
  Closed: "border-[rgba(138,138,122,0.35)] bg-[rgba(138,138,122,0.08)] text-[var(--color-text-secondary)]",
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
