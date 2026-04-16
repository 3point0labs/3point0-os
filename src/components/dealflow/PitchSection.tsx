"use client"

import type { DealFlowChannel, DealFlowPodcast } from "@/lib/dealflow"

type Props = {
  contactName: string
  title: string
  company: string
  podcast: DealFlowPodcast
  pitchAngle: string
  draft: string
  channel: DealFlowChannel | null
  channelReason: string
  generating: boolean
  savingDraft: boolean
  error: string | null
  onContactNameChange: (value: string) => void
  onTitleChange: (value: string) => void
  onCompanyChange: (value: string) => void
  onPitchAngleChange: (value: string) => void
  onGenerate: () => void
  onSaveDraft: () => void
  onDraftChange: (value: string) => void
}

function podcastSummary(podcast: DealFlowPodcast) {
  if (podcast === "Pressbox Chronicles") return "Sports storytelling podcast with deep sports media credibility"
  if (podcast === "BOTH") return "One54 Africa (Black culture & business, engaged Black professional audience) + Pressbox Chronicles (sports storytelling, press-box credibility). Dual placement opportunity."
  return "Black culture and business podcast with an engaged Black professional audience"
}

export function PitchSection({
  contactName,
  title,
  company,
  podcast,
  pitchAngle,
  draft,
  channel,
  channelReason,
  generating,
  savingDraft,
  error,
  onContactNameChange,
  onTitleChange,
  onCompanyChange,
  onPitchAngleChange,
  onGenerate,
  onSaveDraft,
  onDraftChange,
}: Props) {
  return (
    <section className="mission-card p-4 lg:p-5">
      <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)]">
        Pitch
      </h2>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <input value={contactName} onChange={(e) => onContactNameChange(e.target.value)} placeholder="Contact name" className="min-h-11 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-accent-eggshell)]" />
        <input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Title" className="min-h-11 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-accent-eggshell)]" />
        <input value={company} onChange={(e) => onCompanyChange(e.target.value)} placeholder="Company" className="min-h-11 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-accent-eggshell)]" />
      </div>

      <p className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
        Podcast context: <span className="text-[var(--color-accent-eggshell)]">{podcastSummary(podcast)}</span>
      </p>

      <textarea
        value={pitchAngle}
        onChange={(e) => onPitchAngleChange(e.target.value)}
        placeholder="Pitch angle (optional notes)"
        className="mt-3 min-h-24 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-accent-eggshell)]"
      />

      <button type="button" onClick={onGenerate} disabled={generating} className="btn-cta mt-3 min-h-11 w-full lg:w-auto">
        {generating ? "GENERATING..." : "GENERATE PITCH"}
      </button>
      {error && <p className="mt-2 text-xs text-[var(--color-accent-coral)]">{error}</p>}

      {channel && (
        <div className="mt-4 rounded border border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.12)] px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--accent)]">
            Recommended channel: {channel} — {channelReason}
          </p>
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder="Draft message appears here..."
        className="mt-3 min-h-40 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-accent-eggshell)]"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={savingDraft || !draft.trim()}
          className="min-h-10 rounded border border-[rgba(var(--accent-rgb),0.45)] bg-[rgba(var(--accent-rgb),0.1)] px-3 font-mono text-[10px] uppercase tracking-wider text-[color:var(--accent)]"
        >
          {savingDraft ? "SAVING..." : "SAVE DRAFT"}
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(draft)}
          disabled={!draft.trim()}
          className="min-h-10 rounded border border-[var(--color-border)] px-3 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]"
        >
          COPY TO CLIPBOARD
        </button>
      </div>
    </section>
  )
}
