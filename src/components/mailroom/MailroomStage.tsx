"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  MailroomEngine,
  type CharacterPosition,
  type CharacterSpec,
} from "@/lib/mailroom/engine/Engine"
import type {
  AgentRuntimeState,
  MailroomLayout,
  RoomId,
  TeamMemberId,
  TilePos,
} from "@/lib/mailroom/config/types"
import { TEAM, teamById } from "@/lib/mailroom/config/team"
import { AGENTS } from "@/lib/mailroom/config/agents"
import { BubbleOverlay, type BubbleSpec, type StatusDot } from "./BubbleOverlay"

export type MailroomStageHandle = {
  teleportPlayerToSpawn: () => void
}

type Props = {
  layout: MailroomLayout
  player: TeamMemberId | null
  includePrivate: boolean
  presentIds: TeamMemberId[]
  agentStates: AgentRuntimeState[]
  onEnterRoom: (id: RoomId) => void
  focusRoom: RoomId | "default"
}

function samePositions(a: CharacterPosition[], b: CharacterPosition[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].key !== b[i].key) return false
    if (Math.abs(a[i].x - b[i].x) > 0.5) return false
    if (Math.abs(a[i].y - b[i].y) > 0.5) return false
  }
  return true
}

export const MailroomStage = forwardRef<MailroomStageHandle, Props>(function MailroomStage(
  { layout, player, includePrivate, presentIds, agentStates, onEnterRoom },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<MailroomEngine | null>(null)
  const readyRef = useRef(false)
  const eventsRef = useRef({ onEnterRoom })
  eventsRef.current.onEnterRoom = onEnterRoom

  const [positions, setPositions] = useState<CharacterPosition[]>([])

  const canvasSize = useMemo(
    () => ({
      w: layout.cols * layout.tileSize * layout.zoom,
      h: layout.rows * layout.tileSize * layout.zoom,
    }),
    [layout],
  )

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

  // requestAnimationFrame loop polls character positions from the
  // engine and pushes them into React state for the BubbleOverlay.
  // We diff against the last snapshot so React doesn't re-render
  // 60×/sec when nobody is moving.
  useEffect(() => {
    let rafId = 0
    let last: CharacterPosition[] = []
    const tick = () => {
      const engine = engineRef.current
      if (engine && readyRef.current) {
        const next = engine.getCharacterPositions()
        if (!samePositions(last, next)) {
          last = next
          setPositions(next)
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Add agent NPC characters when their state shows up. Bubbles for
  // them are now driven by React state below, not engine.setBubble.
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
        if (!state) continue
        const room = layout.rooms.find((r) => r.id === descriptor.homeRoom)
        if (!room) continue
        const roomCenter: TilePos = {
          x: room.x + Math.floor(room.w / 2),
          y: room.y + Math.floor(room.h / 2),
        }
        const spawnPos = layout.agentSpawns[descriptor.id] ?? roomCenter
        const key = `agent:${descriptor.id}`
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
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agentStates, includePrivate, layout])

  // Derive React-state bubbles from agent activity. Teammate active/away
  // status renders as a small dot via statusDots below — cleaner than a
  // text chip and matches the top-bar roster's visual language.
  const bubbles = useMemo<BubbleSpec[]>(() => {
    const out: BubbleSpec[] = []
    for (const d of AGENTS) {
      if (d.restrictedTo && !includePrivate) continue
      const state = agentStates.find((s) => s.id === d.id)
      if (!state) continue
      const key = `agent:${d.id}`
      if (state.status === "working") {
        out.push({ key, text: state.message ?? "WORKING…", tone: "speech" })
      } else if (state.status === "waiting") {
        out.push({ key, text: state.message ?? "READY", tone: "speech" })
      } else if (state.status === "error") {
        out.push({ key, text: "ERROR", tone: "status" })
      }
    }
    return out
  }, [agentStates, includePrivate])

  // Cognac dot for active teammates, taupe for away. Only emit dots
  // for teammates who actually have a spawn in this layout (i.e. are
  // rendered on screen).
  const statusDots = useMemo<StatusDot[]>(
    () =>
      TEAM.filter((m) => Boolean(layout.spawns[m.id])).map((m) => ({
        key: `team:${m.id}`,
        active: presentIds.includes(m.id),
      })),
    [presentIds, layout.spawns],
  )

  useImperativeHandle(
    ref,
    () => ({
      teleportPlayerToSpawn: () => {
        const engine = engineRef.current
        if (!engine || !player) return
        const spawn = layout.spawns[player]
        if (!spawn) return
        engine.teleportCharacter(`team:${player}`, spawn)
      },
    }),
    [player, layout],
  )

  return (
    <div className="relative mx-auto w-full bg-[var(--bg)]">
      <div ref={hostRef} className="w-full" />
      <BubbleOverlay
        positions={positions}
        bubbles={bubbles}
        statusDots={statusDots}
        canvasSize={canvasSize}
      />
    </div>
  )
})

// Re-export the helper so dependents don't import engine internals directly
export const teamLookup = teamById
