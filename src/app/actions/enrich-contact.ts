"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import {
  checkAccount,
  classifyTitle,
  lookupPersonEmails,
  pickBestEmail,
  searchPerson,
  TARGET_TITLE_KEYWORDS,
  type TitleTier,
} from "@/lib/rocketreach";

// ============================================================================
// Types
// ============================================================================

export type CreditsResult =
  | {
      ok: true;
      creditsRemaining: number | null;
      creditsTotal: number;
      planName: string;
      lastChecked: string;
    }
  | { ok: false; error: string };

export type EnrichResult =
  | {
      ok: true;
      email: string | null;
      emailVerified: boolean;
      emailNote: string;
      contactName: string;
      contactTitle: string;
      linkedinUrl: string;
      titleTier: TitleTier;
      creditsUsed: number;
    }
  | { ok: false; error: string; creditsUsed: number };

export type BulkEnrichOk = {
  ok: true;
  enriched: number;
  skipped: number;
  failed: number;
  creditsUsedTotal: number;
  creditsRemainingAfter: number | null;
  stoppedEarly: boolean;
  reason?: string;
};

export type BulkEnrichResult = BulkEnrichOk | { ok: false; error: string };

// ============================================================================
// Helpers
// ============================================================================

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// ============================================================================
// Get RocketReach credit balance
// ============================================================================

export async function getRocketReachCredits(): Promise<CreditsResult> {
  const supabase = getServiceClient();
  const { data: cached } = await supabase
    .from("rocketreach_balance")
    .select("credits_remaining, credits_total, plan_name, last_checked_at")
    .eq("id", 1)
    .maybeSingle();

  const staleThreshold = 60 * 60 * 1000; // 1 hour
  const lastChecked = cached?.last_checked_at
    ? new Date(cached.last_checked_at).getTime()
    : 0;
  const isStale = Date.now() - lastChecked > staleThreshold;

  if (isStale || cached?.credits_remaining === null) {
    const fresh = await checkAccount();
    if (fresh.ok) {
      return {
        ok: true,
        creditsRemaining: fresh.creditsRemaining,
        creditsTotal: cached?.credits_total ?? 300,
        planName: cached?.plan_name ?? "pro",
        lastChecked: new Date().toISOString(),
      };
    }
  }

  return {
    ok: true,
    creditsRemaining: cached?.credits_remaining ?? null,
    creditsTotal: cached?.credits_total ?? 300,
    planName: cached?.plan_name ?? "pro",
    lastChecked: cached?.last_checked_at ?? new Date().toISOString(),
  };
}

// ============================================================================
// Enrich a single sponsor
// ============================================================================

export async function enrichSponsor(sponsorId: string): Promise<EnrichResult> {
  const supabase = getServiceClient();

  const { data: sponsor, error: fetchErr } = await supabase
    .from("sponsors")
    .select("id, company, contact_name, contact_title, email, rocketreach_id")
    .eq("id", sponsorId)
    .maybeSingle();

  if (fetchErr || !sponsor) {
    return { ok: false, error: "Sponsor not found", creditsUsed: 0 };
  }

  if (!sponsor.company) {
    return { ok: false, error: "Sponsor has no company name", creditsUsed: 0 };
  }

  let creditsUsed = 0;
  let rocketreachId: number | undefined;
  let personFromSearch: {
    id?: number;
    name?: string;
    current_title?: string;
    linkedin_url?: string;
  } | null = null;

  if (sponsor.rocketreach_id) {
    rocketreachId = parseInt(sponsor.rocketreach_id, 10);
  } else {
    const search = await searchPerson({
      company: sponsor.company,
      name: sponsor.contact_name || undefined,
      titleKeywords: TARGET_TITLE_KEYWORDS,
      sponsorId: sponsor.id,
    });

    if (!search.ok) {
      return { ok: false, error: `Search failed: ${search.error}`, creditsUsed };
    }

    if (!search.person || !search.person.id) {
      const broadSearch = await searchPerson({
        company: sponsor.company,
        name: sponsor.contact_name || undefined,
        sponsorId: sponsor.id,
      });

      if (!broadSearch.ok || !broadSearch.person || !broadSearch.person.id) {
        await supabase
          .from("sponsors")
          .update({
            rocketreach_looked_up_at: new Date().toISOString(),
            email_source: "not_found",
          })
          .eq("id", sponsor.id);
        return {
          ok: false,
          error: "No match found on RocketReach",
          creditsUsed: 1,
        };
      }

      personFromSearch = broadSearch.person;
      rocketreachId = broadSearch.person.id;
      creditsUsed += 1;
    } else {
      personFromSearch = search.person;
      rocketreachId = search.person.id;
      creditsUsed += 1;
    }
  }

  if (!rocketreachId) {
    return { ok: false, error: "No RocketReach ID to lookup", creditsUsed };
  }

  const lookup = await lookupPersonEmails({
    rocketreachId,
    sponsorId: sponsor.id,
  });

  if (!lookup.ok) {
    return {
      ok: false,
      error: `Email lookup failed: ${lookup.error}`,
      creditsUsed,
    };
  }

  creditsUsed += 1;

  const person = lookup.person;
  const emailPick = pickBestEmail(person);
  const title =
    person.current_title ?? personFromSearch?.current_title ?? "";
  const name =
    person.name ?? personFromSearch?.name ?? sponsor.contact_name ?? "";
  const linkedin =
    person.linkedin_url ?? personFromSearch?.linkedin_url ?? "";
  const titleTier = classifyTitle(title);

  const updates: Record<string, unknown> = {
    rocketreach_id: String(rocketreachId),
    rocketreach_looked_up_at: new Date().toISOString(),
    title_tier: titleTier,
  };

  if (emailPick.email) {
    updates.email = emailPick.email;
    updates.email_verified = emailPick.verified;
    updates.email_verified_at = new Date().toISOString();
    updates.email_source = "rocketreach";
    updates.email_validation_error = emailPick.verified
      ? null
      : emailPick.note;
  } else {
    updates.email_source = "not_found";
    updates.email_validation_error = emailPick.note;
  }

  if (name && name !== sponsor.contact_name) updates.contact_name = name;
  if (title) updates.contact_title = title;
  if (linkedin) updates.linkedin_url = linkedin;

  const { error: updateErr } = await supabase
    .from("sponsors")
    .update(updates)
    .eq("id", sponsor.id);

  if (updateErr) {
    return {
      ok: false,
      error: `DB update failed: ${updateErr.message}`,
      creditsUsed,
    };
  }

  revalidatePath("/partnerships");
  revalidatePath("/command");

  return {
    ok: true,
    email: emailPick.email,
    emailVerified: emailPick.verified,
    emailNote: emailPick.note,
    contactName: name,
    contactTitle: title,
    linkedinUrl: linkedin,
    titleTier,
    creditsUsed,
  };
}

// ============================================================================
// Bulk enrich Tier S + A
// ============================================================================

export async function bulkEnrichPrioritySponsors(params: {
  tiers: string[];
  minCreditsRemaining: number;
}): Promise<BulkEnrichResult> {
  const supabase = getServiceClient();

  const credits = await getRocketReachCredits();
  if (!credits.ok) {
    return { ok: false, error: "Failed to check credits" };
  }

  if (
    credits.creditsRemaining !== null &&
    credits.creditsRemaining < params.minCreditsRemaining
  ) {
    return {
      ok: true,
      enriched: 0,
      skipped: 0,
      failed: 0,
      creditsUsedTotal: 0,
      creditsRemainingAfter: credits.creditsRemaining,
      stoppedEarly: true,
      reason: `Only ${credits.creditsRemaining} credits left, below safety threshold of ${params.minCreditsRemaining}`,
    };
  }

  const { data: sponsors, error } = await supabase
    .from("sponsors")
    .select("id, tier, email_source")
    .in("tier", params.tiers)
    .or("email_source.eq.unknown,email_source.is.null");

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!sponsors || sponsors.length === 0) {
    return {
      ok: true,
      enriched: 0,
      skipped: 0,
      failed: 0,
      creditsUsedTotal: 0,
      creditsRemainingAfter: credits.creditsRemaining,
      stoppedEarly: false,
      reason: "No unenriched priority sponsors to process",
    };
  }

  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  let creditsUsedTotal = 0;
  let stoppedEarly = false;
  let reason: string | undefined;

  for (const sponsor of sponsors) {
    const creditsNow = await getRocketReachCredits();
    if (
      creditsNow.ok &&
      creditsNow.creditsRemaining !== null &&
      creditsNow.creditsRemaining < params.minCreditsRemaining
    ) {
      stoppedEarly = true;
      reason = `Hit safety threshold during run: ${creditsNow.creditsRemaining} credits remaining`;
      break;
    }

    const result = await enrichSponsor(sponsor.id);
    creditsUsedTotal += result.creditsUsed;

    if (result.ok) {
      enriched += 1;
    } else if (result.error.includes("No match")) {
      skipped += 1;
    } else {
      failed += 1;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  const finalCredits = await getRocketReachCredits();

  return {
    ok: true,
    enriched,
    skipped,
    failed,
    creditsUsedTotal,
    creditsRemainingAfter: finalCredits.ok ? finalCredits.creditsRemaining : null,
    stoppedEarly,
    reason,
  };
}