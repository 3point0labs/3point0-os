"use server";

import Anthropic from "@anthropic-ai/sdk";
import { assertPodcastAccess } from "@/lib/auth-server";
import { getSponsors } from "@/lib/data";
import { logAgentEvent } from "@/lib/mailroom/activity";
import type { AgentId } from "@/lib/mailroom/config/types";
import type { Sponsor } from "@/lib/types";

const MODEL = "claude-sonnet-4-20250514";

type ChannelType =
  | "EMAIL"
  | "LINKEDIN DM"
  | "WEBSITE INQUIRY"
  | "INSTAGRAM DM"
  | "COMBINATION";

export type DraftOutreachResult =
  | {
      ok: true;
      email: string;
      linkedinMessage: string | null;
      linkedinUrl: string | null;
      recommendedChannel: ChannelType;
      reason: string;
    }
  | { ok: false; error: string };

async function getCompanyNewsSnippet(sponsor: Sponsor): Promise<string | null> {
  const query = `${sponsor.company} latest campaign product launch news`;
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&ia=news`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; 3point0-os-bot/1.0; +https://example.com)",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/<a[^>]+class="result__a"[^>]*>(.*?)<\/a>/i);
    const title = match
      ? match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : null;

    const snippetMatch = html.match(
      /<a[^>]+class="result__a"[^>]*>.*?<\/a>.*?<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/i
    );
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : null;

    const combined =
      title && snippet ? `${title} — ${snippet}` : title || snippet;

    return combined || null;
  } catch {
    return null;
  }
}

function parseJsonSafe(text: string): { email?: string; linkedinMessage?: string } | null {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { email?: string; linkedinMessage?: string };
    return parsed;
  } catch {
    return null;
  }
}

export async function draftOutreachEmail(sponsorId: string): Promise<DraftOutreachResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
  }

  const sponsors = await getSponsors();
  const sponsor = sponsors.find((s) => s.id === sponsorId);
  if (!sponsor) {
    return { ok: false, error: "Sponsor not found." };
  }

  try {
    await assertPodcastAccess(sponsor.podcast);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const enrichment = await getCompanyNewsSnippet(sponsor);
  const recommendation = recommendChannel(sponsor);
  const isPressbox = sponsor.podcast === "Pressbox Chronicles";
  const agentId: AgentId = isPressbox ? "pressbox-outreach" : "sponsor-outreach";
  await logAgentEvent(agentId, "draft-email:start", {
    company: sponsor.company,
    sponsorId: sponsor.id,
    podcast: sponsor.podcast,
  });

  const system = `You are a partnerships lead at 3point0 Labs writing concise, highly personalized B2B cold outreach for podcast sponsorship.

You MUST return strict JSON only. No markdown fences, no prose before or after.

JSON shape:
{
  "email": "full email body, or empty string if channel is LINKEDIN DM / INSTAGRAM DM only",
  "linkedinMessage": "short LinkedIn connection note or DM, or empty string if not applicable"
}

Rules:
- EMAIL channel: put the full email in "email", leave "linkedinMessage" as empty string.
- LINKEDIN DM channel: put the LinkedIn DM in "linkedinMessage", leave "email" as empty string.
- INSTAGRAM DM channel: put the DM in "email" (UI treats it as primary body), leave "linkedinMessage" empty.
- WEBSITE INQUIRY channel: put the inquiry form message in "email", leave "linkedinMessage" empty.
- COMBINATION channel: put the full cold email in "email" AND a short (1-2 sentence, max 300 chars) LinkedIn connection note in "linkedinMessage". Both must be present.

The email should always close with the sign-off:
Marquel Martin
3point0 Labs

Do not add the sign-off to the linkedinMessage — it's a short DM.
Do not include subject lines in the email body.
Do not fabricate listener counts, awards, or stats.`;

  const user = `Draft outreach for podcast sponsorship.

Recipient: ${sponsor.contactName} at ${sponsor.company}
Podcast: ${sponsor.podcast}
${sponsor.contact_title ? `Contact title: ${sponsor.contact_title}` : ""}
${sponsor.notes ? `Internal notes (use lightly): ${sponsor.notes}` : ""}
${sponsor.pitch_angle ? `Pitch angle (important): ${sponsor.pitch_angle}` : ""}
${enrichment ? `Recent public news about ${sponsor.company}: ${enrichment}` : ""}
${sponsor.youtubeUrl ? `Podcast YouTube: ${sponsor.youtubeUrl}` : ""}
${sponsor.socialHandle ? `Sponsor social handle: ${sponsor.socialHandle}` : ""}
${isPressbox ? `Pressbox context: sports storytelling podcast. Targets sports brands, betting, athletic apparel, sports media, team partnerships, NIL platforms, sports law firms, athlete financial advisors.` : `One54 context: African business, innovation, and culture podcast. Targets African fintech, global brands entering Africa, CPG, enterprise SaaS, media.`}

Recommended channel: ${recommendation.channel}
Reason: ${recommendation.reason}

Tone:
- 3point0 Labs is a media/content company reaching out about sponsoring ${sponsor.podcast}.
- ${isPressbox ? "Energetic, sports-forward, press-box credibility." : "Professional, insider-led, operator-audience framing."}
- Reference something specific from the recent news if provided. Do not invent.
- Weave the pitch angle naturally.
- Max 3 short paragraphs for email.
- LinkedIn connection note (if COMBINATION): 1-2 sentences, references the email you just sent.

Return JSON only.`;

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1400,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    if (!text) {
      await logAgentEvent(agentId, "draft-email:error", {
        company: sponsor.company,
        reason: "empty response",
      });
      return { ok: false, error: "The model returned an empty response." };
    }

    const parsed = parseJsonSafe(text);
    if (!parsed) {
      await logAgentEvent(agentId, "draft-email:error", {
        company: sponsor.company,
        reason: "failed to parse JSON",
      });
      return { ok: false, error: "Agent returned invalid JSON. Try again." };
    }

    const emailBody = (parsed.email ?? "").trim();
    const linkedinMessage = (parsed.linkedinMessage ?? "").trim();

    // Sanity: if channel is EMAIL-based and no email body came back, fail
    if (!emailBody && !linkedinMessage) {
      await logAgentEvent(agentId, "draft-email:error", {
        company: sponsor.company,
        reason: "both email and linkedin empty",
      });
      return { ok: false, error: "Agent returned no content." };
    }

    await logAgentEvent(agentId, "draft-email:done", {
      company: sponsor.company,
      sponsorId: sponsor.id,
      channel: recommendation.channel,
    });

    return {
      ok: true,
      email: emailBody,
      linkedinMessage: linkedinMessage || null,
      linkedinUrl: sponsor.linkedin_url ?? null,
      recommendedChannel: recommendation.channel,
      reason: recommendation.reason,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to generate email.";
    await logAgentEvent(agentId, "draft-email:error", {
      company: sponsor.company,
      reason: msg,
    });
    return { ok: false, error: msg };
  }
}

function recommendChannel(sponsor: Sponsor): {
  channel: ChannelType;
  reason: string;
} {
  const title = (sponsor.contact_title ?? "").toLowerCase();
  const email = sponsor.email.toLowerCase();
  const hasLinkedIn = Boolean(sponsor.linkedin_url);
  const tier = (sponsor.tier ?? "").toUpperCase();
  const hasIg = Boolean(sponsor.company_instagram || sponsor.socialHandle);
  const isFounderOrCxo =
    title.includes("ceo") ||
    title.includes("founder") ||
    title.includes("co-founder") ||
    title.includes("chief");
  const isVpPlus =
    title.includes("vp") ||
    title.includes("vice president") ||
    title.includes("head of") ||
    isFounderOrCxo;
  const genericEmail =
    email.startsWith("partnerships@") ||
    email.startsWith("info@") ||
    email.startsWith("hello@");

  if (tier === "S" && hasLinkedIn && email) {
    return {
      channel: "COMBINATION",
      reason: "Tier S account; use email plus same-day LinkedIn touch for higher reply odds.",
    };
  }
  if (isFounderOrCxo && hasLinkedIn) {
    return {
      channel: "LINKEDIN DM",
      reason: "Founder/C-suite contact with LinkedIn available; DM is typically warmer than cold email.",
    };
  }
  if (genericEmail) {
    return {
      channel: "WEBSITE INQUIRY",
      reason: "Only a generic inbox is available, so send a concise inquiry-form style message.",
    };
  }
  if ((title.includes("founder") || title.includes("creator")) && hasIg) {
    return {
      channel: "INSTAGRAM DM",
      reason: "Founder/creator profile with active IG presence; DM likely gets faster attention.",
    };
  }
  if (email && isVpPlus) {
    return {
      channel: "EMAIL",
      reason: "Direct email is available for a VP+ decision-maker.",
    };
  }
  if (hasLinkedIn) {
    return {
      channel: "LINKEDIN DM",
      reason: "LinkedIn profile is available and likely the best direct channel.",
    };
  }
  return {
    channel: "EMAIL",
    reason: "Defaulting to email for initial outreach.",
  };
}