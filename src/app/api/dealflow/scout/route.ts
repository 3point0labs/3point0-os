import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ScoutBody = {
  brand: string
  targetRole: string
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
  const targetRole = (body.targetRole ?? "").trim()
  if (!brand || !targetRole) {
    return NextResponse.json({ error: "Brand and role are required." }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system:
        'You are a B2B contact researcher. Given a brand name and target role, return the most likely decision-maker at that company in JSON format: { name, title, company, email, linkedin_url, confidence }. For email, construct the most likely format based on company domain conventions. For LinkedIn, construct the most likely URL. Confidence should be HIGH if the person is well known, MEDIUM if inferred, LOW if guessed. Return JSON only.',
      messages: [
        {
          role: "user",
          content: `Brand: ${brand}\nTarget role: ${targetRole}`,
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
        linkedin_url: String(parsed.linkedin_url ?? ""),
        confidence: String(parsed.confidence ?? "LOW").toUpperCase(),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scout request failed." },
      { status: 500 }
    )
  }
}
