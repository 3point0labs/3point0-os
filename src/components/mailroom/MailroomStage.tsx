"use client"

import { useEffect, useRef } from "react"
import { MailroomEngine, type CharacterSpec } from "@/lib/mailroom/engine/Engine"
import type {
  AgentRuntimeState,
  MailroomLayout,
  RoomId,
  TeamMemberId,
  TilePos,
} from "@/lib/mailroom/config/types"
import { TEAM, teamById } from "@/lib/mailroom/config/team"
import { AGENTS } from "@/lib/mailroom/config/agents"

type Props = {
  layout: MailroomLayout
  player: TeamMemberId | null
  includePrivate: boolean
  presentIds: TeamMemberId[]
  agentStates: AgentRuntimeState[]
  onEnterRoom: (id: RoomId) => void
  focusRoom: RoomId | "default"
}

export function MailroomStage({
  layout,
  player,
  includePrivate,
  presentIds,
  agentStates,
  onEnterRoom,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<MailroomEngine | null>(null)
  const readyRef = useRef(false)
  const eventsRef = useRef({ onEnterRoom })
  eventsRef.current.onEnterRoom = onEnterRoom

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // Guard against React 18 StrictMode's double-invoke of effects.
    // If an engine instance from a prior pass of this effect is still
    // attached, tear it down before we spin up a new one so we never
    // end up with two canvases fighting over the same host.
    if (engineRef.current) {
      engineRef.current.destroy()
      engineRef.current = null
    }
    while (host.firstChild) host.removeChild(host.firstChild)

    const engine = new MailroomEngine(
      layout,
      {
        onEnterRoom: (id) => eventsRef.current.onEnterRoom(id),
      },
      includePrivate,
    )
    engineRef.current = engine
    readyRef.current = false

    ;(async () => {
      await engine.mount(host)
      // If cleanup already ran (StrictMode unmount between mount() awaits),
      // the engine is disposed and every call below becomes a no-op.
      if (engineRef.current !== engine) return

      for (const member of TEAM) {
        const spawn = layout.spawns[member.id]
        if (!spawn) continue
        const spec: CharacterSpec = {
          key: `team:${member.id}`,
          spriteIndex: member.charSpriteIndex,
          tint: member.tintHex,
          nameplate: member.displayName,
          spawn,
          isPlayer: player === member.id,
          filter: member.filter,
        }
        if (engineRef.current !== engine) return
        await engine.addCharacter(spec)
        if (!presentIds.includes(member.id)) {
          engine.setBubble(`team:${member.id}`, "AWAY")
        }
      }

      if (engineRef.current === engine) readyRef.current = true
    })()

    return () => {
      readyRef.current = false
      engine.destroy()
      if (engineRef.current === engine) engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, player, includePrivate])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !readyRef.current) return
    for (const member of TEAM) {
      const key = `team:${member.id}`
      engine.setBubble(key, presentIds.includes(member.id) ? null : "AWAY")
    }
  }, [presentIds])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    let cancelled = false

    ;(async () => {
      while (!readyRef.current) {
        if (cancelled) return
        await new Promise((r) => setTimeout(r, 50))
      }
      for (const descriptor of AGENTS) {
        if (descriptor.restrictedTo && !includePrivate) continue
        const state = agentStates.find((s) => s.id === descriptor.id)
        const key = `agent:${descriptor.id}`
        const room = layout.rooms.find((r) => r.id === descriptor.homeRoom)
        if (!room) continue
        const roomCenter: TilePos = {
          x: room.x + Math.floor(room.w / 2),
          y: room.y + Math.floor(room.h / 2),
        }
        const spawnPos =
          layout.agentSpawns[descriptor.id] ?? roomCenter
        if (!state) {
          engine.setBubble(key, null)
          continue
        }
        const spec: CharacterSpec = {
          key,
          spriteIndex: descriptor.charSpriteIndex,
          tint: descriptor.tintHex,
          nameplate: descriptor.displayName,
          spawn: spawnPos,
        }
        if (cancelled) return
        await engine.addCharacter(spec).catch(() => {})
        if (state.status === "working") {
          engine.moveCharacterTo(key, roomCenter)
          engine.setBubble(key, state.message ?? "WORKING…")
        } else if (state.status === "waiting") {
          engine.setBubble(key, state.message ?? "READY")
        } else if (state.status === "error") {
          engine.setBubble(key, "ERROR")
        } else {
          engine.setBubble(key, null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [agentStates, includePrivate, layout])

  return (
    <div
      ref={hostRef}
      className="mx-auto flex w-full items-center justify-center bg-[var(--bg)]"
      style={{ imageRendering: "pixelated" }}
    />
  )
}

// Re-export the helper so dependents don't import engine internals directly
export const teamLookup = teamById
