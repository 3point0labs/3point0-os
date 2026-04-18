"use client"

import { useCallback, useEffect, useState } from "react"

type InboxRow = {
  id: string
  from: string
  subject: string
  time: string
}

type InboxPayload = {
  connected?: boolean
  emails?: InboxRow[]
  error?: string
}

export function MyInboxWidget() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [emails, setEmails] = useState<InboxRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/gmail/inbox", { credentials: "same-origin", cache: "no-store" })
      const data = (await res.json()) as InboxPayload
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load inbox")
        setConnected(false)
        setEmails([])
        return
      }
      setConnected(Boolean(data.connected))
      setEmails(Array.isArray(data.emails) ? data.emails : [])
      if (data.error) setError(data.error)
    } catch {
      setError("Failed to load inbox")
      setConnected(false)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="mission-card p-4" aria-label="My inbox">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
          MY INBOX
        </h2>
        {connected && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] underline-offset-2 hover:text-[var(--color-accent-eggshell)] hover:underline disabled:opacity-50"
          >
            Refresh
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-[var(--color-text-secondary)]">Loading…</p>}

      {!loading && connected === false && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Connect Gmail to see sponsorship-related messages here.
          </p>
          <a
            href="/api/gmail/connect"
            className="inline-flex min-h-10 items-center justify-center rounded border border-[var(--color-border)] bg-[rgba(42,31,23,0.6)] px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-accent-eggshell)] transition hover:border-[rgba(139,69,19,0.35)]"
          >
            Connect Gmail
          </a>
        </div>
      )}

      {!loading && connected && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://mail.google.com/mail/u/0/#inbox"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-[rgba(160,85,42,0.85)] underline-offset-2 hover:underline"
            >
              OPEN GMAIL
            </a>
          </div>
          {error && <p className="text-xs text-[rgba(160,85,42,0.9)]">{error}</p>}
          {emails.length === 0 && !error && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              No messages match sponsor / partnership keywords yet.
            </p>
          )}
          <ul className="space-y-2">
            {emails.map((e) => (
              <li
                key={e.id}
                className="rounded border border-[var(--color-border)] bg-[rgba(42,31,23,0.45)] px-3 py-2 text-xs"
              >
                <p className="truncate font-mono text-[11px] text-[var(--color-accent-eggshell)]">{e.subject}</p>
                <p className="mt-1 truncate text-[var(--color-text-secondary)]">{e.from}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-secondary)]">{e.time}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
