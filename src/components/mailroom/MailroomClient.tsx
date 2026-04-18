"use client"

import Link from "next/link"
import { useEffect, useMemo, useReducer, useState } from "react"
import type { MailroomLayout, RoomId, TeamMemberId, AgentRuntimeState } from "@/lib/mailroom/config/types"
import { MailroomStage } from "./MailroomStage"
import { MailroomContextPanel } from "./MailroomContextPanel"
import { PresenceAvatars } from "./PresenceAvatars"
import { ViewModeToggle } from "./ViewModeToggle"
import { useAuth } from "@/hooks/useAuth"
import { usePresence, type PresenceRow } from "./usePresence"
import { TEAM } from "@/lib/mailroom/config/team"

type Props = {
  layout: MailroomLayout
  initialAgentStates: AgentRuntimeState[]
}

type State = {
  activeRoom: RoomId | "default"
}

type Action =
  | { type: "enterRoom"; room: RoomId }
  | { type: "reset" }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "enterRoom":
      if (state.activeRoom === action.room) return state
      return { activeRoom: action.room }
    case "reset":
      return { activeRoom: "default" }
    default:
      return state
  }
}

function memberIdForProfileName(name: string | null | undefined): TeamMemberId | null {
  if (!name) return null
  const lower = name.toLowerCase()
  if (lower.includes("marquel")) return "marquel"
  if (lower.includes("andrew")) return "andrew"
  if (lower.includes("randy")) return "randy"
  if (lower.includes("kari")) return "kari"
  return null
}

function resolvePresentIds(rows: PresenceRow[]): TeamMemberId[] {
  const ids = new Set<TeamMemberId>()
  for (const row of rows) {
    if (row.member_id) ids.add(row.member_id)
  }
  return Array.from(ids)
}

export function MailroomClient({ layout, initialAgentStates }: Props) {
  const { user, profile, isAdmin } = useAuth()
  const [state, dispatch] = useReducer(reducer, { activeRoom: "default" })
  const [agentStates, setAgentStates] = useState<AgentRuntimeState[]>(
    initialAgentStates,
  )

  const memberId = useMemo(
    () => memberIdForProfileName(profile?.name ?? user?.email ?? null),
    [profile?.name, user?.email],
  )

  const { rows } = usePresence({
    userId: user?.id ?? null,
    name: profile?.name ?? user?.email ?? null,
    memberId,
  })
  const presentIds = useMemo(() => resolvePresentIds(rows), [rows])

  useEffect(() => {
    let alive = true
    const fetchStates = async () => {
      try {
        const res = await fetch("/api/agents/activity", {
          cache: "no-store",
          credentials: "same-origin",
        })
        if (!res.ok) return
        const data = (await res.json()) as { states: AgentRuntimeState[] }
        if (!alive) return
        setAgentStates(data.states ?? [])
      } catch {
        /* silent */
      }
    }
    void fetchStates()
    const id = window.setInterval(() => void fetchStates(), 8000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const currentView = (profile?.view_mode ?? "pixel") as "pixel" | "classic"

  const handleEnterRoom = (id: RoomId) => {
    dispatch({ type: "enterRoom", room: id })
  }

  const handleAvatarSelect = (id: TeamMemberId) => {
    const desk = layout.desks.find((d) => d.id === id)
    if (!desk) return
    // Trigger navigation by walking — since the room trigger fires
    // when the player arrives in a zone, we just re-emit a default
    // panel state and let the stage handle the walk. Desks are not
    // rooms in the layout, so we surface the person's desk panel via
    // the default zone. Keep it simple for MVP.
    void id
    void desk
  }

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-warm)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/mailroom"
            className="font-display text-lg tracking-tight text-[var(--fg)]"
          >
            3point0 Labs
          </Link>
          <span className="hidden font-mono text-[10px] text-[var(--fg-dim)] sm:inline">
            The Mailroom
          </span>
        </div>
        <div className="flex items-center gap-4">
          <PresenceAvatars
            presentIds={presentIds}
            presences={rows}
            onSelect={handleAvatarSelect}
          />
          <ViewModeToggle current={currentView} />
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[60%_40%]">
        <section className="relative flex min-h-0 flex-col items-stretch bg-[var(--bg)]">
          <div className="flex-1 overflow-hidden p-4">
            <MailroomStage
              layout={layout}
              player={memberId}
              includePrivate={Boolean(isAdmin)}
              presentIds={presentIds}
              agentStates={agentStates}
              onEnterRoom={handleEnterRoom}
              focusRoom={state.activeRoom}
            />
          </div>
          <footer className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-warm)] px-4 py-2 font-mono text-[10px] text-[var(--fg-dim)]">
            <span>
              Click a tile to walk. Step into a room to load its workspace.
            </span>
            <Link
              href="/mailroom/credits"
              className="hover:text-[var(--fg)]"
              aria-label="Asset credits"
            >
              Credits
            </Link>
          </footer>
        </section>
        <section className="min-h-0">
          <MailroomContextPanel
            activeRoom={state.activeRoom}
            isAdmin={Boolean(isAdmin)}
            agentStates={agentStates}
          />
        </section>
      </div>
    </div>
  )
}

// avoid dead-code warnings while TEAM is only referenced for types
void TEAM
