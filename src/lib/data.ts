import { createServerClient } from "@supabase/ssr";
import type { Sponsor } from "./types";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function getSponsors(): Promise<Sponsor[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("sponsors")
    .select("*")
    .order("company", { ascending: true });
  if (error) {
    console.error("[data] getSponsors error", error);
    return [];
  }
  return (data ?? []).map(sponsorFromRow);
}

export async function saveSponsors(sponsors: Sponsor[]): Promise<void> {
  // saveSponsors is called with the full array — we upsert all
  const supabase = getServiceClient();
  const rows = sponsors.map(sponsorToRow);
  const { error } = await supabase
    .from("sponsors")
    .upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("[data] saveSponsors error", error);
    throw new Error(error.message);
  }
}

export async function getDashboard() {
  return {};
}

// Map Supabase snake_case row → Sponsor type
function sponsorFromRow(row: Record<string, unknown>): Sponsor {
  return {
    id: String(row.id ?? ""),
    contactName: String(row.contact_name ?? ""),
    company: String(row.company ?? ""),
    email: String(row.email ?? ""),
    podcast: String(row.podcast ?? "") as Sponsor["podcast"],
    stage: String(row.stage ?? "New") as Sponsor["stage"],
    lastContactDate: String(row.last_contact_date ?? ""),
    nextAction: String(row.next_action ?? ""),
    notes: String(row.notes ?? ""),
    pitch_angle: String(row.pitch_angle ?? ""),
    category: row.category ? String(row.category) : undefined,
    tier: row.tier ? String(row.tier) as Sponsor["tier"] : undefined,
    linkedin_url: row.linkedin_url ? String(row.linkedin_url) : undefined,
    contact_title: row.contact_title ? String(row.contact_title) : undefined,
    company_linkedin: row.company_linkedin ? String(row.company_linkedin) : undefined,
    company_twitter: row.company_twitter ? String(row.company_twitter) : undefined,
    company_instagram: row.company_instagram ? String(row.company_instagram) : undefined,
    socialHandle: row.social_handle ? String(row.social_handle) : undefined,
    youtubeUrl: row.youtube_url ? String(row.youtube_url) : undefined,
    scheduled_call_date: row.scheduled_call_date ? String(row.scheduled_call_date) : undefined,
  };
}

// Map Sponsor type → Supabase snake_case row
function sponsorToRow(s: Sponsor): Record<string, unknown> {
  return {
    id: s.id,
    contact_name: s.contactName,
    company: s.company,
    email: s.email,
    podcast: s.podcast,
    stage: s.stage,
    last_contact_date: s.lastContactDate ?? "",
    next_action: s.nextAction ?? "",
    notes: s.notes ?? "",
    pitch_angle: s.pitch_angle ?? "",
    category: s.category ?? null,
    tier: s.tier ?? null,
    linkedin_url: s.linkedin_url ?? null,
    contact_title: s.contact_title ?? null,
    company_linkedin: s.company_linkedin ?? null,
    company_twitter: s.company_twitter ?? null,
    company_instagram: s.company_instagram ?? null,
    social_handle: s.socialHandle ?? null,
    youtube_url: s.youtubeUrl ?? null,
    scheduled_call_date: s.scheduled_call_date ?? null,
  };
}