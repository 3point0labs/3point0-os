"use client";

import { useEffect, useMemo, useState } from "react";
import { getPartnershipStats } from "@/app/actions/stats";
import type { PipelineSuggestion } from "@/lib/suggestions";
import type { Sponsor } from "@/lib/types";
import { PartnershipsSuggestions } from "./PartnershipsSuggestions";
import { PartnershipsScopeFilter, SponsorsClient } from "./SponsorsClient";

const SCOPE_OPTIONS: { key: PartnershipsScopeFilter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "One54", label: "ONE54" },
  { key: "Pressbox Chronicles", label: "PRESSBOX" },
];

export function PartnershipsClient({
  initial,
  suggestions,
}: {
  initial: Sponsor[];
  suggestions: PipelineSuggestion[];
}) {
  const [scope, setScope] = useState<PartnershipsScopeFilter>("all");
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    meetings: number;
    closed: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPartnershipStats(scope).then((next) => {
      if (!cancelled) setStats(next);
    });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const statsSource = useMemo(() => {
    if (scope === "all") return initial;
    return initial.filter((s) => s.podcast === scope);
  }, [initial, scope]);

  const totalContacts = stats?.total ?? statsSource.length;
  const activePipeline =
    stats?.active ??
    statsSource.filter((s) => s.stage !== "Closed" && s.stage !== "New").length;
  const inNegotiation =
    stats?.meetings ??
    statsSource.filter((s) => s.stage === "Negotiating").length;
  const closedDeals =
    stats?.closed ?? statsSource.filter((s) => s.stage === "Close