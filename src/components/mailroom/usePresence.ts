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

function guessMemberId(name: string | null | undefined): TeamMemberId | null {
  if (!name) return null
  const lower = name.toLowerCase()
  if (lower.includes("marquel")) return "marquel"
  if (lower.includes("andrew")) return "andrew"
  if (lower.includes("randy")) return "randy"
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
        await channel.track({
          user_id: userId,
          name,
          member_id: memberId ?? guessMemberId(name),
          online_at: new Date().toISOString(),
        })
        setJoined(true)
      })

    return () => {
      setJoined(false)
      supabase.removeChannel(channel)
    }
  }, [userId, name, memberId])

  return { rows, joined }
}
