"use server";

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getSponsors, saveSponsors } from "@/lib/data";
import { readSettings, writeSettings, type AppSettings } from "@/lib/settings";
import type { Podcast } from "@/lib/types";
import { PODCASTS } from "@/lib/types";

const MODEL = "claude-haiku-4-5-20251001";

const ONE54_AGENT_CONTEXT = `One54 — African business, innovation, and culture podcast. Audience: globally curious listeners interested in Africa's economies, founders, and trends. Partnership tone: professional, brand-aware, growth-focused.`;

const PRESSBOX_AGENT_CONTEXT = `Pressbox Chronicles — sports storytelling with press-box credibility. Target sectors: sports brands, sports betting, athletic apparel, sports media, team partnerships, NIL platforms, sports law firms, athlete-focused financial advisors. Tone: energetic, sports-forward, concise.`;

export type DiscoveryRow = {
  brand: string;
  category: string;
  tier: string;
  contactName: string;
  title: string;
  email: string;
  linkedinUrl: string;
  pitchAngle: string;
  /** Set when merging multi-podcast runs */
  podcast?: Podcast;
};

function podcastContext(name: "One54" | "Pressbox Chronicles") {
  return name === "One54" ? ONE54_AGENT_CONTEXT : PRESSBOX_AGENT_CONTEXT;
}

function extractMessageText(message: Anthropic.Message): string {
  return message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

function parseDiscoveryJson(raw: string): DiscoveryRow[] {
  const cleaned = raw
    .replace(/^[\s\S]*?```json\s*/i, "")
    .replace(/^[\s\S]*?```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  const slice = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(slice) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        brand: String(r.brand ?? "").trim(),
        category: String(r.category ?? "").trim(),
        tier: String(r.tier ?? "B").trim(),
        contactName: String(r.contactName ?? "").trim(),
        title: String(r.title ?? "").trim(),
        email: String(r.email ?? "").trim(),
        linkedinUrl: String(r.linkedinUrl ?? r.linkedin_url ?? "").trim(),
        pitchAngle: String(r.pitchAngle ?? r.pitch_angle ?? "").trim(),
      };
    })
    .filter((r) => r.brand.length > 0);
}

function normalizeTier(t: string): "S" | "A" | "B" {
  const u = t.toUpperCase();
  if (u === "S" || u === "A" || u === "B") return u;
  return "B";
}

function cleanLinkedIn(url: string): string | undefined {
  const t = url.trim();
  if (!t) return undefined;
  if (t.startsWith("http")) return t;
  if (t.includes("linkedin.com")) return t.startsWith("//") ? `https:${t}` : `https://${t}`;
  return undefined;
}

function buildPrompt(opts: {
  podcastName: string;
  podcastContext: string;
  count: number;
  categoryLabel: string;
  existingCompanies: string[];
}) {
  const existing =
    opts.existingCompanies.length > 0
      ? opts.existingCompanies.slice(0, 800).join(", ")
      : "(none)";

  return `You are a sponsor research agent for ${opts.podcastName}.

${opts.podcastContext}

Find ${opts.count} new potential sponsors in the ${opts.categoryLabel} category that would be a strong fit for this podcast. Use web search to verify brands are active and contacts are plausible.

For each sponsor find:
- Company name
- Best contact person (VP Marketing, Head of Partnerships, or Brand Partnerships)
- Their title
- Their email (research or make educated guess based on common company email formats — label uncertain guesses clearly in your reasoning but still provide best-effort email field)
- LinkedIn URL for the person or company page if individual URL unknown
- Why they're a fit (pitch angle specific to this podcast's audience)
- Tier (S/A/B based on brand size and audience fit)

Return ONLY a valid JSON array (no markdown, no prose) with objects using exactly these keys:
brand, category, tier, contactName, title, email, linkedinUrl, pitchAngle

Only include companies NOT already in our pipeline. Existing company names (lowercase match): ${existing}

If you cannot find ${opts.count} new companies, return as many as you can that pass the filter.`;
}

async function runDiscoveryPrompt(userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) throw new Error("ANTHROPIC_API_KEY is missing.");

  const client = new Anthropic({ apiKey });
  const tools = [
    { type: "web_search_20250305" as const, name: "web_search", max_uses: 5 },
  ];

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16384,
      messages: [{ role: "user", content: userPrompt }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
    });
    console.log("[discovery] stop_reason", message.stop_reason);
    return extractMessageText(message);
  } catch (e) {
    console.warn("[discovery] request with web_search failed, retrying without tools:", e);
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16384,
      messages: [{ role: "user", content: userPrompt }],
    });
    return extractMessageText(message);
  }
}

function filterAgainstPipeline(rows: DiscoveryRow[], sponsors: { company: string }[]): DiscoveryRow[] {
  const set = new Set(sponsors.map((s) => s.company.trim().toLowerCase()));
  return rows.filter((r) => !set.has(r.brand.trim().toLowerCase()));
}

export async function runManualDiscovery(input: {
  podcastMode: "ONE54" | "PRESSBOX" | "BOTH";
  category: string;
  count: 10 | 25 | 50;
}): Promise<{ ok: true; results: DiscoveryRow[] } | { ok: false; error: string }> {
  try {
    const sponsors = await getSponsors();
    const existingCompanies = sponsors.map((s) => s.company);

    const categoryLabel = input.category === "__ALL__" ? "all relevant industries" : input.category;

    const runs: Array<{ name: "One54" | "Pressbox Chronicles"; n: number }> = [];
    if (input.podcastMode === "ONE54") runs.push({ name: "One54", n: input.count });
    else if (input.podcastMode === "PRESSBOX") runs.push({ name: "Pressbox Chronicles", n: input.count });
    else {
      const half = Math.floor(input.count / 2);
      const rem = input.count - half;
      runs.push({ name: "One54", n: half });
      runs.push({ name: "Pressbox Chronicles", n: rem });
    }

    const merged: DiscoveryRow[] = [];
    for (const run of runs) {
      const prompt = buildPrompt({
        podcastName: run.name,
        podcastContext: podcastContext(run.name),
        count: run.n,
        categoryLabel,
        existingCompanies: [...existingCompanies, ...merged.map((m) => m.brand)],
      });
      const text = await runDiscoveryPrompt(prompt);
      const parsed = parseDiscoveryJson(text);
      const tagged = filterAgainstPipeline(parsed, sponsors).map((r) => ({
        ...r,
        podcast: run.name,
      }));
      merged.push(...tagged);
    }

    const dedup = new Map<string, DiscoveryRow>();
    for (const r of merged) {
      const k = r.brand.trim().toLowerCase();
      if (!dedup.has(k)) dedup.set(k, r);
    }

    return { ok: true, results: [...dedup.values()].slice(0, input.count) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Discovery failed." };
  }
}

export async function addDiscoveredSponsorsToPipeline(
  rows: DiscoveryRow[],
  podcastFallback: Podcast
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  if (!PODCASTS.includes(podcastFallback)) {
    return { ok: false, error: "Invalid podcast." };
  }
  const sponsors = await getSponsors();
  const existing = new Set(sponsors.map((s) => s.company.trim().toLowerCase()));
  let added = 0;

  for (const r of rows) {
    const key = r.brand.trim().toLowerCase();
    if (existing.has(key)) continue;
    const pod = r.podcast && PODCASTS.includes(r.podcast) ? r.podcast : podcastFallback;
    existing.add(key);
    sponsors.push({
      id: `sp-${randomUUID().slice(0, 8)}`,
      contactName: r.contactName || "Unknown",
      company: r.brand,
      email: r.email || "",
      linkedin_url: cleanLinkedIn(r.linkedinUrl),
      podcast: pod,
      stage: "New",
      lastContactDate: "",
      nextAction: "Initial outreach",
      notes: "Auto-discovery agent",
      pitch_angle: r.pitchAngle,
      category: r.category || undefined,
      tier: normalizeTier(r.tier),
      contact_title: r.title || undefined,
    });
    added += 1;
  }

  await saveSponsors(sponsors);
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true, added };
}

function isDue(lastIso: string | null, frequency: AppSettings["frequency"]): boolean {
  if (!lastIso) return true;
  const last = new Date(lastIso).getTime();
  if (Number.isNaN(last)) return true;
  const ms = frequency === "daily" ? 86400000 : 7 * 86400000;
  return Date.now() - last >= ms;
}

/** Called from client on app load — runs scheduled discovery if settings allow */
export async function runScheduledDiscoveryIfDue(): Promise<
  { ok: true; ran: boolean; message?: string } | { ok: false; error: string }
> {
  try {
    const settings = await readSettings();
    if (!settings.autoDiscovery) {
      return { ok: true, ran: false, message: "auto off" };
    }
    if (!isDue(settings.lastDiscoveryRunAt, settings.frequency)) {
      return { ok: true, ran: false, message: "not due" };
    }

    const count = settings.contactsPerRun;
    const per = settings.podcasts.length > 0 ? Math.max(1, Math.floor(count / settings.podcasts.length)) : count;

    for (const pod of settings.podcasts) {
      const sponsors = await getSponsors();
      const existingCompanies = sponsors.map((s) => s.company);
      const prompt = buildPrompt({
        podcastName: pod,
        podcastContext: podcastContext(pod),
        count: per,
        categoryLabel: "all relevant industries",
        existingCompanies,
      });
      const text = await runDiscoveryPrompt(prompt);
      const parsed = parseDiscoveryJson(text);
      const filtered = filterAgainstPipeline(parsed, sponsors);
      if (filtered.length > 0) {
        await addDiscoveredSponsorsToPipeline(filtered.slice(0, per), pod);
      }
    }

    const next: AppSettings = {
      ...settings,
      lastDiscoveryRunAt: new Date().toISOString(),
    };
    await writeSettings(next);
    revalidatePath("/partnerships");
    revalidatePath("/settings");
    console.log("[discovery] scheduled run completed");
    return { ok: true, ran: true };
  } catch (e) {
    console.error("[discovery] scheduled run error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Scheduled discovery failed." };
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await writeSettings(settings);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save settings." };
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  return readSettings();
}
