import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const rrKey = process.env.ROCKETREACH_API_KEY

type ScoutBody = {
  brand: string
  podcast: "One54" | "Pressbox Chronicles" | "BOTH"
}

type RocketReachPerson = {
  id?: number | string
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

function logRocketReachKey() {
  console.log("[Scout RR] RocketReach key exists: " + !!process.env.ROCKETREACH_API_KEY)
  console.log("[Scout RR] RocketReach key length: " + (process.env.ROCKETREACH_API_KEY?.length || 0))
}

function parseRocketReachPeople(raw: unknown): RocketReachPerson[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as RocketReachPerson[]
  if (typeof raw !== "object") return []
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.results)) return obj.results as RocketReachPerson[]
  if (Array.isArray(obj.profiles)) return obj.profiles as RocketReachPerson[]
  if (Array.isArray(obj.people)) return obj.people as RocketReachPerson[]
  if (obj.person && typeof obj.person === "object") return [obj.person as RocketReachPerson]
  if (obj.profile && typeof obj.profile === "object") return [obj.profile as RocketReachPerson]
  if (typeof obj.id === "number" || typeof obj.id === "string") return [obj as RocketReachPerson]
  return []
}

function firstEmailFromPerson(p: RocketReachPerson): string {
  const fromList = p.emails?.[0]?.email?.trim()
  if (fromList) return fromList
  const direct = (p as Record<string, unknown>).email
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  return ""
}

async function logAndReadBody(res: Response, label: string): Promise<string> {
  const text = await res.text()
  console.log(`[Scout RR] ${label} status=${res.status}`)
  console.log(`[Scout RR] ${label} body (first 2000 chars): ${text.slice(0, 2000)}`)
  return text
}

/** POST https://api.rocketreach.co/v2/api/search — returns profile stubs (often without emails). */
async function rocketReachSearch(company: string, title: string): Promise<RocketReachPerson[]> {
  if (!rrKey?.trim()) return []
  const url = "https://api.rocketreach.co/v2/api/search"
  const body = {
    query: {
      current_employer: [company],
      ...(title.trim() ? { title: [title] } : {}),
    },
    start: 1,
    pageSize: 5,
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Api-Key": rrKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    const rawText = await logAndReadBody(res, "POST /v2/api/search")
    if (!res.ok) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText) as unknown
    } catch {
      console.error("[Scout RR] POST /v2/api/search JSON parse failed")
      return []
    }
    return parseRocketReachPeople(parsed)
  } catch (e) {
    console.error("[Scout RR] POST /v2/api/search error", e instanceof Error ? e.message : e)
    return []
  }
}

/** GET https://api.rocketreach.co/api/v2/person/lookup?id=… — full profile incl. emails when complete. */
async function rocketReachLookupById(id: number | string): Promise<RocketReachPerson | null> {
  if (!rrKey?.trim()) return null
  const url = new URL("https://api.rocketreach.co/api/v2/person/lookup")
  url.searchParams.set("id", String(id))
  try {
    const res = await fetch(url.toString(), {
      headers: { "Api-Key": rrKey },
      cache: "no-store",
    })
    const rawText = await logAndReadBody(res, `GET person/lookup id=${id}`)
    if (!res.ok) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText) as unknown
    } catch {
      console.error("[Scout RR] person/lookup JSON parse failed")
      return null
    }
    const people = parseRocketReachPeople(parsed)
    return people[0] ?? null
  } catch (e) {
    console.error("[Scout RR] person/lookup by id error", e instanceof Error ? e.message : e)
    return null
  }
}

async function rocketReachLookupQuery(params: Record<string, string>): Promise<RocketReachPerson | null> {
  if (!rrKey?.trim()) return null
  try {
    const url = new URL("https://api.rocketreach.co/api/v2/person/lookup")
    Object.entries(params).forEach(([k, v]) => {
      if (v.trim() !== "") url.searchParams.set(k, v.trim())
    })
    const res = await fetch(url.toString(), {
      headers: { "Api-Key": rrKey },
      cache: "no-store",
    })
    const rawText = await logAndReadBody(res, `GET person/lookup ${url.search}`)
    if (!res.ok) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText) as unknown
    } catch {
      console.error("[Scout RR] person/lookup query JSON parse failed")
      return null
    }
    const people = parseRocketReachPeople(parsed).filter(Boolean)
    return people[0] ?? null
  } catch (e) {
    console.error("[Scout RR] person/lookup query error", e instanceof Error ? e.message : e)
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

/**
 * Try RocketReach in order: POST search → lookup by id → query lookup with title → employer-only → name=&employer.
 * Any failure is logged; returns null so Claude fallback still works.
 */
async function enrichWithRocketReach(company: string, roleHint: string): Promise<RocketReachPerson | null> {
  logRocketReachKey()
  if (!rrKey?.trim()) return null

  try {
    const searchHits = await rocketReachSearch(company, roleHint)
    const candidate =
      searchHits.length > 0 ? pickBestRoleMatch(searchHits, roleHint) ?? searchHits[0] : null
    if (candidate?.id !== undefined && candidate.id !== null && candidate.id !== "") {
      const byId = await rocketReachLookupById(candidate.id)
      if (byId && (firstEmailFromPerson(byId) || byId.name)) {
        return { ...candidate, ...byId, emails: byId.emails?.length ? byId.emails : candidate.emails }
      }
    }

    let person = await rocketReachLookupQuery({ current_employer: company, title: roleHint })
    if (person) return person

    const urlOnly = new URL("https://api.rocketreach.co/api/v2/person/lookup")
    urlOnly.searchParams.set("current_employer", company)
    try {
      const res = await fetch(urlOnly.toString(), { headers: { "Api-Key": rrKey }, cache: "no-store" })
      const rawText = await logAndReadBody(res, "GET person/lookup employer-only")
      if (res.ok) {
        try {
          const parsed = JSON.parse(rawText) as unknown
          const list = parseRocketReachPeople(parsed)
          person = pickBestRoleMatch(list, roleHint)
          if (person) return person
        } catch {
          console.error("[Scout RR] employer-only JSON parse failed")
        }
      }
    } catch (e) {
      console.error("[Scout RR] employer-only lookup error", e instanceof Error ? e.message : e)
    }

    person = await rocketReachLookupQuery({ name: "", current_employer: company })
    return person
  } catch (e) {
    console.error("[Scout RR] enrichWithRocketReach outer catch", e instanceof Error ? e.message : e)
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
    const rrPerson = await enrichWithRocketReach(company, roleHint)

    const rrEmail = rrPerson ? firstEmailFromPerson(rrPerson) : ""
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
    console.error("[Scout] POST error", e instanceof Error ? e.message : e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scout request failed." },
      { status: 500 }
    )
  }
}
