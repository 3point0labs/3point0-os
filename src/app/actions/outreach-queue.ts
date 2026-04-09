"use server";

import Anthropic from "@anthropic-ai/sdk";
import { assertPodcastAccess } from "@/lib/auth-server";
import { getSponsors } from "@/lib/data";
import type { Sponsor } from "@/lib/types";

// Haiku for queue drafts — 10x cheaper than Sonnet
const QUEUE_MODEL = "claude-haiku-4-5-20251001";

function daysSince(dateStr: string) {
  if (!dateStr) return null;
  const then = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function shouldQueue(s: Sponsor): { queue: boolean; reason: string } {
  const tier = (s.tier ?? "").toUpperCase();
  const since = daysSince(s.lastContactDate);

  if (tier === "S" && s.stage === "New") {
    return { queue: true, reason: "Tier S — never contacted" };
  }
  if (since !== null && since >= 7 && s.stage !== "Closed") {
    return { queue: true, reason: `Silent ${since} days` };
  }
  if (tier === "A" && s.stage === "New") {
    return { queue: true, reason: "Tier A — never contacted" };
  }
  return { queue: false, reason: "" };
}

export type QueueItem = {
  sponsor: Sponsor;
  reason: string;
  draft: string;
  channel: string;
  cached: boolean;
};

// Simple in-memory draft cache — per deployment instance
// Clears on redeploy, which is fine for this use case
const draftCache = new Map<string, { draft: string; channel: string; ts: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getOutreachQueue(
  podcast: "One54" | "Pressbox Chronicles"
): Promise<{ ok: true; items: QueueItem[] } | { ok: false; error: string }> {
  try {
    await assertPodcastAccess(podcast);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    return { ok: false, error: "ANTHROPIC_API_KEY not configured." };
  }

  const sponsors = await getSponsors();
  const targets = sponsors
    .filter((s) => s.podcast === podcast)
    .map((s) => ({ s, ...shouldQueue(s) }))
    .filter((x) => x.queue)
    .sort((a, b) => {
      const tierOrder = (t: string) =>
        t === "S" ? 0 : t === "A" ? 1 : 2;
      const ta = tierOrder((a.s.tier ?? "").toUpperCase());
      const tb = tierOrder((b.s.tier ?? "").toUpperCase());
      return ta - tb;
    })
    .slice(0, 8); // cap at 8 to control cost

  if (targets.length === 0) {
    return { ok: true, items: [] };
  }

  const client = new Anthropic({ apiKey });
  const items: QueueItem[] = [];

  // Batch: draft all uncached in parallel
  const uncached = targets.filter((t) => {
    const hit = draftCache.get(t.s.id);
    return !hit || Date.now() - hit.ts > CACHE_TTL_MS;
  });

  const cached = targets.filter((t) => {
    const hit = draftCache.get(t.s.id);
    return hit && Date.now() - hit.ts <= CACHE_TTL_MS;
  });

  // Generate uncached drafts in parallel with Haiku
  const draftPromises = uncached.map(async (target) => {
    const s = target.s;
    const isPressbox = s.podcast === "Pressbox Chronicles";

    try {
      const msg = await client.messages.create({
        model: QUEUE_MODEL,
        max_tokens: 600,
        system: `You write short, punchy podcast sponsorship outreach messages for 3point0 Labs. Always sign as: Marquel Martin\n3point0 Labs`,
        messages: [
          {
            role: "user",
            content: `Write a 2-paragraph cold outreach message to ${s.contactName} at ${s.company} about sponsoring ${s.podcast}.
${s.pitch_angle ? `Pitch angle: ${s.pitch_angle}` : ""}
${isPressbox ? "Pressbox Chronicles is a sports storytelling podcast." : "One54 is an African business and culture podcast."}
Keep it under 120 words. End with: Marquel Martin\n3point0 Labs`,
          },
        ],
      });

      const draft = msg.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();

      // Determine channel simply
      const title = (s.contact_title ?? "").toLowerCase();
      const isCxo =
        title.includes("ceo") ||
        title.includes("founder") ||
        title.includes("chief");
      const channel =
        (s.tier ?? "").toUpperCase() === "S" && s.linkedin_url && s.email
          ? "COMBINATION"
          : isCxo && s.linkedin_url
          ? "LINKEDIN DM"
          : "EMAIL";

      draftCache.set(s.id, { draft, channel, ts: Date.now() });
      return { id: s.id, draft, channel, cached: false };
    } catch {
      return { id: s.id, draft: "", channel: "EMAIL", cached: false };
    }
  });

  const draftResults = await Promise.all(draftPromises);
  const draftMap = new Map(draftResults.map((d) => [d.id, d]));

  for (const target of targets) {
    const hit = draftCache.get(target.s.id);
    const isFromCache = cached.some((c) => c.s.id === target.s.id);
    const generated = draftMap.get(target.s.id);

    const draft = hit?.draft ?? generated?.draft ?? "";
    const channel = hit?.channel ?? generated?.channel ?? "EMAIL";

    if (draft) {
      items.push({
        sponsor: target.s,
        reason: target.reason,
        draft,
        channel,
        cached: isFromCache,
      });
    }
  }

  return { ok: true, items };
}