import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ScoutBody = {
  brand: string
  podcast: "One54" | "Pressbox Chronicles" | "BOTH"
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
    return NextResponse.json({
      result: {
        name: String(parsed.name ?? ""),
        title: String(parsed.title ?? ""),
        company: String(parsed.company ?? brand),
        email: String(parsed.email ?? ""),
        website_url: String(parsed.website_url ?? ""),
        linkedin_url: String(parsed.linkedin_url ?? ""),
        confidence: String(parsed.confidence ?? "LOW").toUpperCase(),
        role_logic: String(parsed.role_logic ?? ""),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scout request failed." },
      { status: 500 }
    )
  }
}
