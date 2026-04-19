"use client"

import { useEffect, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import type { TeamMemberId } from "@/lib/mailroom/config/types"

export type PresenceRow = {
  user_id: string
  name: string | null
  member_id: TeamMemberId | null
  online_at: string
}

const CHANNEL = "presence:mailroom"
// How often we re-publish our own presence row. Must be <= ACTIVE_WINDOW
// or we'll mark ourselves away between heartbeats.
const HEARTBEAT_MS = 30_000
// How often the local clock ticks so freshness checks re-evaluate even
// if no presence sync event fires (e.g. nobody else joined or left).
const TICK_MS = 15_000
// Anyone whose last online_at is older than this window is "away".
export const ACTIVE_WINDOW_MS = 60_000

export function isActivePresence(row: { online_at: string }, now = Date.now()) {
  const t = new Date(row.online_at).getTime()
  if (Number.isNaN(t)) return false
  return now - t < ACTIVE_WINDOW_MS
}

function guessMemberId(name: string | null | undefined): TeamMemberId | null {
  if (!name) return null
  const lower = name.toLowerCase()
  if (lower.includes("marquel")) return "marquel"
  if (lower.includes("andrew")) return "andrew"
  if (lower.includes("randy")) return "randy"
  if (lower.includes("kari")) return "kari"
  return null
}

type Opts = {
  userId: string | null
  name: string | null
  memberId: TeamMemberId | null
}

export function usePresence({ userId, name, memberId }: Opts) {
  const [rows, setRows] = useState<PresenceRow[]>([])
  const [joined, setJoined] = useState(false)
  // tick is bumped every TICK_MS so consumers re-evaluate their
  // ACTIVE_WINDOW_MS freshness checks even when no presence sync fires.
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!userId) {
      setRows([])
      setJoined(false)
      return
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url?.trim() || !key?.trim()) return

    const supabase = createClient()
    const channel: RealtimeChannel = supabase.channel(CHANNEL, {
      config: { presence: { key: userId } },
    })

    let heartbeatId: ReturnType<typeof setInterval> | null = null

    const trackNow = () =>
      channel.track({
        user_id: userId,
        name,
        member_id: memberId ?? guessMemberId(name),
        online_at: new Date().toISOString(),
      })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresenceRow[]>
        const next: PresenceRow[] = []
        for (const list of Object.values(state)) {
          for (const row of list) {
            next.push(row)
          }
        }
        setRows(next)
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return
        await trackNow()
        setJoined(true)
        heartbeatId = setInterval(() => {
          void trackNow()
        }, HEARTBEAT_MS)
      })

    return () => {
      setJoined(false)
      if (heartbeatId) clearInterval(heartbeatId)
      supabase.removeChannel(channel)
    }
  }, [userId, name, memberId])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS)
    return () => clearInterval(id)
  }, [])

  return { rows, joined, tick }
}
