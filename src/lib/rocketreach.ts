// ============================================================================
// RocketReach API client
// ----------------------------------------------------------------------------
// Thin wrapper over RocketReach v2. Designed to fail gracefully — if the API
// returns unexpected shapes or errors, we log + return null instead of throwing.
// ============================================================================

import { createServerClient } from "@supabase/ssr";

const API_BASE = "https://api.rocketreach.co/v2/api";
const DEFAULT_TIMEOUT_MS = 15000;

// ============================================================================
// Types — permissive because RocketReach response shape varies by plan tier
// ============================================================================

export type RocketReachCreditUsage = {
  credit_type: string;
  allocated: number | string;
  used: number;
  remaining: number | string;
};

export type RocketReachRateLimit = {
  action: string;
  duration: string;
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type RocketReachAccount = {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  state?: string;
  plan?: { name?: string };
  credit_usage?: RocketReachCreditUsage[];
  rate_limits?: RocketReachRateLimit[];
  lookup_credit_balance?: number;
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
    smtp_valid?: string;
    last_validation_check?: string;
  }>;
  recommended_email?: string;
  recommended_personal_email?: string;
  recommended_professional_email?: string;
  status?: string;
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
// Return type aliases (extracted for Turbopack compatibility)
// ============================================================================

export type CheckAccountResult =
  | {
      ok: true;
      account: RocketReachAccount;
      personSearchRemaining: number | null;
      personLookupRemaining: number | null;
      planTier: string;
    }
  | { ok: false; error: string };

export type SearchPersonResult =
  | { ok: true; person: RocketReachPerson | null }
  | { ok: false; error: string };

export type LookupPersonResult =
  | { ok: true; person: RocketReachPerson }
  | { ok: false; error: string };

type RrFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

// ============================================================================
// Parse credit/rate limit arrays into the number we actually care about
// ============================================================================

function findMonthlyRateLimit(
  rateLimits: RocketReachRateLimit[] | undefined,
  action: string
): number | null {
  if (!rateLimits) return null;
  const entry = rateLimits.find(
    (r) => r.action === action && r.duration === "one_month"
  );
  if (!entry) return null;
  return typeof entry.remaining === "number" ? entry.remaining : null;
}

function derivePlanTier(account: RocketReachAccount): string {
  // RocketReach doesn't always return a plan.name — infer from search monthly limit
  const searchLimit = account.rate_limits?.find(
    (r) => r.action === "person_search" && r.duration === "one_month"
  )?.limit;
  if (typeof searchLimit === "number") {
    if (searchLimit >= 15000) return "enterprise";
    if (searchLimit >= 2500) return "ultimate";
    if (searchLimit >= 800) return "plus";
    if (searchLimit >= 300) return "pro";
    return "trial";
  }
  return account.plan?.name ?? "unknown";
}

// ============================================================================
// Supabase client + logging
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
    // Best effort
  }
}

async function updateBalanceCache(
  personLookupRemaining: number | null,
  planName: string
): Promise<void> {
  if (personLookupRemaining === null) return;
  try {
    const supabase = getServiceClient();
    await supabase
      .from("rocketreach_balance")
      .update({
        credits_remaining: personLookupRemaining,
        plan_name: planName,
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
): Promise<RrFetchResult<T>> {
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

export async function checkAccount(): Promise<CheckAccountResult> {
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

  const personSearchRemaining = findMonthlyRateLimit(
    result.data.rate_limits,
    "person_search"
  );
  const personLookupRemaining = findMonthlyRateLimit(
    result.data.rate_limits,
    "person_lookup"
  );
  const planTier = derivePlanTier(result.data);

  await updateBalanceCache(personLookupRemaining, planTier);
  await logUsage({
    action: "account_check",
    creditsUsed: 0,
    success: true,
  });

  return {
    ok: true,
    account: result.data,
    personSearchRemaining,
    personLookupRemaining,
    planTier,
  };
}

export async function searchPerson(params: {
  name?: string;
  company: string;
  titleKeywords?: string[];
  sponsorId?: string;
}): Promise<SearchPersonResult> {
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
    (body.query as Record<string, unknown>).current_title = params.titleKeywords;
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

  if (creditsUsed > 0) {
    void checkAccount();
  }

  return { ok: true, person: profiles[0] ?? null };
}

export async function lookupPersonEmails(params: {
  rocketreachId: number;
  sponsorId?: string;
}): Promise<LookupPersonResult> {
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

  void checkAccount();

  return { ok: true, person: result.data };
}

export function pickBestEmail(person: RocketReachPerson): {
  email: string | null;
  verified: boolean;
  note: string;
} {
  const emails = person.emails ?? [];

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

  const anyValid = emails.find((e) => e.smtp_valid === "valid");
  if (anyValid) {
    return {
      email: anyValid.email,
      verified: true,
      note: `Valid email (${anyValid.type ?? "unknown type"})`,
    };
  }

  const catchAll = emails.find((e) => e.smtp_valid === "catch_all");
  if (catchAll) {
    return {
      email: catchAll.email,
      verified: false,
      note: "Catch-all domain — may deliver but not verified",
    };
  }

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
// ============================================================================

export type TitleTier =
  | "ideal"
  | "acceptable"
  | "fallback"
  | "avoid"
  | "unknown";

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

export function classifyTitle(
  title: string | null | undefined
): TitleTier {
  if (!title || !title.trim()) return "unknown";
  const t = title.trim();
  for (const { tier, patterns } of TITLE_PATTERNS) {
    if (patterns.some((p) => p.test(t))) return tier;
  }
  return "unknown";
}

// ============================================================================
// Target title keywords for RocketReach search
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