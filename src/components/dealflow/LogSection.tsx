"use client"

import { DEALFLOW_STATUSES } from "@/lib/dealflow"
import type { DealFlowContact, DealFlowStatus } from "@/lib/dealflow"

type Props = {
  contacts: DealFlowContact[]
  loading: boolean
  error: string | null
  onStatusChange: (id: string, status: DealFlowStatus) => void
  onDelete: (id: string) => void
}

export function LogSection({ contacts, loading, error, onStatusChange, onDelete }: Props) {
  return (
    <section className="mission-card p-4 lg:p-5">
      <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--color-accent-eggshell)]">
        Log
      </h2>
      {loading && (
        <p className="mt-2 animate-pulse font-mono text-xs uppercase tracking-wider text-[var(--color-accent-coral)]">
          Loading dealflow contacts...
        </p>
      )}
      {error && <p className="mt-2 text-xs text-[var(--color-accent-coral)]">{error}</p>}
      {!loading && contacts.length === 0 && !error && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">No DealFlow contacts yet.</p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              <th className="px-2 py-2">Brand</th>
              <th className="px-2 py-2">Contact</th>
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Podcast</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Date Added</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-[var(--color-border)] text-[color-mix(in_srgb,var(--color-accent-eggshell)_90%,transparent)]">
                <td className="px-2 py-2 font-medium">{c.brand}</td>
                <td className="px-2 py-2">{c.contact_name}</td>
                <td className="px-2 py-2">{c.title}</td>
                <td className="px-2 py-2">{c.email}</td>
                <td className="px-2 py-2 font-mono text-[10px] uppercase text-[var(--color-accent-coral)]">
                  {c.podcast === "Pressbox Chronicles" ? "PRESSBOX" : c.podcast}
                </td>
                <td className="px-2 py-2">
                  <select
                    value={c.status}
                    onChange={(e) => onStatusChange(c.id, e.target.value as DealFlowStatus)}
                    className="min-h-9 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-accent-eggshell)]"
                  >
                    {DEALFLOW_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-xs text-[var(--color-text-secondary)]">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    className="rounded border border-[rgba(232,83,61,0.35)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent-coral)]"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
