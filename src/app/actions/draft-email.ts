"use server";

import Anthropic from "@anthropic-ai/sdk";
import { assertPodcastAccess } from "@/lib/auth-server";
import { getSponsors } from "@/lib/data";
import type { Sponsor } from "@/lib/types";

const MODEL = "claude-sonnet-4-20250514";

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

export async function draftOutreachEmail(
  sponsorId: string
): Promise<
  | {
      ok: true;
      email: string;
      recommendedChannel:
        | "EMAIL"
        | "LINKEDIN DM"
        | "WEBSITE INQUIRY"
        | "INSTAGRAM DM"
        | "COMBINATION";
      reason: string;
    }
  | { ok: false; error: string }
> {
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

  const system = `You are a partnerships lead at 3point0 Labs writing concise, highly personalized B2B cold outreach emails for podcast sponsorship.

Output only the email body (no subject line unless it fits naturally). No markdown fences. Use a specific, brand-aware tone that reflects familiarity with the sponsor's recent activity when context is provided. Always sign as:
Marquel Martin
3point0 Labs`;

  const user = `Write a short, professional cold outreach email for podcast sponsorship.

Context:
- Sender: 3point0 Labs, a media and content company exploring podcast sponsorship opportunities.
- Recipient: ${sponsor.contactName} at ${sponsor.company}
- Podcast being pitched: ${sponsor.podcast}
${sponsor.notes ? `- Internal notes about this prospect (use lightly if relevant): ${sponsor.notes}` : ""}
${sponsor.pitch_angle ? `- Pitch angle for this sponsor (important): ${sponsor.pitch_angle}` : ""}
${enrichment ? `- Recent public news or campaigns about ${sponsor.company}: ${enrichment}` : ""}
${sponsor.youtubeUrl ? `- Podcast YouTube presence for this conversation: ${sponsor.youtubeUrl}` : ""}
${sponsor.socialHandle ? `- Sponsor social handle: ${sponsor.socialHandle}` : ""}
${isPressbox ? `- Pressbox Chronicles context: sports storytelling podcast targeting sports brands, sports betting, athletic apparel, sports media, team partnerships, NIL platforms, sports law firms, and financial advisors targeting athletes.` : ""}

Requirements:
- RECOMMENDED CHANNEL: ${recommendation.channel} — ${recommendation.reason}
- Personalize using the recipient's name and company.
- Mention that 3point0 Labs is a media/content company and we're reaching out about sponsoring ${sponsor.podcast}.
- Use the news/context above to reference something specific about their brand, recent work, or priorities, but do not fabricate details beyond what is provided.
- Use the provided pitch angle as a primary reason this sponsor is a fit, and weave it naturally into the outreach.
- If YouTube URL or social handle are provided, you may reference them lightly (e.g. \"we love how you're showing up on YouTube at ${sponsor.youtubeUrl}\").
- Channel-specific output:
  - EMAIL: draft a cold email.
  - LINKEDIN DM: draft a shorter warmer LinkedIn message (max 150 words).
  - WEBSITE INQUIRY: draft a brief inquiry form message.
  - INSTAGRAM DM: draft a concise, warm DM.
  - COMBINATION: draft the primary outreach email body first, then add a one-line LinkedIn connection note after a blank line.
- Keep it professional, direct, and easy to skim.
- At most 3 short paragraphs.
- If podcast is Pressbox Chronicles, use an energetic sports-forward tone with press-box credibility.
- Do not invent specific listener numbers, download stats, or awards unless provided above.
- Always close with an appropriate sign-off that includes:
  Marquel Martin
  3point0 Labs`;

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    if (!text) {
      return { ok: false, error: "The model returned an empty response." };
    }

    return {
      ok: true,
      email: text,
      recommendedChannel: recommendation.channel,
      reason: recommendation.reason,
    };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to generate email.";
    return { ok: false, error: msg };
  }
}

function recommendChannel(sponsor: Sponsor): {
  channel:
    | "EMAIL"
    | "LINKEDIN DM"
    | "WEBSITE INQUIRY"
    | "INSTAGRAM DM"
    | "COMBINATION";
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
