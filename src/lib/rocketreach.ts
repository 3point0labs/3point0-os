// ============================================================================
// RocketReach API client
// ----------------------------------------------------------------------------
// Thin wrapper over RocketReach v2. Designed to fail gracefully — if the API
// returns unexpected shapes or errors, we log + return null instead of throwing.
// That way the outreach flow never crashes on bad enrichment data.
// ============================================================================

import { createServerClient } from "@supabase/ssr";

const API_BASE = "https://api.rocketreach.co/v2/api";
const DEFAULT_TIMEOUT_MS = 15000;

// ============================================================================
// Types — based on RocketReach v2 documented responses, kept permissive because
// their API occasionally adds fields or returns different shapes by plan tier.
// ============================================================================

export type RocketReachAccount = {
  id?: number;
  email?: string;
  plan?: {
    name?: string;
  };
  lookup_credit_balance?: number;
  daily_lookups_remaining?: number;
  api_key?: string;
};

export type RocketReachPerson = {
  id?: number;
  name?: string;
  current_title?: string;
  current_employer?: string;
  linkedin_url?: string;
  emails?: Array<{
    email: string;
    type?: string;
    smtp_valid?: string;        // "valid" | "invalid" | "unknown" | "catch_all"
    last_validation_check?: string;
  }>;
  recommended_email?: string;
  recommended_personal_email?: string;
  recommended_professional_email?: string;
  status?: string;               // "complete" | "searching" | "failed"
};

export type RocketReachSearchResult = {
  profiles?: RocketReachPerson[];
  pagination?: {
    total?: number;
    start?: number;
    next?: number;
  };
};

// ============================================================================
// Credit tracking — writes to Supabase so we have a running log + balance cache
// ============================================================================

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function logUsage(params: {
  action: "person_search" | "email_reveal" | "verify" | "account_check";
  creditsUsed: number;
  sponsorId?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from("rocketreach_usage").insert({
      action: params.action,
      credits_used: params.creditsUsed,
      sponsor_id: params.sponsorId ?? null,
      success: params.success,
      error_message: params.errorMessage ?? null,
    });
  } catch {
    // Best effort — don't block enrichment on logging failure
  }
}

async function updateBalanceCache(remaining: number | undefined, planName?: string): Promise<void> {
  if (typeof remaining !== "number") return;
  try {
    const supabase = getServiceClient();
    await supabase
      .from("rocketreach_balance")
      .update({
        credits_remaining: remaining,
        plan_name: planName ?? "pro",
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", 1);
  } catch {
    // Best effort
  }
}

// ============================================================================
// Low-level fetch wrapper
// ============================================================================

function getApiKey(): string | null {
  const k = process.env.ROCKETREACH_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

async function rrFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "ROCKETREACH_API_KEY is not configured." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: `RocketReach ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.name === "AbortError"
          ? "RocketReach request timed out (15s)"
          : err.message
        : "Unknown RocketReach error";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check account status + remaining credits.
 * Cheap call — RocketReach does NOT charge a credit for account info.
 * Writes result to rocketreach_balance cache.
 */
export async function checkAccount(): Promise
  | { ok: true; account: RocketReachAccount; creditsRemaining: number | null }
  | { ok: false; error: string }
> {
  const result = await rrFetch<RocketReachAccount>("/account");

  if (!result.ok) {
    await logUsage({
      action: "account_check",
      creditsUsed: 0,
      success: false,
      errorMessage: result.error,
    });
    return { ok: false, error: result.error };
  }

  const remaining =
    typeof result.data.lookup_credit_balance === "number"
      ? result.data.lookup_credit_balance
      : null;

  await updateBalanceCache(remaining ?? undefined, result.data.plan?.name);
  await logUsage({
    action: "account_check",
    creditsUsed: 0,
    success: true,
  });

  return {
    ok: true,
    account: result.data,
    creditsRemaining: remaining,
  };
}

/**
 * Search for a person by name + company. Returns the top-matching profile.
 * Costs 1 credit on most plans if a match is returned.
 *
 * RocketReach allows filtering by title keywords to improve hit quality.
 * We pass target title keywords so the search prefers partnerships/marketing
 * roles over random employees.
 */
export async function searchPerson(params: {
  name?: string;
  company: string;
  titleKeywords?: string[];
  sponsorId?: string;
}): Promise
  | { ok: true; person: RocketReachPerson | null }
  | { ok: false; error: string }
> {
  const body: Record<string, unknown> = {
    query: {
      current_employer: [params.company],
    },
    start: 1,
    page_size: 5,
  };

  if (params.name) {
    (body.query as Record<string, unknown>).name = [params.name];
  }

  if (params.titleKeywords && params.titleKeywords.length > 0) {
    (body.query as Record<string, unknown>).current_title =
      params.titleKeywords;
  }

  const result = await rrFetch<RocketReachSearchResult>("/search", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    await logUsage({
      action: "person_search",
      creditsUsed: 0,
      sponsorId: params.sponsorId,
      success: false,
      errorMessage: result.error,
    });
    return { ok: false, error: result.error };
  }

  const profiles = result.data.profiles ?? [];
  const creditsUsed = profiles.length > 0 ? 1 : 0;

  await logUsage({
    action: "person_search",
    creditsUsed,
    sponsorId: params.sponsorId,
    success: true,
  });

  // Refresh credit balance after any paid call
  if (creditsUsed > 0) {
    void checkAccount();
  }

  return { ok: true, person: profiles[0] ?? null };
}

/**
 * Look up a specific person's full profile (including emails) by their
 * RocketReach ID. Costs 1 credit.
 *
 * Use this AFTER searchPerson has returned a profile — you pass the person.id
 * to this function to unlock their verified emails.
 */
export async function lookupPersonEmails(params: {
  rocketreachId: number;
  sponsorId?: string;
}): Promise
  | { ok: true; person: RocketReachPerson }
  | { ok: false; error: string }
> {
  const result = await rrFetch<RocketReachPerson>(
    `/lookupProfile?id=${params.rocketreachId}`
  );

  if (!result.ok) {
    await logUsage({
      action: "email_reveal",
      creditsUsed: 0,
      sponsorId: params.sponsorId,
      success: false,
      errorMessage: result.error,
    });
    return { ok: false, error: result.error };
  }

  await logUsage({
    action: "email_reveal",
    creditsUsed: 1,
    sponsorId: params.sponsorId,
    success: true,
  });

  // Refresh credit balance
  void checkAccount();

  return { ok: true, person: result.data };
}

/**
 * Pick the best email from a RocketReach profile.
 * Prioritizes professional emails marked "valid", then personal valid emails,
 * then the recommended_email as a last resort.
 */
export function pickBestEmail(person: RocketReachPerson): {
  email: string | null;
  verified: boolean;
  note: string;
} {
  const emails = person.emails ?? [];

  // First pass: professional + valid
  const professionalValid = emails.find(
    (e) =>
      (e.type === "professional" || !e.type) && e.smtp_valid === "valid"
  );
  if (professionalValid) {
    return {
      email: professionalValid.email,
      verified: true,
      note: "Professional email, SMTP validated",
    };
  }

  // Second pass: any valid
  const anyValid = emails.find((e) => e.smtp_valid === "valid");
  if (anyValid) {
    return {
      email: anyValid.email,
      verified: true,
      note: `Valid email (${anyValid.type ?? "unknown type"})`,
    };
  }

  // Third pass: catch-all domain (likely to deliver but can't confirm)
  const catchAll = emails.find((e) => e.smtp_valid === "catch_all");
  if (catchAll) {
    return {
      email: catchAll.email,
      verified: false,
      note: "Catch-all domain — may deliver but not verified",
    };
  }

  // Fallback: use recommended_email if no validated options
  if (person.recommended_professional_email) {
    return {
      email: person.recommended_professional_email,
      verified: false,
      note: "Recommended email, not SMTP-validated",
    };
  }

  if (person.recommended_email) {
    return {
      email: person.recommended_email,
      verified: false,
      note: "Recommended email, not SMTP-validated",
    };
  }

  return { email: null, verified: false, note: "No email found in profile" };
}

// ============================================================================
// Title quality classifier
// ----------------------------------------------------------------------------
// Given a contact title, classify it into tiers so we can prioritize sending.
// Used by the enrichment agent and surfaced as a badge in the UI.
// ============================================================================

export type TitleTier = "ideal" | "acceptable" | "fallback" | "avoid" | "unknown";

const TITLE_PATTERNS: Array<{ tier: TitleTier; patterns: RegExp[] }> = [
  {
    tier: "ideal",
    patterns: [
      /\b(partnerships?|sponsorships?|business development|bd)\b/i,
      /\bhead of partnerships?\b/i,
      /\bvp partnerships?\b/i,
      /\bdirector.*partnerships?\b/i,
    ],
  },
  {
    tier: "acceptable",
    patterns: [
      /\b(vp|vice president).*(marketing|brand)\b/i,
      /\bdirector.*(marketing|brand)\b/i,
      /\bhead of marketing\b/i,
      /\bchief marketing officer\b/i,
      /\bcmo\b/i,
    ],
  },
  {
    tier: "fallback",
    patterns: [
      /\b(brand|marketing) manager\b/i,
      /\bsenior.*(brand|marketing)\b/i,
      /\bmarketing lead\b/i,
      /\bcommunications? (director|lead|manager)\b/i,
    ],
  },
  {
    tier: "avoid",
    patterns: [
      /\b(ceo|chief executive officer)\b/i,
      /\b(founder|co-founder|cofounder)\b/i,
      /\b(owner|proprietor)\b/i,
      /\bpresident\b/i,
    ],
  },
];

export function classifyTitle(title: string | null | undefined): TitleTier {
  if (!title || !title.trim()) return "unknown";
  const t = title.trim();
  for (const { tier, patterns } of TITLE_PATTERNS) {
    if (patterns.some((p) => p.test(t))) return tier;
  }
  return "unknown";
}

// ============================================================================
// Target title keywords for RocketReach search
// Passed as filters to reduce credit spend on bad matches
// ============================================================================

export const TARGET_TITLE_KEYWORDS = [
  "head of partnerships",
  "partnerships",
  "sponsorships",
  "business development",
  "vp marketing",
  "director of marketing",
  "brand director",
  "cmo",
];