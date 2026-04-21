"use client";

import type { Sponsor } from "@/lib/types";

type Status = "verified" | "caution" | "failed" | "missing";

function badgeStatus(
  sponsor: Pick<Sponsor, "email" | "email_verified" | "email_source" | "email_validation_error">
): Status {
  const email = (sponsor.email ?? "").trim().toLowerCase();
  if (!email) return "missing";
  if (sponsor.email_validation_error) return "failed";
  if (sponsor.email_verified) return "verified";
  return "caution";
}

const LABELS: Record<Status, { label: string; title: string; classes: string }> = {
    verified: {
      label: "verified",
      title: "Email verified by RocketReach",
      classes: "border-[rgba(0,212,170,0.45)] bg-[rgba(0,212,170,0.12)] text-[#00d4aa]",
    },
    caution: {
      label: "unverified",
      title: "Email not verified — may be a guessed pattern. Verify before sending.",
      classes: "border-[rgba(250,204,21,0.45)] bg-[rgba(250,204,21,0.1)] text-[#facc15]",
    },
    failed: {
      label: "invalid",
      title: "Email failed validation or previously bounced",
      classes: "border-[rgba(232,83,61,0.5)] bg-[rgba(232,83,61,0.12)] text-[var(--color-accent-coral)]",
    },
    missing: {
      label: "no email",
      title: "No email address on file",
      classes: "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)]",
    },
  };