"use client"

import { DEALFLOW_ROLES } from "@/lib/dealflow"
import type { DealFlowConfidence, DealFlowPodcast, ScoutResult } from "@/lib/dealflow"

type Props = {
  brand: string
  targetRole: string
  podcast: DealFlowPodcast
  scouting: boolean
  error: string | null
  result: ScoutResult | null
  onBrandChange: (value: string) => void
  onTargetRoleChange: (value: string) => void
  onPodcastChange: (value: DealFlowPodcast) => void
  onScout: () => void
  onDraftPitch: () => void
  onSavePipeline: () => void
}

function confidenceClass(confidence: DealFlowConfidence) {
  if (confidence === "HIGH") return "bg-emerald-600/20 text-emerald-300 border-emerald-500/40"
  if (confidence === "MEDIUM") return "bg-[rgba(201,168,124,0.16)] text-[var(--color-accent-primary)] border-[rgba(201,168,124,0.4)]"
  return "bg-[rgba(232,83,61,0.12)] text-[var(--color-accent-coral)] border-[rgba(232,83,61,0.4)]"
}

export function ScoutSection({
  brand,
  targetRole,
  podcast,
  scouting,
  error,
  result,
  onBrandChange,
  onTargetRoleChange,
  onPodcastChange,
  onScout,
  onDraftPitch,
  onSavePipeline,
}: Props) {
  return (
    <section className="mission-card p-4 lg:p-5">
      <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)]">
        Scout
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Find likely decision-makers by brand and role.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <input
          type="text"
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
          placeholder="Brand name"
          className="min-h-11 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-accent-eggshell)]"
        />
        <select
          value={targetRole}
          onChange={(e) => onTargetRoleChange(e.target.value)}
          className="min-h-11 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-accent-eggshell)]"
        >
          {DEALFLOW_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <div className="flex min-h-11 items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3">
          {(["One54", "Pressbox Chronicles", "BOTH"] as const).map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
              <input
                type="radio"
                name="dealflow-podcast"
                checked={podcast === p}
                onChange={() => onPodcastChange(p)}
              />
              <span className="font-mono uppercase">{p === "Pressbox Chronicles" ? "PRESSBOX" : p}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onScout}
        disabled={scouting}
        className="btn-cta mt-3 min-h-11 w-full lg:w-auto"
      >
        {scouting ? "FINDING..." : "FIND CONTACT"}
      </button>
      {error && <p className="mt-2 text-xs text-[var(--color-accent-coral)]">{error}</p>}

      {result && (
        <div className="glass-card mt-4 rounded-lg p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[var(--color-accent-eggshell)]">{result.name}</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                {result.title} · {result.company}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{result.email}</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{result.linkedin_url}</p>
            </div>
            <span className={`rounded border px-2 py-1 font-mono text-[10px] ${confidenceClass(result.confidence)}`}>
              {result.confidence}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-cta min-h-10" onClick={onDraftPitch}>
              DRAFT PITCH →
            </button>
            <button
              type="button"
              onClick={onSavePipeline}
              className="min-h-10 rounded border border-[var(--color-border)] px-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]"
            >
              SAVE TO PIPELINE
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
