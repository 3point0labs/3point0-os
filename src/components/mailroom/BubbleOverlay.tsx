"use client"

// =====================================================================
// BubbleOverlay — DOM-based speech / thought / status chips that hover
// above pixel characters on the canvas. Pattern adapted from
// harishkotra/agent-office (MIT-licensed); see public/mailroom/CREDITS.md.
//
// We position bubbles as percentages of the canvas size so they stay
// glued to the right spot when the canvas resizes (the canvas has
// `width: 100%` but a fixed logical pixel resolution).
// =====================================================================

import type { CharacterPosition } from "@/lib/mailroom/engine/Engine"

export type BubbleTone = "speech" | "thought" | "status"

export type BubbleSpec = {
  key: string
  text: string
  tone?: BubbleTone
}

export type StatusDot = {
  key: string
  active: boolean
}

type Props = {
  positions: CharacterPosition[]
  bubbles: BubbleSpec[]
  statusDots?: StatusDot[]
  canvasSize: { w: number; h: number }
}

export function BubbleOverlay({
  positions,
  bubbles,
  statusDots = [],
  canvasSize,
}: Props) {
  if (canvasSize.w <= 0 || canvasSize.h <= 0) return null
  const positionByKey = new Map(positions.map((p) => [p.key, p]))
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {statusDots.map((d) => {
        const pos = positionByKey.get(d.key)
        if (!pos) return null
        const left = `${(pos.x / canvasSize.w) * 100}%`
        const top = `${(pos.y / canvasSize.h) * 100}%`
        return (
          <div
            key={`dot:${d.key}`}
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+2px)]"
            style={{ left, top }}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full ring-1 ring-[var(--bg)]"
              style={{
                backgroundColor: d.active
                  ? "var(--accent)"
                  : "var(--fg-mute)",
              }}
            />
          </div>
        )
      })}
      {bubbles.map((b) => {
        const pos = positionByKey.get(b.key)
        if (!pos) return null
        const left = `${(pos.x / canvasSize.w) * 100}%`
        const top = `${(pos.y / canvasSize.h) * 100}%`
        return (
          <div
            key={b.key}
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+10px)]"
            style={{ left, top }}
          >
            <BubbleChip text={b.text} tone={b.tone ?? "speech"} />
          </div>
        )
      })}
    </div>
  )
}

function BubbleChip({ text, tone }: { text: string; tone: BubbleTone }) {
  if (tone === "thought") {
    return (
      <div className="border border-dashed border-[var(--accent)] bg-[var(--bg-warm)] px-2 py-1 font-mono text-[10px] tracking-wider text-[var(--fg)] shadow-sm">
        {text}
      </div>
    )
  }
  if (tone === "status") {
    return (
      <div className="bg-[var(--fg-mute)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--bg-warm)]">
        {text}
      </div>
    )
  }
  return (
    <div className="bg-[var(--accent)] px-2 py-1 font-mono text-[10px] tracking-wider text-[var(--bg-warm)] shadow-sm">
      {text}
    </div>
  )
}
