"use client"

// Compact team-notes feed for the Conference room context panel.
// Reads from getFilteredTeamNotes (already role-aware) and renders the
// 8 most recent items. Posting flow lives on /command — this is a
// read-only digest so the panel stays tight.

import Link from "next/link"
import { useEffect, useState } from "react"
import { getFilteredTeamNotes } from "@/app/actions/team-notes"
import type { TeamNote } from "@/lib/team-notes"

const MAX_NOTES = 8

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function MailroomConferenceFeed() {
  const [notes, setNotes] = useState<TeamNote[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const data = await getFilteredTeamNotes()
        if (!alive) return
        setNotes(data.slice(0, MAX_NOTES))
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : "Failed to load team notes")
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] text-[var(--fg-dim)]">
          Team feed · last {MAX_NOTES}
        </p>
        <Link
          href="/command"
          className="font-mono text-[10px] text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          full thread →
        </Link>
      </header>

      {error && (
        <p className="border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[10px] text-[var(--accent)]">
          {error}
        </p>
      )}

      {notes === null && !error && (
        <p className="font-mono text-[10px] text-[var(--fg-dim)]">
          loading…
        </p>
      )}

      {notes !== null && notes.length === 0 && (
        <p className="text-sm text-[var(--fg-dim)]">No team notes yet.</p>
      )}

      {notes !== null && notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="border border-[var(--border)] bg-[var(--bg)] p-3"
            >
              <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-[var(--fg-dim)]">
                <span className="text-[var(--fg)]">{n.sender}</span>
                <span className="flex items-center gap-2">
                  <span
                    className="border border-[var(--border)] px-1 py-0.5 text-[var(--fg-dim)]"
                    aria-label={`tag ${n.podcast}`}
                  >
                    {n.podcast}
                  </span>
                  <span>{formatTime(n.createdAt)}</span>
                </span>
              </div>
              <p className="mt-1.5 text-sm text-[var(--fg)] whitespace-pre-wrap">
                {n.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
