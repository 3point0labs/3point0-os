"use server";

import { createClient } from "@/lib/supabase/server";

export async function getCommandCenterStats() {
  const supabase = await createClient();

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
