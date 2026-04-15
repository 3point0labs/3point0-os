import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const rrKey = process.env.ROCKETREACH_API_KEY

type ScoutBody = {
  brand: string
  podcast: "One54" | "Pressbox Chronicles" | "BOTH"
}

type RocketReachPerson = {
  name?: string
  current_title?: string
  current_employer?: string
  linkedin_url?: string
  emails?: Array<{ email?: string }>
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

function parseRocketReachPeople(raw: unknown): RocketReachPerson[] {
  if (!raw || typeof raw !== "object") return []
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.results)) return obj.results as RocketReachPerson[]
  if (Array.isArray(obj.people)) return obj.people as RocketReachPerson[]
  if (obj.person && typeof obj.person === "object") return [obj.person as RocketReachPerson]
  if (obj.profile && typeof obj.profile === "object") return [obj.profile as RocketReachPerson]
  return [obj as RocketReachPerson]
}

async function lookupRocketReach(params: Record<string, string>): Promise<RocketReachPerson | null> {
  if (!rrKey?.trim()) return null
  try {
    const url = new URL("https://api.rocketreach.co/api/v2/person/lookup")
    Object.entries(params).forEach(([k, v]) => {
      if (v.trim()) url.searchParams.set(k, v.trim())
    })
    const res = await fetch(url.toString(), {
      headers: { "Api-Key": rrKey },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    const people = parseRocketReachPeople(data).filter(Boolean)
    return people[0] ?? null
  } catch {
    return null
  }
}

function pickBestRoleMatch(people: RocketReachPerson[], roleHint: string): RocketReachPerson | null {
  if (people.length === 0) return null
  const words = roleHint
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  let best: RocketReachPerson | null = people[0]
  let bestScore = -1
  for (const p of people) {
    const title = (p.current_title ?? "").toLowerCase()
    const score = words.reduce((acc, w) => (title.includes(w) ? acc + 1 : acc), 0)
    if (score > bestScore) {
      best = p
      bestScore = score
    }
  }
  return best
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
    let rrPerson = await lookupRocketReach({ current_employer: company, title: roleHint })
    if (!rrPerson) {
      try {
        const url = new URL("https://api.rocketreach.co/api/v2/person/lookup")
        url.searchParams.set("current_employer", company)
        const res = rrKey?.trim()
          ? await fetch(url.toString(), { headers: { "Api-Key": rrKey }, cache: "no-store" })
          : null
        if (res?.ok) {
          const data = (await res.json()) as unknown
          rrPerson = pickBestRoleMatch(parseRocketReachPeople(data), roleHint)
        }
      } catch {
        rrPerson = null
      }
    }

    const rrEmail = rrPerson?.emails?.[0]?.email?.trim() ?? ""
    const isVerified = Boolean(rrPerson && rrEmail)

    return NextResponse.json({
      result: {
        name: isVerified ? String(rrPerson?.name ?? parsed.name ?? "") : String(parsed.name ?? ""),
        title: isVerified
          ? String(rrPerson?.current_title ?? parsed.title ?? "")
          : String(parsed.title ?? ""),
        company: isVerified
          ? String(rrPerson?.current_employer ?? parsed.company ?? brand)
          : String(parsed.company ?? brand),
        email: isVerified ? rrEmail : String(parsed.email ?? ""),
        website_url: isVerified
          ? String(rrPerson?.links?.website ?? parsed.website_url ?? "")
          : String(parsed.website_url ?? ""),
        linkedin_url: isVerified
          ? String(rrPerson?.linkedin_url ?? parsed.linkedin_url ?? "")
          : String(parsed.linkedin_url ?? ""),
        confidence: isVerified ? "VERIFIED" : "CONSTRUCTED",
        role_logic: String(parsed.role_logic ?? ""),
        source: isVerified ? "via RocketReach" : "AI constructed",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scout request failed." },
      { status: 500 }
    )
  }
}
