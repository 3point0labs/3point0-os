"use server";

import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "fs";
import path from "path";
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

async function loadPlaybooks(podcast: string): Promise<string> {
  const slug = podcast === "Pressbox Chronicles" ? "pressbox" : "one54";
  const dir = path.join(process.cwd(), "docs", "playbooks");
  const pitchPath = path.join(dir, `${slug}-pitch.md`);
  const targetsPath = path.join(dir, `${slug}-target-sponsors.md`);

  try {
    const [pitch, targets] = await Promise.all([
      fs.readFile(pitchPath, "utf-8"),
      fs.readFile(targetsPath, "utf-8"),
    ]);
    return `===== PITCH PLAYBOOK (${podcast}) =====\n${pitch}\n\n===== TARGET SPONSORS PLAYBOOK (${podcast}) =====\n${targets}`;
  } catch (e) {
    console.error(`[draft-email] Failed to load playbooks for ${podcast}:`, e);
    return "";
  }
}

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

  const [enrichment, playbooks] = await Promise.all([
    getCompanyNewsSnippet(sponsor),
    loadPlaybooks(sponsor.podcast),
  ]);

  const recommendation = recommendChannel(sponsor);
  const isPressbox = sponsor.podcast === "Pressbox Chronicles";
  const agentId: AgentId = isPressbox ? "pressbox-outreach" : "sponsor-outreach";

  await logAgentEvent(agentId, "draft-email:start", {
    company: sponsor.company,
    sponsorId: sponsor.id,
    podcast: sponsor.podcast,
    playbooksLoaded: playbooks.length > 0,
  });

  const system = `You are a partnerships lead at 3point0 Labs writing concise, highly personalized B2B cold outreach for podcast sponsorship.

You MUST return strict JSON only. No markdown fences, no prose before or after.

JSON shape:
{
  "email": "full email body, or empty string if channel is LINKEDIN DM only",
  "linkedinMessage": "short LinkedIn connection note or DM, or empty string if not applicable"
}

Channel rules:
- EMAIL: put the full email in "email", leave "linkedinMessage" empty.
- LINKEDIN DM: put the DM in "linkedinMessage", leave "email" empty.
- INSTAGRAM DM: put the DM in "email" (UI treats it as primary body), leave "linkedinMessage" empty.
- WEBSITE INQUIRY: put the inquiry form message in "email", leave "linkedinMessage" empty.
- COMBINATION: put the full cold email in "email" AND a short (1-2 sentence, max 300 chars) LinkedIn connection note in "linkedinMessage". Both required.

Sign-off rules:
- Email always closes with:
  Marquel Martin
  3point0 Labs
- Do NOT add the sign-off to linkedinMessage (it's a short DM).
- Do NOT include subject lines in the email body.
- Do NOT fabricate listener counts, awards, or stats — use only what's in the playbook.

===== BRAND CONTEXT (authoritative) =====
The following two markdown files define the brand voice, audience, positioning, proof points, and target categories for this specific podcast. Treat them as the source of truth. Use specific numbers and references from these files when they fit naturally. Follow the "Do say / Don't say" guidance.

${playbooks || "(No playbook loaded — fall back to professional, direct outreach.)"}
===== END BRAND CONTEXT =====`;

  const user = `Draft outreach for podcast sponsorship.

Recipient: ${sponsor.contactName} at ${sponsor.company}
Podcast: ${sponsor.podcast}
${sponsor.contact_title ? `Contact title: ${sponsor.contact_title}` : ""}
${sponsor.tier ? `Tier: ${sponsor.tier}` : ""}
${sponsor.category ? `Category: ${sponsor.category}` : ""}
${sponsor.notes ? `Internal notes (use lightly): ${sponsor.notes}` : ""}
${sponsor.pitch_angle ? `Pitch angle (important): ${sponsor.pitch_angle}` : ""}
${enrichment ? `Recent public news about ${sponsor.company}: ${enrichment}` : ""}
${sponsor.youtubeUrl ? `Podcast YouTube: ${sponsor.youtubeUrl}` : ""}
${sponsor.socialHandle ? `Sponsor social handle: ${sponsor.socialHandle}` : ""}

Recommended channel: ${recommendation.channel}
Reason: ${recommendation.reason}

Requirements:
- Apply the brand voice and positioning from the playbooks above.
- Match the sponsor to a target category from the target-sponsors playbook and use that category's angle.
- Reference one specific data point from the playbook (e.g. real audience number, real guest, real production credit) — but only when it lands naturally.
- Reference the company's recent news if provided. Do not invent.
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