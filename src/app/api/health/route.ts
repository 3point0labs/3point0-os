import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ServiceStatus = {
  status: "ok" | "error"
  latency_ms: number
  error?: string
}

type HealthPayload = {
  anthropic: ServiceStatus
  supabase: ServiceStatus
  rocketreach: ServiceStatus
  youtube: ServiceStatus
  gmail: ServiceStatus
}

function ok(latency: number): ServiceStatus {
  return { status: "ok", latency_ms: latency }
}

function fail(latency: number, error: string): ServiceStatus {
  return { status: "error", latency_ms: latency, error }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ""
  const rocketReachKey = process.env.ROCKETREACH_API_KEY ?? ""
  const youtubeKey = process.env.YOUTUBE_API_KEY ?? ""

  const anthropicCheck = async (): Promise<ServiceStatus> => {
    const started = Date.now()
    if (!anthropicKey.trim()) return fail(Date.now() - started, "ANTHROPIC_API_KEY missing")
    try {
      const client = new Anthropic({ apiKey: anthropicKey })
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      })
      return ok(Date.now() - started)
    } catch (e) {
      return fail(Date.now() - started, e instanceof Error ? e.message : "Anthropic check failed")
    }
  }

  const supabaseCheck = async (): Promise<ServiceStatus> => {
    const started = Date.now()
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1)
      if (error) return fail(Date.now() - started, error.message)
      return ok(Date.now() - started)
    } catch (e) {
      return fail(Date.now() - started, e instanceof Error ? e.message : "Supabase check failed")
    }
  }

  const rocketReachCheck = async (): Promise<ServiceStatus> => {
    const started = Date.now()
    if (!rocketReachKey.trim()) return fail(Date.now() - started, "ROCKETREACH_API_KEY missing")
    try {
      const res = await fetch("https://api.rocketreach.co/api/v2/account", {
        headers: { "Api-Key": rocketReachKey },
        cache: "no-store",
      })
      if (!res.ok) {
        return fail(Date.now() - started, `RocketReach returned ${res.status}`)
      }
      return ok(Date.now() - started)
    } catch (e) {
      return fail(Date.now() - started, e instanceof Error ? e.message : "RocketReach check failed")
    }
  }

  const youtubeCheck = async (): Promise<ServiceStatus> => {
    const started = Date.now()
    if (!youtubeKey.trim()) return fail(Date.now() - started, "YOUTUBE_API_KEY missing")
    return ok(Date.now() - started)
  }

  const gmailCheck = async (): Promise<ServiceStatus> => {
    const started = Date.now()
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.provider_token) {
        return fail(Date.now() - started, "No Gmail OAuth token in session")
      }
      return ok(Date.now() - started)
    } catch (e) {
      return fail(Date.now() - started, e instanceof Error ? e.message : "Gmail check failed")
    }
  }

  const [anthropic, supabaseStatus, rocketreach, youtube, gmail] = await Promise.all([
    anthropicCheck(),
    supabaseCheck(),
    rocketReachCheck(),
    youtubeCheck(),
    gmailCheck(),
  ])

  const payload: HealthPayload = {
    anthropic,
    supabase: supabaseStatus,
    rocketreach,
    youtube,
    gmail,
  }

  return NextResponse.json(payload)
}
