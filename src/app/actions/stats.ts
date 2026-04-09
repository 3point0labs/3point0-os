"use server";

import { createServerClient } from "@supabase/ssr";

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