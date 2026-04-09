"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getSponsors, saveSponsors } from "@/lib/data";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import type { Podcast, Sponsor, Stage } from "@/lib/types";
import { PODCASTS, STAGES } from "@/lib/types";

function isStage(s: string): s is Stage {
  return (STAGES as readonly string[]).includes(s);
}

function isPodcast(p: string): p is Podcast {
  return (PODCASTS as readonly string[]).includes(p);
}

const MODEL = "claude-sonnet-4-20250514";
const GMAIL_MCP_SERVER = process.env.GMAIL_MCP_SERVER_URL;

function cleanUrl(value: string) {
  const v = value.trim();
  if (!v) return undefined;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
}

async function enrichCompanySocials(company: string): Promise<{
  company_linkedin?: string;
  company_twitter?: string;
  company_instagram?: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) return {};
  const client = new Anthropic({ apiKey });

  const prompt = `Find official social URLs for this brand: ${company}.
Return strict JSON only with keys:
company_linkedin, company_twitter, company_instagram
Use full URLs. If unknown, use empty string.`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const data = JSON.parse(text) as {
      company_linkedin?: string;
      company_twitter?: string;
      company_instagram?: string;
    };
    return {
      company_linkedin: cleanUrl(data.company_linkedin ?? ""),
      company_twitter: cleanUrl(data.company_twitter ?? ""),
      company_instagram: cleanUrl(data.company_instagram ?? ""),
    };
  } catch {
    return {};
  }
}

type GmailReplyMatch = {
  email: string;
  last_reply_date?: string;
  gmail_thread_id?: string;
};

type SponsorMeeting = {
  company: string;
  startsAt: string;
  source: "calendar_mcp" | "sponsors";
};

function parseJsonBlock(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

async function markGmailConnectedForCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ gmail_connected: true }).eq("id", user.id);
  } catch {
    // Best-effort only, schema may not yet include gmail_connected.
  }
}

export async function addSponsor(formData: FormData) {
  const contactName = String(formData.get("contactName") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const linkedin_url =
    String(formData.get("linkedin_url") ?? "").trim() || undefined;
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim() || undefined;
  const socialHandle =
    String(formData.get("socialHandle") ?? "").trim() || undefined;
  const pitch_angle =
    String(formData.get("pitch_angle") ?? "").trim() || undefined;
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const tier = String(formData.get("tier") ?? "").trim() || undefined;
  const contact_title =
    String(formData.get("contact_title") ?? "").trim() || undefined;
  const podcastRaw = String(formData.get("podcast") ?? "").trim();
  const stageRaw = String(formData.get("stage") ?? "").trim();
  const lastContactDate = String(formData.get("lastContactDate") ?? "").trim();
  const nextAction = String(formData.get("nextAction") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!contactName || !company) {
    return { ok: false as const, error: "Contact name and company are required." };
  }

  const sponsors = await getSponsors();
  const podcast = isPodcast(podcastRaw) ? podcastRaw : "Pressbox Chronicles";
  const stage = isStage(stageRaw) ? stageRaw : "New";
  const companySocials = await enrichCompanySocials(company);
  const next: Sponsor = {
    id: `sp-${randomUUID().slice(0, 8)}`,
    contactName,
    company,
    email,
    linkedin_url,
    youtubeUrl,
    socialHandle,
    pitch_angle,
    category,
    tier,
    contact_title,
    company_linkedin: companySocials.company_linkedin,
    company_twitter: companySocials.company_twitter,
    company_instagram: companySocials.company_instagram,
    podcast,
    stage,
    lastContactDate,
    nextAction,
    notes,
    scheduled_call_date: undefined,
    gmail_thread_id: undefined,
    last_reply_date: undefined,
  };
  sponsors.push(next);
  await saveSponsors(sponsors);
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

export async function updateSponsor(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "Missing id." };

  const contactName = String(formData.get("contactName") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const linkedin_url = String(formData.get("linkedin_url") ?? "").trim();
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
  const socialHandle = String(formData.get("socialHandle") ?? "").trim();
  const company_linkedin = String(formData.get("company_linkedin") ?? "").trim();
  const company_twitter = String(formData.get("company_twitter") ?? "").trim();
  const company_instagram = String(formData.get("company_instagram") ?? "").trim();
  const pitch_angle = String(formData.get("pitch_angle") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const tier = String(formData.get("tier") ?? "").trim();
  const contact_title = String(formData.get("contact_title") ?? "").trim();
  const podcastRaw = String(formData.get("podcast") ?? "").trim();
  const stageRaw = String(formData.get("stage") ?? "").trim();
  const lastContactDate = String(formData.get("lastContactDate") ?? "").trim();
  const nextAction = String(formData.get("nextAction") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const sponsors = await getSponsors();
  const idx = sponsors.findIndex((s) => s.id === id);
  if (idx === -1) return { ok: false as const, error: "Sponsor not found." };
  const podcast = isPodcast(podcastRaw) ? podcastRaw : sponsors[idx].podcast;
  const stage = isStage(stageRaw) ? stageRaw : sponsors[idx].stage;

  sponsors[idx] = {
    ...sponsors[idx],
    contactName: contactName || sponsors[idx].contactName,
    company: company || sponsors[idx].company,
    email: email || sponsors[idx].email,
    linkedin_url: linkedin_url || sponsors[idx].linkedin_url,
    youtubeUrl: youtubeUrl || sponsors[idx].youtubeUrl,
    socialHandle: socialHandle || sponsors[idx].socialHandle,
    company_linkedin: company_linkedin || sponsors[idx].company_linkedin,
    company_twitter: company_twitter || sponsors[idx].company_twitter,
    company_instagram: company_instagram || sponsors[idx].company_instagram,
    pitch_angle: pitch_angle || sponsors[idx].pitch_angle,
    category: category || sponsors[idx].category,
    tier: tier || sponsors[idx].tier,
    contact_title: contact_title || sponsors[idx].contact_title,
    podcast,
    stage,
    lastContactDate: lastContactDate || sponsors[idx].lastContactDate,
    nextAction: nextAction || sponsors[idx].nextAction,
    notes: notes || sponsors[idx].notes,
    scheduled_call_date:
      String(formData.get("scheduled_call_date") ?? "").trim() || sponsors[idx].scheduled_call_date,
    gmail_thread_id: String(formData.get("gmail_thread_id") ?? "").trim() || sponsors[idx].gmail_thread_id,
    last_reply_date: String(formData.get("last_reply_date") ?? "").trim() || sponsors[idx].last_reply_date,
  };
  await saveSponsors(sponsors);
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

export async function deleteSponsor(id: string) {
  const sponsors = await getSponsors();
  const filtered = sponsors.filter((s) => s.id !== id);
  if (filtered.length === sponsors.length) {
    return { ok: false as const, error: "Not found." };
  }
  await saveSponsors(filtered);
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

type CsvImportInput = {
  company: string;
  contactName: string;
  email: string;
  linkedin_url?: string;
  podcast?: string;
  stage: string;
  notes: string;
  pitch_angle: string;
  category: string;
  tier: string;
  contact_title: string;
};

function mapCsvStatusToStage(status: string): Stage {
  const normalized = status.trim().toLowerCase();
  if (normalized === "not started") return "New";
  if (normalized === "in progress") return "Contacted";
  if (isStage(status)) return status;
  return "New";
}

function looksLikeLinkedIn(url: string) {
  return /^https?:\/\/(www\.)?linkedin\.com\/?/i.test(url) || /^linkedin\.com\/?/i.test(url);
}

export async function importSponsorsFromCsv(
  rows: CsvImportInput[],
  podcastOverride?: Podcast
) {
  const sponsors = await getSponsors();
  let imported = 0;
  let skipped = 0;
  const existing = new Set(
    sponsors.map((s) =>
      `${s.company.trim().toLowerCase()}|${s.contactName
        .trim()
        .toLowerCase()}|${s.email.trim().toLowerCase()}`
    )
  );

  for (const row of rows) {
    const company = row.company.trim();
    const contactName = row.contactName.trim();
    const email = row.email.trim();
    if (!company || !contactName) {
      skipped += 1;
      continue;
    }
    const dedupeKey = `${company.toLowerCase()}|${contactName.toLowerCase()}|${email.toLowerCase()}`;
    if (existing.has(dedupeKey)) {
      skipped += 1;
      continue;
    }

    const rawPitch = row.pitch_angle.trim();
    const explicitLinkedIn = cleanUrl(row.linkedin_url ?? "");
    const rawStatus = row.stage.trim();
    const statusAsStage = mapCsvStatusToStage(rawStatus);
    const fallbackLinkedIn =
      !explicitLinkedIn && looksLikeLinkedIn(rawPitch) ? cleanUrl(rawPitch) : undefined;
    const linkedin_url = explicitLinkedIn || fallbackLinkedIn;
    const pitch_angle = explicitLinkedIn
      ? rawPitch || undefined
      : fallbackLinkedIn
        ? undefined
        : rawPitch || undefined;
    const socials = await enrichCompanySocials(company);

    const next: Sponsor = {
      id: `sp-${randomUUID().slice(0, 8)}`,
      contactName,
      company,
      email,
      podcast:
        (row.podcast && isPodcast(row.podcast as Podcast)
          ? (row.podcast as Podcast)
          : undefined) ||
        (podcastOverride && isPodcast(podcastOverride) ? podcastOverride : "One54"),
      stage: statusAsStage,
      lastContactDate: "",
      nextAction: "",
      notes: row.notes.trim(),
      linkedin_url,
      pitch_angle,
      category: row.category.trim() || undefined,
      tier: row.tier.trim() || undefined,
      contact_title: row.contact_title.trim() || undefined,
      company_linkedin: socials.company_linkedin,
      company_twitter: socials.company_twitter,
      company_instagram: socials.company_instagram,
      scheduled_call_date: undefined,
      gmail_thread_id: undefined,
      last_reply_date: undefined,
    };
    sponsors.push(next);
    existing.add(dedupeKey);
    imported += 1;
  }

  await saveSponsors(sponsors);
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const, imported, skipped };
}

export async function moveSponsorStage(id: string, stage: Stage) {
  if (!isStage(stage)) return { ok: false as const, error: "Invalid stage." };
  const sponsors = await getSponsors();
  const idx = sponsors.findIndex((s) => s.id === id);
  if (idx === -1) return { ok: false as const, error: "Sponsor not found." };
  sponsors[idx] = { ...sponsors[idx], stage };
  await saveSponsors(sponsors);
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

export async function scheduleSponsorCall(id: string, scheduledAtIso: string) {
  const sponsors = await getSponsors();
  const idx = sponsors.findIndex((s) => s.id === id);
  if (idx === -1) return { ok: false as const, error: "Sponsor not found." };
  sponsors[idx] = { ...sponsors[idx], scheduled_call_date: scheduledAtIso };
  await saveSponsors(sponsors);
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

export async function checkSponsorReplies() {
  const sponsors = await getSponsors();
  const emails = sponsors
    .map((s) => s.email.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (!emails.length) {
    return { ok: true as const, checked: 0, matched: 0 };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    return { ok: false as const, error: "ANTHROPIC_API_KEY is missing." };
  }

  try {
    const client = new Anthropic({ apiKey });
    const prompt = [
      "You are connected to Gmail MCP tools.",
      "Use gmail_search_messages to find sponsor replies from these sender emails:",
      emails.join(", "),
      'Return strict JSON only: {"matches":[{"email":"", "last_reply_date":"ISO-8601", "gmail_thread_id":""}]}',
      "Only include matches where a reply exists.",
    ].join("\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      stream: false,
      messages: [{ role: "user", content: prompt }],
      // Passed through for MCP-enabled Anthropic runtime integrations.
      ...(GMAIL_MCP_SERVER
        ? ({
            mcp_servers: [{ type: "url", url: GMAIL_MCP_SERVER, name: "gmail" }],
          } as Record<string, unknown>)
        : {}),
    } as Anthropic.Messages.MessageCreateParams);

    const blocks = "content" in response ? response.content : [];
    const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    const parsed = parseJsonBlock(text) as { matches?: GmailReplyMatch[] };
    const matches = parsed.matches ?? [];

    if (!matches.length) {
      return { ok: true as const, checked: emails.length, matched: 0 };
    }

    const nowIso = new Date().toISOString();
    let matched = 0;
    const updated = sponsors.map((s) => {
      const hit = matches.find((m) => m.email.trim().toLowerCase() === s.email.trim().toLowerCase());
      if (!hit) return s;
      matched += 1;
      return {
        ...s,
        stage: "Contacted" as Stage,
        last_reply_date: hit.last_reply_date || nowIso,
        gmail_thread_id: hit.gmail_thread_id || s.gmail_thread_id,
      };
    });

    if (matched > 0) {
      await saveSponsors(updated);
      await markGmailConnectedForCurrentUser();
      revalidatePath("/partnerships");
      revalidatePath("/command");
    }

    return { ok: true as const, checked: emails.length, matched };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check Gmail replies.";
    return { ok: false as const, error: message };
  }
}

export async function getUpcomingSponsorMeetings() {
  const sponsors = await getSponsors();
  const now = Date.now();
  const fromSponsors: SponsorMeeting[] = sponsors
    .filter((s) => s.scheduled_call_date)
    .map((s) => ({
      company: s.company,
      startsAt: String(s.scheduled_call_date),
      source: "sponsors" as const,
    }))
    .filter((m) => {
      const t = Date.parse(m.startsAt);
      return Number.isFinite(t) && t >= now;
    });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const calendarMcp = process.env.GCAL_MCP_SERVER_URL;
  if (!apiKey?.trim() || !calendarMcp?.trim()) {
    return fromSponsors.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 8);
  }

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      stream: false,
      messages: [
        {
          role: "user",
          content:
            'Use Google Calendar MCP to list upcoming events with "Sponsor call" in the title. Return strict JSON: {"events":[{"company":"", "startsAt":"ISO-8601"}]}',
        },
      ],
      ...(calendarMcp
        ? ({
            mcp_servers: [{ type: "url", url: calendarMcp, name: "google_calendar" }],
          } as Record<string, unknown>)
        : {}),
    } as Anthropic.Messages.MessageCreateParams);

    const blocks = "content" in res ? res.content : [];
    const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    const parsed = parseJsonBlock(text) as { events?: { company: string; startsAt: string }[] };
    const fromMcp: SponsorMeeting[] = (parsed.events ?? []).map((e) => ({
      company: e.company,
      startsAt: e.startsAt,
      source: "calendar_mcp",
    }));
    return [...fromMcp, ...fromSponsors]
      .filter((m) => Number.isFinite(Date.parse(m.startsAt)))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .slice(0, 8);
  } catch {
    return fromSponsors.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 8);
  }
}
