"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import type { Podcast, Stage } from "@/lib/types";
import { PODCASTS, STAGES } from "@/lib/types";

function isStage(s: string): s is Stage {
  return (STAGES as readonly string[]).includes(s);
}

function isPodcast(p: string): p is Podcast {
  return (PODCASTS as readonly string[]).includes(p);
}

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
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
    // Best-effort only
  }
}

export async function addSponsor(formData: FormData) {
  const contactName = String(formData.get("contactName") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  if (!contactName || !company) {
    return { ok: false as const, error: "Contact name and company are required." };
  }
  const podcastRaw = String(formData.get("podcast") ?? "").trim();
  const stageRaw = String(formData.get("stage") ?? "").trim();
  const companySocials = await enrichCompanySocials(company);
  const supabase = getServiceClient();
  const { error } = await supabase.from("sponsors").insert({
    contact_name: contactName,
    company,
    email: String(formData.get("email") ?? "").trim(),
    linkedin_url: String(formData.get("linkedin_url") ?? "").trim() || null,
    pitch_angle: String(formData.get("pitch_angle") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    tier: String(formData.get("tier") ?? "").trim() || null,
    contact_title: String(formData.get("contact_title") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    podcast: isPodcast(podcastRaw) ? podcastRaw : "One54",
    stage: isStage(stageRaw) ? stageRaw : "New",
    last_contact_date: "",
    next_action: "Initial outreach",
    company_linkedin: companySocials.company_linkedin || null,
    company_twitter: companySocials.company_twitter || null,
    company_instagram: companySocials.company_instagram || null,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

export async function updateSponsor(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "Missing id." };
  const supabase = getServiceClient();
  const updates: Record<string, unknown> = {};

  const fields: [string, string][] = [
    ["contact_name", "contactName"],
    ["company", "company"],
    ["email", "email"],
    ["linkedin_url", "linkedin_url"],
    ["pitch_angle", "pitch_angle"],
    ["category", "category"],
    ["tier", "tier"],
    ["contact_title", "contact_title"],
    ["notes", "notes"],
    ["next_action", "nextAction"],
    ["last_contact_date", "lastContactDate"],
    ["company_linkedin", "company_linkedin"],
    ["company_twitter", "company_twitter"],
    ["company_instagram", "company_instagram"],
  ];

  for (const [col, field] of fields) {
    const val = String(formData.get(field) ?? "").trim();
    if (val) updates[col] = val;
  }

  const stageRaw = String(formData.get("stage") ?? "").trim();
  if (isStage(stageRaw)) updates["stage"] = stageRaw;
  const podcastRaw = String(formData.get("podcast") ?? "").trim();
  if (isPodcast(podcastRaw)) updates["podcast"] = podcastRaw;
  const scheduledCall = String(formData.get("scheduled_call_date") ?? "").trim();
  if (scheduledCall) updates["scheduled_call_date"] = scheduledCall;

  const { error } = await supabase.from("sponsors").update(updates).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

export async function deleteSponsor(id: string) {
  const supabase = getServiceClient();
  const { error } = await supabase.from("sponsors").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
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
  const supabase = getServiceClient();
  const { data: existing } = await supabase
    .from("sponsors")
    .select("company, contact_name, email");

  const existingSet = new Set(
    (existing ?? []).map(
      (s) =>
        `${s.company?.trim().toLowerCase()}|${s.contact_name?.trim().toLowerCase()}|${s.email?.trim().toLowerCase()}`
    )
  );

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const company = row.company.trim();
    const contactName = row.contactName.trim();
    const email = row.email.trim();
    if (!company || !contactName) {
      skipped++;
      continue;
    }
    const key = `${company.toLowerCase()}|${contactName.toLowerCase()}|${email.toLowerCase()}`;
    if (existingSet.has(key)) {
      skipped++;
      continue;
    }
    existingSet.add(key);

    const rawPitch = row.pitch_angle.trim();
    const explicitLinkedIn = cleanUrl(row.linkedin_url ?? "");
    const fallbackLinkedIn =
      !explicitLinkedIn && looksLikeLinkedIn(rawPitch) ? cleanUrl(rawPitch) : undefined;
    const linkedin_url = explicitLinkedIn || fallbackLinkedIn;
    const pitch_angle = explicitLinkedIn
      ? rawPitch || null
      : fallbackLinkedIn
        ? null
        : rawPitch || null;

    const socials = await enrichCompanySocials(company);

    const { error } = await supabase.from("sponsors").insert({
      contact_name: contactName,
      company,
      email,
      linkedin_url: linkedin_url || null,
      pitch_angle,
      category: row.category.trim() || null,
      tier: row.tier.trim() || null,
      contact_title: row.contact_title.trim() || null,
      notes: row.notes.trim() || null,
      podcast:
        row.podcast && isPodcast(row.podcast as Podcast)
          ? (row.podcast as Podcast)
          : podcastOverride ?? "One54",
      stage: mapCsvStatusToStage(row.stage),
      last_contact_date: "",
      next_action: "",
      company_linkedin: socials.company_linkedin || null,
      company_twitter: socials.company_twitter || null,
      company_instagram: socials.company_instagram || null,
    });

    if (!error) imported++;
    else skipped++;
  }

  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const, imported, skipped };
}

export async function moveSponsorStage(id: string, stage: Stage) {
  if (!isStage(stage)) return { ok: false as const, error: "Invalid stage." };
  const supabase = getServiceClient();
  const { error } = await supabase.from("sponsors").update({ stage }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

export async function scheduleSponsorCall(id: string, scheduledAtIso: string) {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("sponsors")
    .update({ scheduled_call_date: scheduledAtIso })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/partnerships");
  revalidatePath("/command");
  return { ok: true as const };
}

export async function checkSponsorReplies() {
  const supabase = getServiceClient();
  const { data: sponsors } = await supabase.from("sponsors").select("id, email, gmail_thread_id");
  const rows = sponsors ?? [];
  const emails = rows
    .map((s) => s.email?.trim().toLowerCase())
    .filter((e) => e && e.length > 0);

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

    for (const hit of matches) {
      const sponsor = rows.find(
        (s) => s.email?.trim().toLowerCase() === hit.email.trim().toLowerCase()
      );
      if (!sponsor) continue;
      await supabase.from("sponsors").update({
        stage: "Contacted",
        last_reply_date: hit.last_reply_date || nowIso,
        gmail_thread_id: hit.gmail_thread_id || sponsor.gmail_thread_id,
      }).eq("id", sponsor.id);
      matched++;
    }

    if (matched > 0) {
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
  const supabase = getServiceClient();
  const now = Date.now();
  const { data } = await supabase
    .from("sponsors")
    .select("company, scheduled_call_date")
    .not("scheduled_call_date", "is", null);

  const fromSponsors: SponsorMeeting[] = (data ?? [])
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