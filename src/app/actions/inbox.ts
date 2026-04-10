"use server";

import Anthropic from "@anthropic-ai/sdk";
import { assertPodcastAccess } from "@/lib/auth-server";

const HAIKU = "claude-haiku-4-5-20251001";

export type InboxEmail = {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  category: "sponsorship" | "guest_request" | "other";
  body?: string;
  threadContext?: string;
};

function categorize(subject: string, snippet: string): InboxEmail["category"] {
  const text = `${subject} ${snippet}`.toLowerCase();
  if (
    text.includes("sponsor") || text.includes("partner") ||
    text.includes("collab") || text.includes("commission") ||
    text.includes("advertis") || text.includes("brand deal")
  ) return "sponsorship";
  if (
    text.includes("guest") || text.includes("interview") ||
    text.includes("episode") || text.includes("appear") ||
    text.includes("request")
  ) return "guest_request";
  return "other";
}

export async function getInboxEmails(): Promise<{
  ok: true;
  emails: InboxEmail[];
} | { ok: false; error: string }> {
  try {
    await assertPodcastAccess("One54");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  // This action is called client-side via server action — 
  // Gmail is read via the MCP connector on Claude's side.
  // We return a structured list for the UI to render.
  // The actual Gmail fetch happens via the API route below.
  return { ok: true, emails: [] };
}

export async function draftInboxReply(
  threadContext: string,
  subject: string,
  category: InboxEmail["category"],
  fromName: string
): Promise<{ ok: true; draft: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) return { ok: false, error: "ANTHROPIC_API_KEY not configured." };

  const client = new Anthropic({ apiKey });

  const isGuest = category === "guest_request";
  const isSponsorship = category === "sponsorship";

  try {
    const msg = await client.messages.create({
      model: HAIKU,
      max_tokens: 500,
      system: `You write concise, warm replies for One54 Africa podcast. Always sign as: One54 Africa Team`,
      messages: [{
        role: "user",
        content: `Draft a reply to this email thread. Be warm, professional, and brief (max 3 short paragraphs).

Thread context:
${threadContext}

${isGuest ? "This is a guest request. Acknowledge the suggestion enthusiastically, say the team will review it, and encourage them to stay connected with the show." : ""}
${isSponsorship ? "This is a sponsorship/collab inquiry. Acknowledge their interest, say the team will review the opportunity, and ask for more details about their budget and timeline if not already provided." : ""}
${!isGuest && !isSponsorship ? "Reply professionally and helpfully." : ""}

Sign as: One54 Africa Team`,
      }],
    });

    const draft = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return { ok: true, draft };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Draft failed." };
  }
}