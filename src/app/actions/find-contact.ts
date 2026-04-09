"use server";

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";

export async function findBestContact(company: string): Promise<
  | {
      ok: true;
      contactName: string;
      contactTitle: string;
      linkedinUrl: string;
      rationale: string;
    }
  | { ok: false; error: string }
> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
  }

  const target = company.trim();
  if (!target) {
    return { ok: false, error: "Company name is required." };
  }

  const client = new Anthropic({ apiKey });
  const system =
    "You are a partnerships prospecting assistant. Return only strict JSON.";
  const user = `Find the most likely decision-maker for podcast sponsorships at ${target} (partnerships/brand marketing role).
Return strict JSON only with keys:
contactName, contactTitle, linkedinUrl, rationale
If uncertain, still provide the best likely contact profile with explicit uncertainty in rationale.
linkedinUrl should be a plausible LinkedIn profile URL format.`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
      contactName?: string;
      contactTitle?: string;
      linkedinUrl?: string;
      rationale?: string;
    };

    if (!parsed.contactName || !parsed.contactTitle) {
      return { ok: false, error: "Agent returned incomplete contact data." };
    }

    return {
      ok: true,
      contactName: parsed.contactName.trim(),
      contactTitle: (parsed.contactTitle ?? "").trim(),
      linkedinUrl: (parsed.linkedinUrl ?? "").trim(),
      rationale: (parsed.rationale ?? "").trim(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to find contact.";
    return { ok: false, error: msg };
  }
}
