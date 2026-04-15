import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type PitchBody = {
  contactName: string
  title: string
  company: string
  podcast: "One54" | "Pressbox Chronicles" | "BOTH"
  pitchAngle: string
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

function podcastContext(podcast: PitchBody["podcast"]) {
  if (podcast === "Pressbox Chronicles") {
    return "PRESSBOX: sports storytelling podcast with deep sports media credibility."
  }
  if (podcast === "BOTH") {
    return "BOTH: can place across One54 and Pressbox Chronicles based on fit."
  }
  return "ONE54: Black culture and business podcast with an engaged Black professional audience."
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

  const body = (await req.json()) as PitchBody
  if (!body.contactName?.trim() || !body.company?.trim()) {
    return NextResponse.json({ error: "Contact and company are required." }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      system:
        "You are an outreach specialist for 3point0 Labs, a media and AI company. You write short, direct cold outreach for podcast sponsorship deals. Before drafting, evaluate the best channel: EMAIL if VP-level or above with direct email; LINKEDIN DM if C-suite/Founder. Output JSON: { recommended_channel, channel_reason, draft_message }. The draft should be 3 paragraphs max, conversational, not salesy. Sign off as: Marquel Martin, 3point0 Labs. Return JSON only.",
      messages: [
        {
          role: "user",
          content: `Contact: ${body.contactName}
Title: ${body.title}
Company: ${body.company}
Podcast context: ${podcastContext(body.podcast)}
Custom pitch angle: ${body.pitchAngle || "(none)"}`,
        },
      ],
    })

    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim()
    const parsed = extractJsonObject(text)
    if (!parsed) {
      return NextResponse.json({ error: "Pitch agent returned invalid JSON." }, { status: 502 })
    }
    return NextResponse.json({
      result: {
        recommended_channel: String(parsed.recommended_channel ?? "EMAIL").toUpperCase(),
        channel_reason: String(parsed.channel_reason ?? ""),
        draft_message: String(parsed.draft_message ?? ""),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pitch request failed." },
      { status: 500 }
    )
  }
}
