"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { ViewMode } from "@/lib/types/profile"

// Persist the user's view-mode preference. Silent-fails if Supabase
// isn't configured so we don't break local dev without creds.
export async function setViewMode(mode: ViewMode): Promise<{ ok: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anon?.trim()) return { ok: false }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => {
        for (const { name, value, options } of entries) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase
    .from("profiles")
    .update({ view_mode: mode })
    .eq("id", user.id)
  if (error) return { ok: false }
  return { ok: true }
}
