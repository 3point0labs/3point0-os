import { createClient } from "@/lib/supabase/server";

type MarkResult = {
  ok: boolean;
  stage?: string;
  error?: string;
};

/**
 * Advances a sponsor's stage from "New" → "Contacted" and updates last_contact_date.
 * Never downgrades: if the sponsor is already past "New" (Contacted, Followed Up,
 * Negotiating, Closed), only the last_contact_date is updated.
 */
export async function markSponsorContacted(sponsorId: string): Promise<MarkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: sponsor, error: fetchErr } = await supabase
    .from("sponsors")
    .select("id, stage")
    .eq("id", sponsorId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }
  if (!sponsor) {
    return { ok: false, error: "Sponsor not found" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const nextStage = sponsor.stage === "New" ? "Contacted" : sponsor.stage;

  const { error: updateErr } = await supabase
    .from("sponsors")
    .update({
      stage: nextStage,
      last_contact_date: today,
    })
    .eq("id", sponsorId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  return { ok: true, stage: nextStage };
}