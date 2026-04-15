"use client"

import type { DealFlowConfidence, DealFlowPodcast, ScoutResult } from "@/lib/dealflow"

type Props = {
  brand: string
  podcast: DealFlowPodcast
  scouting: boolean
  error: string | null
  result: ScoutResult | null
  onBrandChange: (value: string) => void
  onPodcastChange: (value: DealFlowPodcast) => void
  onScout: () => void
  onDraftPitch: () => void
  onSavePipeline: () => void
}

function confidenceClass(confidence: DealFlowConfidence) {
  if (confidence === "VERIFIED") return "bg-emerald-600/20 text-emerald-300 border-emerald-500/40"
  if (confidence === "CONSTRUCTED") return "bg-[rgba(201,168,124,0.16)] text-[var(--color-accent-primary)] border-[rgba(201,168,124,0.4)]"
  return "bg-[rgba(232,83,61,0.12)] text-[var(--color-accent-coral)] border-[rgba(232,83,61,0.4)]"
}

export function ScoutSection({
  brand,
  podcast,
  scouting,
  error,
  result,
  onBrandChange,
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
        Find the best decision-maker automatically from brand and podcast context.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <input
          type="text"
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
          placeholder="Brand name"
          className="min-h-11 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-accent-eggshell)]"
        />
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
              {result.website_url && (
                <a
                  href={result.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block text-xs text-[var(--color-accent-primary)] hover:underline"
                >
                  {result.website_url}
                </a>
              )}
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{result.linkedin_url}</p>
              {result.role_logic && (
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{result.role_logic}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded border px-2 py-1 font-mono text-[10px] ${confidenceClass(result.confidence)}`}>
                {result.confidence}
              </span>
              <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">{result.source}</span>
            </div>
          </div>
          {result.confidence !== "VERIFIED" && (
            <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]" title="Email constructed from domain pattern — verify before sending">
              Email constructed from domain pattern — verify before sending
            </p>
          )}
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
