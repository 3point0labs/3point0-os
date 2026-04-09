"use server";

import { randomUUID } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { PODCASTS, STAGES } from "@/lib/types";
import type { Podcast, Sponsor, Stage } from "@/lib/types";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export async function getCommandCenterStats() {
  const supabase = createServiceClient();

  const [total, active, meetings, closed] = await Promise.all([
    supabase.from("sponsors").select("*", { count: "exact", head: true }),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).not("stage", "in", '("New","Closed")'),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("stage", "Negotiating"),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("stage", "Closed"),
  ]);

  return {
    total: total.count || 0,
    active: active.count || 0,
    meetings: meetings.count || 0,
    closed: closed.count || 0,
  };
}

export async function getPartnershipStats(scope: "all" | "One54" | "Pressbox Chronicles") {
  const supabase = createServiceClient();

  const base = () => supabase.from("sponsors").select("*", { count: "exact", head: true });
  const scoped = (q: ReturnType<typeof base>) =>
    scope !== "all" ? q.eq("podcast", scope) : q;

  const [total, active, meetings, closed] = await Promise.all([
    scoped(base()),
    scoped(base()).not("stage", "in", '("New","Closed")'),
    scoped(base()).eq("stage", "Negotiating"),
    scoped(base()).eq("stage", "Closed"),
  ]);

  return {
    total: total.count || 0,
    active: active.count || 0,
    meetings: meetings.count || 0,
    closed: closed.count || 0,
  };
}

function optionalStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function sponsorFromRow(row: Record<string, unknown>): Sponsor {
  const idRaw = String(row.id ?? "");
  const id = idRaw || `sp-${randomUUID().slice(0, 8)}`;
  const contactName = String(
    (row.contactName as string | undefined) ??
      (row.contact_name as string | undefined) ??
      ""
  );
  const company = String(row.company ?? "");
  const email = String(row.email ?? "");
  const podcastRaw = String(row.podcast ?? "One54");
  const podcast = (PODCASTS as readonly string[]).includes(podcastRaw)
    ? (podcastRaw as Podcast)
    : "One54";
  const stageRaw = String(row.stage ?? "New");
  const stage = (STAGES as readonly string[]).includes(stageRaw)
    ? (stageRaw as Stage)
    : "New";
  const lastContactDate = String(
    (row.lastContactDate as string | undefined) ??
      (row.last_contact_date as string | undefined) ??
      ""
  );
  const nextAction = String(
    (row.nextAction as string | undefined) ?? (row.next_action as string | undefined) ?? ""
  );
  const notes = String(row.notes ?? "");

  return {
    id,
    contactName,
    company,
    email,
    linkedin_url: optionalStr(row.linkedin_url),
    company_linkedin: optionalStr(row.company_linkedin),
    company_twitter: optionalStr(row.company_twitter),
    company_instagram: optionalStr(row.company_instagram),
    youtubeUrl: optionalStr(row.youtubeUrl ?? row.youtube_url),
    socialHandle: optionalStr(row.socialHandle ?? row.social_handle),
    pitch_angle: optionalStr(row.pitch_angle),
    category: optionalStr(row.category),
    tier: optionalStr(row.tier),
    contact_title: optionalStr(row.contact_title),
    podcast,
    stage,
    lastContactDate,
    nextAction,
    notes,
    scheduled_call_date: optionalStr(row.scheduled_call_date),
    gmail_thread_id: optionalStr(row.gmail_thread_id),
    last_reply_date: optionalStr(row.last_reply_date),
  };
}

export async function getPriorityTargets(): Promise<Sponsor[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("sponsors")
    .select("*")
    .not("stage", "in", '("Closed")')
    .order("tier", { ascending: true })
    .limit(10);

  if (!data) return [];

  const now = Date.now();
  const scored = data.map((s) => {
    const r = s as Record<string, unknown>;
    const tier = String(r.tier ?? "").toUpperCase();
    const lastIso = String(
      (r.lastContactDate as string | undefined) ??
        (r.last_contact_date as string | undefined) ??
        ""
    );
    const stageStr = String(r.stage ?? "");
    const daysSince = lastIso
      ? Math.floor((now - new Date(lastIso + "T00:00:00").getTime()) / 86400000)
      : 999;
    const p1 = tier === "S" && stageStr === "New" ? 1 : 0;
    const p2 = daysSince >= 7 ? 1 : 0;
    const p3 = tier === "A" && stageStr === "Contacted" ? 1 : 0;
    const bucket = p1 ? 1 : p2 ? 2 : p3 ? 3 : 99;
    return { r, bucket, daysSince };
  });

  scored.sort((a, b) =>
    a.bucket !== b.bucket ? a.bucket - b.bucket : b.daysSince - a.daysSince
  );

  return scored.slice(0, 5).map((x) => sponsorFromRow(x.r));
}
