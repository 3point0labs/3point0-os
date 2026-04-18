"use client"

import Link from "next/link"
import { MyInboxWidget } from "@/components/MyInboxWidget"
import { TodoList } from "@/components/TodoList"
import type { AgentRuntimeState, RoomId } from "@/lib/mailroom/config/types"
import { ROOM_LABELS } from "@/lib/mailroom/config/rooms"

type Props = {
  activeRoom: RoomId | "default"
  isAdmin: boolean
  agentStates: AgentRuntimeState[]
}

export function MailroomContextPanel({
  activeRoom,
  isAdmin,
  agentStates,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-warm)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-warm)] px-5 py-4">
        <p className="font-mono text-[10px] text-[var(--fg-dim)]">
          Context Panel
        </p>
        <h2 className="mt-1 font-mono text-base text-[var(--fg)]">
          {activeRoom === "default" ? "Mailroom" : ROOM_LABELS[activeRoom]}
        </h2>
      </header>
      <div className="flex-1 px-5 py-5">
        <RoomView room={activeRoom} isAdmin={isAdmin} agentStates={agentStates} />
      </div>
    </div>
  )
}

function RoomView({
  room,
  isAdmin,
  agentStates,
}: {
  room: RoomId | "default"
  isAdmin: boolean
  agentStates: AgentRuntimeState[]
}) {
  if (room === "default") return <DefaultView agentStates={agentStates} />
  if (room === "pipeline") return <PipelineView />
  if (room === "broadcast") return <BroadcastView />
  if (room === "mail") return <MailView agentStates={agentStates} />
  if (room === "conference") return <ConferenceView />
  if (room === "private") {
    if (!isAdmin) return <LockedPrivateView />
    return <PrivateView />
  }
  return null
}

function DefaultView({ agentStates }: { agentStates: AgentRuntimeState[] }) {
  return (
    <div className="space-y-4">
      <section className="mission-card p-4">
        <p className="font-mono text-[10px] text-[var(--fg-dim)]">
          Today
        </p>
        <p className="mt-2 font-display text-xl text-[var(--fg)]">
          Walk into a room to load its workspace.
        </p>
        <p className="mt-2 text-sm text-[var(--fg-dim)]">
          Pipeline Wall, Broadcast Room, Mail Slot, Conference Room, and
          {" "}
          {"Private Office"}—each zone opens a contextual panel here when your character
          steps inside.
        </p>
      </section>
      <TodoList />
      <AgentFeed states={agentStates} />
    </div>
  )
}

function AgentFeed({ states }: { states: AgentRuntimeState[] }) {
  if (states.length === 0) {
    return (
      <section className="mission-card p-4">
        <p className="font-mono text-[10px] text-[var(--fg-dim)]">
          Agents
        </p>
        <p className="mt-2 text-sm text-[var(--fg-dim)]">
          No agent activity yet.
        </p>
      </section>
    )
  }
  return (
    <section className="mission-card p-4">
      <p className="font-mono text-[10px] text-[var(--fg-dim)]">Agents</p>
      <ul className="mt-3 space-y-2">
        {states.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 border border-[var(--border)] px-3 py-2"
          >
            <div>
              <p className="font-mono text-[11px] text-[var(--fg)]">{s.id}</p>
              <p className="mt-0.5 text-xs text-[var(--fg-dim)]">
                {s.message ?? "—"}
              </p>
            </div>
            <span
              className="font-mono text-[10px] text-[var(--accent)]"
              data-status={s.status}
            >
              {s.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PipelineView() {
  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--fg-dim)]">
        Full kanban, stat cards, agents, CSV import, and pitch drafting live on the partnerships page.
      </p>
      <Link
        href="/partnerships"
        className="inline-flex min-h-[44px] items-center border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-mono text-[11px] text-[var(--bg-warm)] hover:bg-[var(--accent-hover)]"
      >
        Open Pipeline Wall →
      </Link>
    </section>
  )
}

function BroadcastView() {
  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--fg-dim)]">
        YouTube episode intelligence and production calendar for One54 and Pressbox Chronicles.
      </p>
      <Link
        href="/broadcast"
        className="inline-flex min-h-[44px] items-center border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-mono text-[11px] text-[var(--bg-warm)] hover:bg-[var(--accent-hover)]"
      >
        Open Broadcast Room →
      </Link>
    </section>
  )
}

function MailView({ agentStates }: { agentStates: AgentRuntimeState[] }) {
  const outreach = agentStates.find((s) =>
    s.id === "sponsor-outreach" || s.id === "pressbox-outreach"
  )
  return (
    <section className="space-y-4">
      {outreach && (
        <div className="border border-[var(--accent)] bg-[var(--bg)] p-3">
          <p className="font-mono text-[10px] text-[var(--accent)]">
            {outreach.id}
          </p>
          <p className="mt-1 text-sm text-[var(--fg)]">
            {outreach.message ?? outreach.status}
          </p>
        </div>
      )}
      <MyInboxWidget />
      <Link
        href="/dealflow"
        className="inline-flex min-h-[44px] items-center border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-mono text-[11px] text-[var(--bg-warm)] hover:bg-[var(--accent-hover)]"
      >
        Open Outreach Queue →
      </Link>
    </section>
  )
}

function ConferenceView() {
  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--fg-dim)]">
        Team notes feed, asynchronous updates, and shared decisions. Full notes stream on the Command Center.
      </p>
      <Link
        href="/command"
        className="inline-flex min-h-[44px] items-center border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 font-mono text-[11px] text-[var(--bg-warm)] hover:bg-[var(--accent-hover)]"
      >
        Open Command Center →
      </Link>
    </section>
  )
}

function PrivateView() {
  return (
    <section className="space-y-4">
      <p className="font-mono text-[10px] text-[var(--fg-dim)]">
        Private Office · admin only
      </p>
      <div className="mission-card p-4">
        <p className="font-display text-xl text-[var(--fg)]">
          NFLPA Contract Advisor — study prep
        </p>
        <p className="mt-2 text-sm text-[var(--fg-dim)]">
          Flashcard and practice question flow will wire in here next. Target exam: July 2026.
        </p>
      </div>
    </section>
  )
}

function LockedPrivateView() {
  return (
    <section className="space-y-3">
      <p className="font-mono text-[10px] text-[var(--fg-dim)]">
        Private Office · restricted
      </p>
      <p className="text-sm text-[var(--fg-dim)]">
        This room is only visible to admins.
      </p>
    </section>
  )
}
