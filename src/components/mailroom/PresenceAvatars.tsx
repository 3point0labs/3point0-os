"use client"

import type { PresenceRow } from "./usePresence"
import { TEAM } from "@/lib/mailroom/config/team"
import type { TeamMemberId } from "@/lib/mailroom/config/types"

type Props = {
  presentIds: TeamMemberId[]
  presences: PresenceRow[]
  onSelect?: (id: TeamMemberId) => void
}

export function PresenceAvatars({ presentIds, onSelect }: Props) {
  return (
    <ul className="flex items-center gap-2">
      {TEAM.map((m) => {
        const online = presentIds.includes(m.id)
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect?.(m.id)}
              className="flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-warm)] px-2 py-1 font-mono text-[10px] text-[var(--fg)] hover:border-[var(--accent)]"
              aria-label={`${m.displayName} ${online ? "online" : "away"}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: online ? "var(--accent)" : "var(--fg-mute)",
                }}
                aria-hidden
              />
              <span>{m.displayName}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
