import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const rrKey = process.env.ROCKETREACH_API_KEY

type ScoutBody = {
  brand: string
  podcast: "One54" | "Pressbox Chronicles" | "BOTH"
}

/** Shape of `profiles[0]` from POST /v2/api/search */
type RocketReachProfile = {
  name?: string
  current_title?: string
  current_employer?: string
  linkedin_url?: string
  emails?: Array<{ email?: string }>
  teaser?: { emails?: Array<string | { email?: string }> }
  links?: { website?: string }
}

function extractJsonObject(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

function logRocketReachKey() {
  console.log("[Scout RR] RocketReach key exists: " + !!process.env.ROCKETREACH_API_KEY)
  console.log("[Scout RR] RocketReach key length: " + (process.env.ROCKETREACH_API_KEY?.length || 0))
}

async function logAndReadBody(res: Response, label: string): Promise<string> {
  const text = await res.text()
  console.log(`[Scout RR] ${label} status=${res.status}`)
  console.log(`[Scout RR] ${label} body (first 2000 chars): ${text.slice(0, 2000)}`)
  return text
}

function emailFromRocketReachProfile(person: RocketReachProfile): string {
  const teaser0 = person.teaser?.emails?.[0]
  if (typeof teaser0 === "string" && teaser0.trim()) return teaser0.trim()
  if (teaser0 && typeof teaser0 === "object" && typeof teaser0.email === "string" && teaser0.email.trim()) {
    return teaser0.email.trim()
  }
  const fromList = person.emails?.[0]?.email?.trim()
  if (fromList) return fromList
  return ""
}

/**
 * POST https://api.rocketreach.co/v2/api/search — returns `profiles`; use first match only.
 */
async function fetchRocketReachProfile(company: string, targetRole: string): Promise<RocketReachProfile | null> {
  logRocketReachKey()
  if (!rrKey?.trim()) return null

  const url = "https://api.rocketreach.co/v2/api/search"
  try {
    const rrResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Api-Key": process.env.ROCKETREACH_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          current_employer: [company],
          title: [targetRole],
        },
        start: 1,
        pageSize: 1,
      }),
      cache: "no-store",
    })

    const rawText = await logAndReadBody(rrResponse, "POST /v2/api/search")
    if (!rrResponse.ok) {
      console.error("[Scout RR] POST /v2/api/search non-OK")
      return null
    }

    let rrData: { profiles?: RocketReachProfile[] }
    try {
      rrData = JSON.parse(rawText) as { profiles?: RocketReachProfile[] }
    } catch (e) {
      console.error("[Scout RR] POST /v2/api/search JSON parse failed", e instanceof Error ? e.message : e)
      return null
    }

    const person = rrData.profiles?.[0]
    return person ?? null
  } catch (e) {
    console.error("[Scout RR] POST /v2/api/search error", e instanceof Error ? e.message : e)
    return null
  }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured." }, { status: 500 })
  }

  const body = (await req.json()) as ScoutBody
  const brand = (body.brand ?? "").trim()
  const podcast = body.podcast ?? "One54"
  if (!brand) {
    return NextResponse.json({ error: "Brand is required." }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system:
        `Given a brand name and podcast sponsorship context, autonomously identify the single best decision-maker to contact for a sponsorship deal. Consider company size — for smaller brands target the CEO/Founder, for mid-size target VP of Partnerships or CMO, for large brands target Head of Sponsorships or Brand Partnerships Manager. Return your reasoning in a "role_logic" field explaining why you chose this role.
Return JSON only with fields: { name, title, company, email, website_url, linkedin_url, confidence, role_logic }.`,
      messages: [
        {
          role: "user",
          content: `Brand: ${brand}\nPodcast sponsorship context: ${podcast}`,
        },
      ],
    })

    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim()
    const parsed = extractJsonObject(text)
    if (!parsed) {
      return NextResponse.json({ error: "Scout agent returned invalid JSON." }, { status: 502 })
    }

    const roleHint = String(parsed.title ?? "")
    const company = String(parsed.company ?? brand)
    const person = await fetchRocketReachProfile(company, roleHint)

    if (person) {
      const rrEmail = emailFromRocketReachProfile(person)
      return NextResponse.json({
        result: {
          name: String(person.name ?? parsed.name ?? ""),
          title: String(person.current_title ?? parsed.title ?? ""),
          company: String(person.current_employer ?? parsed.company ?? brand),
          email: rrEmail || String(parsed.email ?? ""),
          website_url: String(person.links?.website ?? parsed.website_url ?? ""),
          linkedin_url: String(person.linkedin_url ?? parsed.linkedin_url ?? ""),
          confidence: "VERIFIED",
          role_logic: String(parsed.role_logic ?? ""),
          source: "via RocketReach",
        },
      })
    }

    return NextResponse.json({
      result: {
        name: String(parsed.name ?? ""),
        title: String(parsed.title ?? ""),
        company: String(parsed.company ?? brand),
        email: String(parsed.email ?? ""),
        website_url: String(parsed.website_url ?? ""),
        linkedin_url: String(parsed.linkedin_url ?? ""),
        confidence: "CONSTRUCTED",
        role_logic: String(parsed.role_logic ?? ""),
        source: "AI constructed",
      },
    })
  } catch (e) {
    console.error("[Scout] POST error", e instanceof Error ? e.message : e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scout request failed." },
      { status: 500 }
    )
  }
}
